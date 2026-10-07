import type { Bifrost } from '#bifrost/Bifrost';
import type { SolutionDmnModelEntry } from '#modules/dmn-core/scanSolutionDmnModels';
import { scanSolutionDmnModels } from '#modules/dmn-core/scanSolutionDmnModels';

export type DmnSolutionModel = Extract<SolutionDmnModelEntry, { kind: 'dmn' }>;

export async function findImportedModel(bifrost: Bifrost, namespace: string): Promise<DmnSolutionModel | null> {
  if (namespace.trim() === '') {
    return null;
  }
  const entries = await scanSolutionDmnModels(bifrost);
  const match = entries.find((entry) => entry.kind === 'dmn' && entry.namespace === namespace);
  return match?.kind === 'dmn' ? match : null;
}

/** Every DMN file of the solution except `ownUri`, one per namespace (the first by URI wins). */
export async function listOtherDmnModels(bifrost: Bifrost, ownUri: string): Promise<DmnSolutionModel[]> {
  const entries = await scanSolutionDmnModels(bifrost);
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
