import type { DmnDefinitions } from '@elraptorus/bfw_engine_sdk';
import { parseDmn } from '@elraptorus/bfw_engine_sdk';

export type SimulationModelSource = {
  /** Every DMN file of the solution with its namespace (one scan). */
  listDecisionModels(): Promise<{ uri: string; namespace: string | null }[]>;
  loadText(uri: string): Promise<string>;
};

export type LoadedSimulationModels = {
  model: DmnDefinitions;
  /** Transitive closure of the model's imports, keyed by namespace. */
  importedModels: Map<string, DmnDefinitions>;
  /** Imported namespaces no solution file provides, or whose file cannot be parsed. */
  unresolvedImports: { namespace: string; reason: string }[];
  /** File URI of every loaded imported model, keyed by namespace. */
  importedModelUris: Record<string, string>;
  /** Namespaces that more than one solution file provides; the first file is used. */
  ambiguousImports: { namespace: string; chosenUri: string; ignoredUris: string[] }[];
};

/**
 * Parses the editor's current XML and every model it imports (transitively) from the solution.
 *
 * ponytail: imported models are read from disk, so unsaved edits in another open tab are not simulated. The upgrade
 * path is to prefer the open document's XML via the editor registry.
 */
export async function loadSimulationModels(
  currentXml: string,
  source: SimulationModelSource,
): Promise<LoadedSimulationModels> {
  const model = parseDmn(currentXml);
  const importedModels = new Map<string, DmnDefinitions>();
  const unresolvedImports: LoadedSimulationModels['unresolvedImports'] = [];
  const importedModelUris: LoadedSimulationModels['importedModelUris'] = {};
  const ambiguousImports: LoadedSimulationModels['ambiguousImports'] = [];
  const visited = new Set<string>(model.namespace == null ? [] : [model.namespace]);
  const candidates = await source.listDecisionModels();

  const resolve = async (definitions: DmnDefinitions): Promise<void> => {
    for (const declaredImport of definitions.imports) {
      const namespace = declaredImport.namespace;
      if (visited.has(namespace)) {
        continue;
      }
      visited.add(namespace);
      const candidate = candidates.find((entry) => entry.namespace === namespace);
      if (candidate == null) {
        unresolvedImports.push({ namespace, reason: 'No DMN file in this solution uses this namespace.' });
        continue;
      }
      const ignoredUris = candidates
        .filter((entry) => entry.namespace === namespace && entry.uri !== candidate.uri)
        .map((entry) => entry.uri);
      if (ignoredUris.length > 0) {
        ambiguousImports.push({ namespace, chosenUri: candidate.uri, ignoredUris });
      }
      try {
        const imported = parseDmn(await source.loadText(candidate.uri));
        importedModels.set(namespace, imported);
        importedModelUris[namespace] = candidate.uri;
        await resolve(imported);
      } catch (error) {
        unresolvedImports.push({ namespace, reason: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  await resolve(model);
  return { model, importedModels, unresolvedImports, importedModelUris, ambiguousImports };
}
