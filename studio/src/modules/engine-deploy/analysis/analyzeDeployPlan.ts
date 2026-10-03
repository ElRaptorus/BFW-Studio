import type { SolutionModelEntry, SolutionProcessEntry } from '#modules/solution-models/types';

import type { DeployProjectRoot } from './describeDeployItemLocation';
import { describeDeployItemLocation, formatDeployItemLocation } from './describeDeployItemLocation';
import type {
  DependencyState,
  DeployAnalysis,
  DeployConnection,
  DeployDependency,
  DeployItemAnalysis,
  DeployProcessAnalysis,
  EngineSnapshot,
  ProcessDeployStatus,
} from './types';

export const NO_LINTER_SCORE_INFO = 'No linter score stored; the Engine linter gate may reject this model.';

/** A reference from a local file to a process (`calledElement`) or a decision (`decisionRef`). */
type Reference = { kind: 'process' | 'decision'; id: string; version: string | null };

/** Higher wins when a file carries several processes. */
const STATUS_RANK: Record<ProcessDeployStatus, number> = {
  skipped: 0,
  unchanged: 1,
  newVersion: 2,
  new: 3,
  unknown: 4,
  changedWithoutVersionBump: 5,
  versionMissing: 6,
};

function executableProcesses(entry: SolutionModelEntry): SolutionProcessEntry[] {
  return entry.kind === 'bpmn' ? entry.processes.filter((process) => process.isExecutable) : [];
}

function referencesOf(entry: SolutionModelEntry): Reference[] {
  return executableProcesses(entry).flatMap((process) => [
    ...process.callActivities.flatMap((callActivity) =>
      callActivity.calledElement == null
        ? []
        : [{ kind: 'process' as const, id: callActivity.calledElement, version: callActivity.calledProcessVersion }],
    ),
    ...process.decisionRefs.map((id) => ({ kind: 'decision' as const, id, version: null })),
  ]);
}

function findLocalFile(entries: SolutionModelEntry[], reference: Reference): SolutionModelEntry | null {
  return (
    entries.find((entry) =>
      reference.kind === 'process'
        ? entry.kind === 'bpmn' && entry.processes.some((process) => process.id === reference.id)
        : entry.kind === 'dmn' && entry.definitionsId === reference.id,
    ) ?? null
  );
}

/**
 * Every process and decision id the plan mentions, including the transitive closure over local files. This is what the
 * Engine snapshot has to be asked about.
 */
export function collectReferencedIds(
  planUris: readonly string[],
  entries: SolutionModelEntry[],
): { processIds: Set<string>; decisionIds: Set<string> } {
  const processIds = new Set<string>();
  const decisionIds = new Set<string>();
  const visited = new Set<string>();
  const queue = planUris.flatMap((uri) => entries.filter((entry) => entry.uri === uri));
  while (queue.length > 0) {
    const entry = queue.shift() as SolutionModelEntry;
    if (visited.has(entry.uri)) {
      continue;
    }
    visited.add(entry.uri);
    if (entry.kind === 'bpmn') {
      entry.processes.forEach((process) => processIds.add(process.id));
    } else if (entry.kind === 'dmn' && entry.definitionsId != null) {
      decisionIds.add(entry.definitionsId);
    }
    for (const reference of referencesOf(entry)) {
      (reference.kind === 'process' ? processIds : decisionIds).add(reference.id);
      const local = findLocalFile(entries, reference);
      if (local != null) {
        queue.push(local);
      }
    }
  }
  return { processIds, decisionIds };
}

function analyzeProcess(
  process: SolutionProcessEntry,
  fileSha256: string,
  snapshot: EngineSnapshot | null,
): DeployProcessAnalysis {
  const base = { processId: process.id, name: process.name, version: process.version };
  if (!process.isExecutable) {
    return { ...base, status: 'skipped' };
  }
  if (process.version == null || process.version.trim() === '') {
    return { ...base, status: 'versionMissing' };
  }
  if (snapshot == null) {
    return { ...base, status: 'unknown' };
  }
  const deployed = snapshot.processes[process.id];
  if (deployed == null || deployed.length === 0) {
    return { ...base, status: 'new' };
  }
  const sameVersion = deployed.find((entry) => entry.version === process.version);
  if (sameVersion == null) {
    return { ...base, status: 'newVersion' };
  }
  return { ...base, status: sameVersion.sha256 === fileSha256 ? 'unchanged' : 'changedWithoutVersionBump' };
}

function analyzeItem(
  uri: string,
  entry: SolutionModelEntry | undefined,
  snapshot: EngineSnapshot | null,
  connection: DeployConnection,
  unsavedUris: ReadonlySet<string>,
): DeployItemAnalysis {
  const blockers: string[] = [];
  if (unsavedUris.has(uri)) {
    blockers.push('Unsaved changes in the editor; save the file first.');
  }

  if (entry == null || entry.kind === 'invalid') {
    blockers.push(entry == null ? 'The file is not part of the solution.' : `Cannot read the file: ${entry.error}`);
    return {
      uri,
      kind: 'invalid',
      status: 'invalid',
      processes: [],
      storedLinterScores: [],
      linterInfo: null,
      blockers,
      includedByDefault: false,
    };
  }

  if (entry.kind === 'dmn') {
    if (connection.connected && !connection.canDeployDmn) {
      blockers.push('The token lacks the deploy_dmn permission.');
    }
    let status: ProcessDeployStatus;
    if (entry.definitionsId == null) {
      blockers.push('The DMN file has no definitions id.');
      status = 'unknown';
    } else if (snapshot == null) {
      status = 'unknown';
    } else {
      const versions = snapshot.decisions[entry.definitionsId];
      if (versions == null || versions.length === 0) {
        status = 'new';
      } else {
        status = versions.includes(entry.sha256.slice(0, 12)) ? 'unchanged' : 'newVersion';
      }
    }
    return {
      uri,
      kind: 'dmn',
      status,
      processes: [],
      storedLinterScores: [],
      linterInfo: null,
      blockers,
      includedByDefault: status !== 'unchanged',
    };
  }

  if (connection.connected && !connection.canDeployBpmn) {
    blockers.push('The token lacks the deploy_bpmn permission.');
  }
  const processes = entry.processes.map((process) => analyzeProcess(process, entry.sha256, snapshot));
  const executable = processes.filter((process) => process.status !== 'skipped');
  const status: ProcessDeployStatus =
    executable.length === 0
      ? 'skipped'
      : executable.reduce(
          (worst, process) => (STATUS_RANK[process.status] > STATUS_RANK[worst] ? process.status : worst),
          executable[0].status,
        );
  return {
    uri,
    kind: 'bpmn',
    status,
    processes,
    storedLinterScores: entry.storedLinterScores,
    linterInfo: executable.length > 0 && entry.storedLinterScores.length === 0 ? NO_LINTER_SCORE_INFO : null,
    blockers,
    includedByDefault: status !== 'unchanged' && status !== 'skipped',
  };
}

function resolveDependencyState(
  reference: Reference,
  local: SolutionModelEntry | null,
  planUris: ReadonlySet<string>,
  snapshot: EngineSnapshot | null,
): DependencyState {
  if (local != null && planUris.has(local.uri)) {
    return 'inPlan';
  }
  if (snapshot == null) {
    return local != null ? 'localNotInPlan' : 'unknown';
  }
  if (reference.kind === 'process') {
    const versions = snapshot.processes[reference.id] ?? [];
    const onEngine =
      reference.version == null ? versions.length > 0 : versions.some((entry) => entry.version === reference.version);
    if (onEngine) {
      return 'onEngine';
    }
  } else if ((snapshot.decisions[reference.id] ?? []).length > 0) {
    return 'onEngine';
  }
  return local != null ? 'localNotInPlan' : 'missing';
}

function analyzeDependencies(
  planUris: readonly string[],
  entries: SolutionModelEntry[],
  snapshot: EngineSnapshot | null,
): DeployDependency[] {
  const planSet = new Set(planUris);
  const dependencies = new Map<string, DeployDependency>();
  const visited = new Set<string>();
  const queue = planUris.flatMap((uri) => entries.filter((entry) => entry.uri === uri));
  while (queue.length > 0) {
    const entry = queue.shift() as SolutionModelEntry;
    if (visited.has(entry.uri)) {
      continue;
    }
    visited.add(entry.uri);
    for (const reference of referencesOf(entry)) {
      const key = `${reference.kind}:${reference.id}:${reference.version ?? ''}`;
      const existing = dependencies.get(key);
      if (existing != null) {
        if (!existing.requiredBy.includes(entry.uri)) {
          existing.requiredBy.push(entry.uri);
        }
        continue;
      }
      const local = findLocalFile(entries, reference);
      const state = resolveDependencyState(reference, local, planSet, snapshot);
      dependencies.set(key, {
        kind: reference.kind,
        id: reference.id,
        version: reference.version,
        state,
        fileUri: local?.uri ?? null,
        requiredBy: [entry.uri],
      });
      if (local != null && state === 'localNotInPlan') {
        queue.push(local);
      }
    }
  }
  return [...dependencies.values()];
}

export type AnalyzeDeployPlanInput = {
  planUris: readonly string[];
  entries: SolutionModelEntry[];
  /** Null while the Engine is offline or the snapshot is still loading. */
  snapshot: EngineSnapshot | null;
  /** Set when the Engine is connected but its health check or state request failed. */
  engineUnavailableMessage?: string | null;
  connection: DeployConnection;
  unsavedUris: ReadonlySet<string>;
};

export function analyzeDeployPlan(input: AnalyzeDeployPlanInput): DeployAnalysis {
  const { planUris, entries, snapshot, connection, unsavedUris } = input;

  const globalBlockers: string[] = [];
  if (connection.engineId == null) {
    globalBlockers.push('No Engine is selected.');
  } else if (!connection.connected) {
    globalBlockers.push('No connected Engine.');
  } else if (input.engineUnavailableMessage != null) {
    globalBlockers.push(`Engine is not reachable: ${input.engineUnavailableMessage}`);
  }

  return {
    globalBlockers,
    items: planUris.map((uri) =>
      analyzeItem(
        uri,
        entries.find((entry) => entry.uri === uri),
        snapshot,
        connection,
        unsavedUris,
      ),
    ),
    dependencies: analyzeDependencies(planUris, entries, snapshot),
  };
}

/** The reason Deploy is disabled, or null when it can run. */
export function getDeployBlockedReason(
  analysis: DeployAnalysis,
  includedUris: ReadonlySet<string>,
  projects: readonly DeployProjectRoot[] = [],
): string | null {
  const included = analysis.items.filter((item) => includedUris.has(item.uri));
  if (included.length === 0) {
    return 'No files are selected for deployment.';
  }
  const reasons = [
    ...analysis.globalBlockers,
    ...included.flatMap((item) =>
      item.blockers.map(
        (blocker) => `${formatDeployItemLocation(describeDeployItemLocation(item.uri, projects))}: ${blocker}`,
      ),
    ),
  ];
  return reasons.length === 0 ? null : reasons.join('\n');
}
