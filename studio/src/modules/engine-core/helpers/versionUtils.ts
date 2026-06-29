import type { Bifrost } from '#bifrost/Bifrost';
import evilPlatformModdleDescriptor from '#modules/bpmn-core/bpmn-js/moddle/evil-platform.json';
import type { DaemonEngineClient } from '@elraptorus/daemonengine_client';
import { BpmnModdle } from 'bpmn-moddle';

import type {
  DialogContentObject,
  DialogFormData,
  DialogValidationError,
  DialogValidationResult,
} from '@evil/bifrost_fw_sdk';

const SEMVER_REGEX = /^(v?)(\d+)\.(\d+)\.(\d+)(.*)$/;
const PREFIXED_INTEGER_REGEX = /^(v?)(\d+)$/;
const TRAILING_NUMBER_REGEX = /^(.*-)(\d+)$/;

/**
 * Picks the "higher" of two version strings for bump-reference purposes.
 * Compares SemVer numerically; falls back to lexicographic for non-SemVer.
 */
function pickHigherVersion(versionA: string, versionB: string): string {
  const semA = versionA.match(SEMVER_REGEX);
  const semB = versionB.match(SEMVER_REGEX);

  if (semA && semB) {
    const [majorA, minorA, patchA] = [parseInt(semA[2], 10), parseInt(semA[3], 10), parseInt(semA[4], 10)];
    const [majorB, minorB, patchB] = [parseInt(semB[2], 10), parseInt(semB[3], 10), parseInt(semB[4], 10)];
    if (majorA !== majorB) {
      return majorA > majorB ? versionA : versionB;
    }
    if (minorA !== minorB) {
      return minorA > minorB ? versionA : versionB;
    }
    if (patchA !== patchB) {
      return patchA > patchB ? versionA : versionB;
    }
    return versionA;
  }

  const intA = versionA.match(PREFIXED_INTEGER_REGEX);
  const intB = versionB.match(PREFIXED_INTEGER_REGEX);
  if (intA && intB) {
    return parseInt(intA[2], 10) >= parseInt(intB[2], 10) ? versionA : versionB;
  }

  return versionA.localeCompare(versionB) >= 0 ? versionA : versionB;
}

/**
 * Suggests the next version string based on the current version.
 *
 * - SemVer:           "1.0.0" → "1.0.1", "v2.1.3" → "v2.1.4"
 * - Simple integer:   "3" → "4", "v3" → "v4"
 * - Trailing number:  "alpha-2" → "alpha-3"
 * - Non-deterministic: "alpha" → "alpha-1"
 */
export function suggestNextVersion(current: string): string {
  const semverMatch = current.match(SEMVER_REGEX);
  if (semverMatch) {
    const [, prefix, major, minor, patch, rest] = semverMatch;
    return `${prefix}${major}.${minor}.${parseInt(patch, 10) + 1}${rest}`;
  }

  const integerMatch = current.match(PREFIXED_INTEGER_REGEX);
  if (integerMatch) {
    const [, prefix, num] = integerMatch;
    return `${prefix}${parseInt(num, 10) + 1}`;
  }

  const trailingMatch = current.match(TRAILING_NUMBER_REGEX);
  if (trailingMatch) {
    const [, base, num] = trailingMatch;
    return `${base}${parseInt(num, 10) + 1}`;
  }

  return `${current}-1`;
}

/**
 * Queries the engine for the latest deployed version of a process.
 * Returns `null` if the process has never been deployed or on any error.
 */
export async function discoverLatestVersion(client: DaemonEngineClient, processId: string): Promise<string | null> {
  try {
    const model = await client.processes.get(processId);
    return model?.version ?? null;
  } catch {
    return null;
  }
}

function createModdle(): InstanceType<typeof BpmnModdle> {
  return new BpmnModdle({ evil: evilPlatformModdleDescriptor });
}

function findEvilVersion(processElement: any): string | undefined {
  const extensions = processElement.extensionElements?.values;
  if (!Array.isArray(extensions)) {
    return undefined;
  }
  const versionElement = extensions.find((ext: any) => ext.$type === 'evil:Version');
  return versionElement?.body ?? undefined;
}

function injectEvilVersion(processElement: any, moddle: InstanceType<typeof BpmnModdle>, version: string): void {
  if (!processElement.extensionElements) {
    processElement.extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] });
    processElement.extensionElements.$parent = processElement;
  }

  const existing = processElement.extensionElements.values?.find((ext: any) => ext.$type === 'evil:Version');
  if (existing) {
    existing.body = version;
  } else {
    const versionElement = moddle.create('evil:Version', { body: version });
    versionElement.$parent = processElement.extensionElements;
    processElement.extensionElements.values = [...(processElement.extensionElements.values ?? []), versionElement];
  }
}

interface ProcessInfo {
  element: any;
  processId: string;
  processName: string;
}

function findProcessesMissingVersion(definitions: any): ProcessInfo[] {
  const missing: ProcessInfo[] = [];
  for (const rootElement of definitions.rootElements ?? []) {
    if (rootElement.$type === 'bpmn:Process' && !findEvilVersion(rootElement)) {
      missing.push({
        element: rootElement,
        processId: rootElement.id ?? '',
        processName: rootElement.name ?? rootElement.id ?? 'Unnamed Process',
      });
    }
  }
  return missing;
}

function findProcessById(definitions: any, processId: string): any | undefined {
  return (definitions.rootElements ?? []).find(
    (element: any) => element.$type === 'bpmn:Process' && element.id === processId,
  );
}

/**
 * Checks whether the XML contains processes without `evil:Version`.
 * If any are found, shows a dialog for the user to provide versions.
 *
 * Returns `null` if the user cancelled. Otherwise returns the (possibly modified) XML.
 */
export async function ensureProcessVersions(
  xml: string,
  bifrost: Bifrost,
  client: DaemonEngineClient | null,
): Promise<{ xml: string; modified: boolean } | null> {
  const moddle = createModdle();
  const { rootElement: definitions } = await moddle.fromXML(xml);
  const missing = findProcessesMissingVersion(definitions);

  if (missing.length === 0) {
    return { xml, modified: false };
  }

  const discoveredVersions = new Map<string, string | null>();
  if (client) {
    const discoveries = await Promise.allSettled(
      missing.map(async (process) => {
        const latest = await discoverLatestVersion(client, process.processId);
        return { processId: process.processId, latest };
      }),
    );
    for (const result of discoveries) {
      if (result.status === 'fulfilled') {
        discoveredVersions.set(result.value.processId, result.value.latest);
      }
    }
  }

  const contentItems: DialogContentObject[] = [
    {
      type: 'text',
      text: 'One or more processes in this diagram are missing a version. The engine requires every process to have a version before deployment. Please provide a version for each process listed below.',
    },
  ];

  for (const process of missing) {
    const latestDeployed = discoveredVersions.get(process.processId) ?? null;
    const suggestion = latestDeployed ? suggestNextVersion(latestDeployed) : '1.0.0';

    contentItems.push({
      type: 'text_input',
      id: `version_${process.processId}`,
      label: process.processName,
      value: suggestion,
      focus: missing.indexOf(process) === 0,
    });
  }

  const dialogResult = await bifrost.dialog.open(
    {
      title: 'Missing Versions',
      content: contentItems,
      actions: [
        { label: 'Cancel', response: 'cancel', cancel: true },
        { label: 'Deploy', response: 'deploy', default: true },
      ],
    },
    async (result) => {
      if (result.response !== 'deploy') {
        return { closeDialog: true };
      }
      return validateVersionFields(result.formData, missing);
    },
  );

  if (dialogResult.wasCancelled || dialogResult.response !== 'deploy') {
    return null;
  }

  for (const process of missing) {
    const version = dialogResult.formData?.[`version_${process.processId}`] as string;
    if (version) {
      injectEvilVersion(process.element, moddle, version);
    }
  }

  const { xml: updatedXml } = await moddle.toXML(definitions, { format: true });
  return { xml: updatedXml, modified: true };
}

/**
 * Handles version conflict errors (409) by showing a dialog to resolve them.
 * Queries the engine for the latest deployed version of each conflicting process
 * to provide accurate version suggestions.
 *
 * Returns `null` if the user cancelled. When `allowRunExisting` is true and the
 * user chooses "Run Latest Deployed Version", returns `{ runExisting, processModelId }`.
 * Otherwise returns the updated XML.
 */
export async function resolveVersionConflicts(
  xml: string,
  conflicts: { processModelId: string; version: string }[],
  bifrost: Bifrost,
  client: DaemonEngineClient | null,
  options?: { allowRunExisting?: boolean },
): Promise<{ xml: string } | { runExisting: true; processModelId: string } | null> {
  const moddle = createModdle();
  const { rootElement: definitions } = await moddle.fromXML(xml);

  const discoveredVersions = new Map<string, string | null>();
  if (client) {
    const discoveries = await Promise.allSettled(
      conflicts.map(async (conflict) => {
        const latest = await discoverLatestVersion(client, conflict.processModelId);
        return { processModelId: conflict.processModelId, latest };
      }),
    );
    for (const result of discoveries) {
      if (result.status === 'fulfilled') {
        discoveredVersions.set(result.value.processModelId, result.value.latest);
      }
    }
  }

  const contentItems: DialogContentObject[] = [
    {
      type: 'text',
      text: 'The following process versions are already deployed on the engine. Please provide new versions to deploy.',
    },
  ];

  const resolvedConflicts: { processId: string; element: any; localVersion: string }[] = [];

  for (const conflict of conflicts) {
    const processElement = findProcessById(definitions, conflict.processModelId);
    if (!processElement) {
      continue;
    }

    const localVersion = findEvilVersion(processElement) ?? conflict.version;
    const latestDeployed = discoveredVersions.get(conflict.processModelId) ?? null;

    const referenceVersion =
      latestDeployed && latestDeployed !== localVersion
        ? pickHigherVersion(localVersion, latestDeployed)
        : localVersion;
    const suggestion = suggestNextVersion(referenceVersion);

    const processName = processElement.name ?? processElement.id ?? 'Unnamed Process';

    contentItems.push({ type: 'section', text: processName });

    contentItems.push({
      type: 'text_input',
      id: `info_local_${conflict.processModelId}`,
      label: 'Current local version',
      value: localVersion,
      readonly: true,
    });

    if (latestDeployed && latestDeployed !== localVersion) {
      contentItems.push({
        type: 'text_input',
        id: `info_deployed_${conflict.processModelId}`,
        label: 'Latest deployed version',
        value: latestDeployed,
        readonly: true,
      });
    }

    contentItems.push({
      type: 'text_input',
      id: `version_${conflict.processModelId}`,
      label: 'New version',
      value: suggestion,
      focus: conflicts.indexOf(conflict) === 0,
    });

    resolvedConflicts.push({ processId: conflict.processModelId, element: processElement, localVersion });
  }

  const actions: { label: string; response: string; cancel?: boolean; default?: boolean }[] = [
    { label: 'Cancel', response: 'cancel', cancel: true },
  ];
  if (options?.allowRunExisting) {
    actions.push({ label: 'Run Latest Deployed Version', response: 'run_existing' });
  }
  actions.push({ label: 'Update & Deploy', response: 'deploy', default: true });

  const dialogResult = await bifrost.dialog.open(
    {
      title: 'Version Conflict',
      content: contentItems,
      actions,
    },
    async (result) => {
      if (result.response !== 'deploy') {
        return { closeDialog: true };
      }
      return validateConflictFields(result.formData, resolvedConflicts);
    },
  );

  if (dialogResult.response === 'run_existing') {
    return { runExisting: true, processModelId: conflicts[0].processModelId };
  }

  if (dialogResult.wasCancelled || dialogResult.response !== 'deploy') {
    return null;
  }

  for (const conflict of resolvedConflicts) {
    const newVersion = dialogResult.formData?.[`version_${conflict.processId}`] as string;
    if (newVersion) {
      injectEvilVersion(conflict.element, moddle, newVersion);
    }
  }

  const { xml: updatedXml } = await moddle.toXML(definitions, { format: true });
  return { xml: updatedXml };
}

function validateVersionFields(formData: DialogFormData | undefined, processes: ProcessInfo[]): DialogValidationResult {
  const errors: DialogValidationError[] = [];
  for (const process of processes) {
    const value = (formData?.[`version_${process.processId}`] as string)?.trim();
    if (!value) {
      errors.push({ contentId: `version_${process.processId}`, errorLabel: 'Version is required' });
    }
  }
  if (errors.length > 0) {
    return { closeDialog: false as const, validationErrors: errors };
  }
  return { closeDialog: true as const };
}

function validateConflictFields(
  formData: DialogFormData | undefined,
  conflicts: { processId: string; localVersion: string }[],
): DialogValidationResult {
  const errors: DialogValidationError[] = [];
  for (const conflict of conflicts) {
    const value = (formData?.[`version_${conflict.processId}`] as string)?.trim();
    if (!value) {
      errors.push({ contentId: `version_${conflict.processId}`, errorLabel: 'Version is required' });
    } else if (value === conflict.localVersion) {
      errors.push({
        contentId: `version_${conflict.processId}`,
        errorLabel: 'New version must differ from the current version',
      });
    }
  }
  if (errors.length > 0) {
    return { closeDialog: false as const, validationErrors: errors };
  }
  return { closeDialog: true as const };
}
