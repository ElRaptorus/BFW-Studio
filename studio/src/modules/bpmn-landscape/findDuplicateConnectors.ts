import type { LandscapeConnector } from './LandscapeMapFile';
import type { RelationLine } from './buildRelationLines';

/**
 * The drawn relation lines that join the same two shapes as a connector, in either direction, per connector id.
 * Such a connector says again what the BPMN files already say; connectors without a matching line are left out.
 */
export function findDuplicateConnectors(
  connectors: Pick<LandscapeConnector, 'id' | 'sourceId' | 'targetId'>[],
  lines: RelationLine[],
): Map<string, RelationLine[]> {
  const linesByPair = new Map<string, RelationLine[]>();
  for (const line of lines) {
    const pair = [line.sourceElementId, line.targetElementId].sort().join('\n');
    linesByPair.set(pair, [...(linesByPair.get(pair) ?? []), line]);
  }
  const duplicates = new Map<string, RelationLine[]>();
  for (const connector of connectors) {
    const matching = linesByPair.get([connector.sourceId, connector.targetId].sort().join('\n'));
    if (matching !== undefined) {
      duplicates.set(connector.id, matching);
    }
  }
  return duplicates;
}
