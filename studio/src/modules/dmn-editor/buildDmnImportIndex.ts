import type { SolutionModelEntry } from '#modules/solution-models/types';

import type { DmnImportIndex, DmnImportedElementType } from '../dmn-core/validation/DmnValidator';

/**
 * `namespace` → element id → type of the first solution DMN file with that namespace (same tie-break as the lookup
 * command). Only the types the Engine resolves through an import are indexed; decision services are not.
 */
export function buildDmnImportIndex(entries: SolutionModelEntry[]): DmnImportIndex {
  const index: DmnImportIndex = new Map();
  for (const entry of entries) {
    if (entry.kind !== 'dmn' || entry.namespace == null || index.has(entry.namespace)) {
      continue;
    }
    const { decisions, businessKnowledgeModels, inputData } = entry.elements;
    const typed: [DmnImportedElementType, { id: string }[]][] = [
      ['decision', decisions],
      ['inputData', inputData],
      ['businessKnowledgeModel', businessKnowledgeModels],
    ];
    index.set(
      entry.namespace,
      new Map(typed.flatMap(([type, items]) => items.map((item): [string, DmnImportedElementType] => [item.id, type]))),
    );
  }
  return index;
}
