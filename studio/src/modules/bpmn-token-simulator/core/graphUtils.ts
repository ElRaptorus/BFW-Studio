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

/** The non-default outgoing flows of an inclusive fork, or the default flow when it is the only one. */
export function selectInclusiveFlows(gateway: any, outgoing: any[]): any[] {
  const defaultFlowId = gateway.businessObject?.default?.id;
  const nonDefaultFlows = outgoing.filter((flow: any) => flow.businessObject?.id !== defaultFlowId);
  return nonDefaultFlows.length > 0 ? nonDefaultFlows : outgoing;
}

/**
 * Element and connection ids between the nearest upstream Complex split and the
 * given Complex join, both excluded. Empty when no Complex split is upstream.
 */
export function findComplexRegion(join: any): Set<string> {
  // ponytail: the nearest split by backward BFS, not the dominating one, so a join
  // behind a nested Complex split/join pair can pair with the inner split.
  const visited = new Set<string>([join.id]);
  const queue: any[] = [join];

  while (queue.length > 0) {
    const current = queue.shift();
    const incoming: any[] = (current.incoming || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');

    for (const flow of incoming) {
      const predecessor = flow.source;
      if (!predecessor || visited.has(predecessor.id)) {
        continue;
      }

      const predecessorOutgoing = (predecessor.outgoing || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
      if (predecessor.type === 'bpmn:ComplexGateway' && predecessorOutgoing.length > 1) {
        const forward = collectReachableIds(predecessor, join, true);
        const backward = collectReachableIds(join, predecessor, false);
        return new Set([...forward].filter((id) => backward.has(id)));
      }

      visited.add(predecessor.id);
      queue.push(predecessor);
    }
  }

  return new Set();
}

function collectReachableIds(start: any, stop: any, forward: boolean): Set<string> {
  const reachable = new Set<string>();
  const queue: any[] = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    const connections: any[] = (forward ? current.outgoing : current.incoming) || [];

    for (const connection of connections) {
      if (connection.type !== 'bpmn:SequenceFlow' || reachable.has(connection.id)) {
        continue;
      }
      reachable.add(connection.id);

      const next = forward ? connection.target : connection.source;
      if (next && next !== stop && next !== start && !reachable.has(next.id)) {
        reachable.add(next.id);
        queue.push(next);
      }
    }
  }

  return reachable;
}
