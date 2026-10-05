import type { Bifrost } from '#bifrost/Bifrost';
import type { SolutionModelEntry } from '#modules/solution-models/types';

export type DmnSolutionModel = Extract<SolutionModelEntry, { kind: 'dmn' }>;

export function findImportedModel(bifrost: Bifrost, namespace: string): Promise<DmnSolutionModel | null> {
  if (namespace.trim() === '') {
    return Promise.resolve(null);
  }
  return bifrost.commands.executeCommand<Promise<DmnSolutionModel | null>>(
    'solution.models.findDecisionModelByNamespace',
    [namespace],
  );
}

/** Every DMN file of the solution except `ownUri`, one per namespace (the first by URI wins). */
export async function listOtherDmnModels(bifrost: Bifrost, ownUri: string): Promise<DmnSolutionModel[]> {
  const entries = await bifrost.commands.executeCommand<Promise<SolutionModelEntry[]>>('solution.models.scan', []);
  const byNamespace = new Map<string, DmnSolutionModel>();
  for (const entry of entries) {
    if (entry.kind === 'dmn' && entry.namespace != null && entry.uri !== ownUri && !byNamespace.has(entry.namespace)) {
      byNamespace.set(entry.namespace, entry);
    }
  }
  return [...byNamespace.values()];
}

export function fileNameOf(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}
