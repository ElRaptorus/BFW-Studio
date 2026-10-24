import type { LandscapeProcessReference, ProcessRelation, ProcessRelationKind } from './buildProcessRelations';

/**
 * A process and the solution process it resolves to, with the shape that stands for it on the plane on screen: the
 * process shape, or the collapsed group that holds it.
 */
export type PlacedProcess = { elementId: string; reference: LandscapeProcessReference };

/** One drawn line: every visible relation of one kind from one map element to another. */
export type RelationLine = {
  /** `relation:<kind>:<source element id>:<target element id>`, also the id of the canvas connection. */
  id: string;
  kind: ProcessRelationKind;
  sourceElementId: string;
  targetElementId: string;
  /** All relations of the line, hidden ones included, sorted by key. */
  relations: ProcessRelation[];
  /** The keys of `relations` that `hiddenRelations` hides. */
  hiddenKeys: string[];
};

const referenceKey = (reference: LandscapeProcessReference): string => `${reference.uri}#${reference.processId}`;

/**
 * The relation lines of a map: relations whose two processes are both placed and whose kind is switched on, one
 * line per kind, source element and target element. A line whose relations are all hidden is left out. Sorted by id.
 */
export function buildRelationLines(input: {
  relations: ProcessRelation[];
  placedProcesses: PlacedProcess[];
  relationLayers: Record<ProcessRelationKind, boolean>;
  hiddenRelations: string[];
}): RelationLine[] {
  const elementIdByReference = new Map(
    input.placedProcesses.map((placed) => [referenceKey(placed.reference), placed.elementId]),
  );
  const hidden = new Set(input.hiddenRelations);
  const linesById = new Map<string, RelationLine>();
  for (const relation of input.relations) {
    const sourceElementId = elementIdByReference.get(referenceKey(relation.source));
    const targetElementId = elementIdByReference.get(referenceKey(relation.target));
    if (sourceElementId == null || targetElementId == null || !input.relationLayers[relation.kind]) {
      continue;
    }
    // Both processes sit in the same collapsed group: there is nothing to draw between them.
    if (sourceElementId === targetElementId) {
      continue;
    }
    const id = `relation:${relation.kind}:${sourceElementId}:${targetElementId}`;
    const line = linesById.get(id) ?? {
      id,
      kind: relation.kind,
      sourceElementId,
      targetElementId,
      relations: [],
      hiddenKeys: [],
    };
    line.relations.push(relation);
    if (hidden.has(relation.key)) {
      line.hiddenKeys.push(relation.key);
    }
    linesById.set(id, line);
  }
  return [...linesById.values()]
    .filter((line) => line.hiddenKeys.length < line.relations.length)
    .map((line) => ({
      ...line,
      relations: [...line.relations].sort((first, second) => first.key.localeCompare(second.key)),
      hiddenKeys: [...line.hiddenKeys].sort(),
    }))
    .sort((first, second) => first.id.localeCompare(second.id));
}
