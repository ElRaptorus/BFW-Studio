import type { Scope } from './Scope';

/**
 * Check whether any element that currently holds an active token can reach
 * the source of `targetFlow` via a backward BFS through the process graph.
 *
 * The traversal walks *backwards* from the flow's source element, following
 * incoming sequence flows, stopping at elements that hold an active token
 * (returning `true`) or at the scope boundary / already-visited nodes.
 *
 * `excludeGatewayId` prevents the inclusive join gateway itself from being
 * considered reachable (avoids self-loop false positives).
 */
export function hasUpstreamToken(targetFlow: any, scope: Scope, excludeGatewayId: string): boolean {
  const activeTokens = scope.collectActiveTokens();
  activeTokens.delete(excludeGatewayId);

  if (activeTokens.size === 0) {
    return false;
  }

  const source = targetFlow.source;
  if (!source) {
    return false;
  }

  if (activeTokens.has(source.id)) {
    return true;
  }

  const visited = new Set<string>([excludeGatewayId]);
  const queue: any[] = [source];
  visited.add(source.id);

  while (queue.length > 0) {
    const current = queue.shift();
    const incoming: any[] = (current.incoming || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');

    for (const flow of incoming) {
      const predecessor = flow.source;
      if (!predecessor || visited.has(predecessor.id)) {
        continue;
      }

      if (activeTokens.has(predecessor.id)) {
        return true;
      }

      visited.add(predecessor.id);
      queue.push(predecessor);
    }
  }

  return false;
}
