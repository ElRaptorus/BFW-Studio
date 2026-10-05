import type { DmnDefinitions } from '@elraptorus/bfw_engine_sdk';

import { SimulationError } from './types';

/** The model behind an import namespace. It must be declared by `definitions` and loaded in `importedModels`. */
export function resolveImportedModel(
  definitions: DmnDefinitions,
  importedModels: ReadonlyMap<string, DmnDefinitions>,
  namespace: string,
  requiredBy: string,
): DmnDefinitions {
  const isDeclared = definitions.imports.some((declaredImport) => declaredImport.namespace === namespace);
  const imported = isDeclared ? importedModels.get(namespace) : undefined;
  if (imported == null) {
    throw new SimulationError(
      'import_not_found',
      isDeclared
        ? `No DMN file in this solution uses the namespace '${namespace}' (required by '${requiredBy}').`
        : `'${requiredBy}' references namespace '${namespace}', which this model does not import.`,
      { namespace, requiredBy },
    );
  }
  return imported;
}
