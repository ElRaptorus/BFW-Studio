import type { SolutionBpmnModelEntry, SolutionProcessEntry } from '#modules/bpmn-core/scanSolutionBpmnModels';

import { relativeFileHint } from './LandscapeMapFile';

export type ProcessCandidate = { uri: string; process: SolutionProcessEntry };

export type ProcessReferenceResolution =
  | ({ status: 'resolved' } & ProcessCandidate)
  | { status: 'ambiguous'; candidates: ProcessCandidate[] }
  | { status: 'missing' };

export type ReferenceStatus = ProcessReferenceResolution['status'];

function candidatesOf(catalog: SolutionBpmnModelEntry[]): ProcessCandidate[] {
  return catalog.flatMap((entry): ProcessCandidate[] =>
    entry.kind === 'bpmn' ? entry.processes.map((process) => ({ uri: entry.uri, process })) : [],
  );
}

/**
 * Finds the process a map shape stands for. An id defined in one file always resolves, even when the hint is stale
 * after a rename or move. An id defined in several files resolves through the hint and is ambiguous without a match.
 */
export function resolveProcessReference(
  catalog: SolutionBpmnModelEntry[],
  mapUri: string,
  reference: { processId: string; fileHint: string | null },
): ProcessReferenceResolution {
  const candidates = candidatesOf(catalog).filter((candidate) => candidate.process.id === reference.processId);
  if (candidates.length === 0) {
    return { status: 'missing' };
  }
  if (candidates.length === 1) {
    return { status: 'resolved', ...candidates[0] };
  }
  const hinted = candidates.find((candidate) => relativeFileHint(mapUri, candidate.uri) === reference.fileHint);
  return hinted == null ? { status: 'ambiguous', candidates } : { status: 'resolved', ...hinted };
}

/** Every process of the solution whose id is not yet on the map, as the targets Replace may offer. */
export function replaceCandidates(catalog: SolutionBpmnModelEntry[], processIdsOnMap: string[]): ProcessCandidate[] {
  const onMap = new Set(processIdsOnMap);
  return candidatesOf(catalog).filter((candidate) => !onMap.has(candidate.process.id));
}
