import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const FLOW_ELEMENT_CONTAINER_TYPES = ['bpmn:Process', 'bpmn:SubProcess', 'bpmn:Transaction', 'bpmn:AdHocSubProcess'];
const NON_FLOW_NODE_TYPES = [
  'bpmn:SequenceFlow',
  'bpmn:DataObject',
  'bpmn:DataObjectReference',
  'bpmn:DataStoreReference',
];
const ENTRY_MARKER = '\u0000entry';

type AdjacencyIndex = Map<string, string[]>;

interface JoinPairing {
  joinId: string;
  splitId: string | undefined;
  region: Set<string>;
  violations: string[];
}

function isBlank(value: unknown): boolean {
  return value == null || String(value).trim() === '';
}

function addToIndex(index: AdjacencyIndex, key: string, value: string): void {
  const values = index.get(key);
  if (values) {
    values.push(value);
  } else {
    index.set(key, [value]);
  }
}

/** Breadth-first reachability; `stopId` is included but not expanded. */
function traverse(startIds: string[], adjacency: AdjacencyIndex, stopId?: string): Set<string> {
  const visited = new Set<string>();
  const queue = [...startIds];
  while (queue.length > 0) {
    const nodeId = queue.shift() as string;
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    if (nodeId === stopId) {
      continue;
    }
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

function computeDominators(
  nodeIds: string[],
  startIds: string[],
  incomingIndex: AdjacencyIndex,
  outgoingIndex: AdjacencyIndex,
): Map<string, Set<string>> {
  const startSet = new Set(startIds);
  const reachable = traverse(startIds, outgoingIndex);
  const universe = new Set([ENTRY_MARKER, ...nodeIds]);
  const dominators = new Map<string, Set<string>>();
  for (const nodeId of reachable) {
    dominators.set(nodeId, new Set(universe));
  }
  dominators.set(ENTRY_MARKER, new Set([ENTRY_MARKER]));

  let changed = true;
  while (changed) {
    changed = false;
    for (const nodeId of reachable) {
      const predecessors = [
        ...(startSet.has(nodeId) ? [ENTRY_MARKER] : []),
        ...(incomingIndex.get(nodeId) ?? []),
      ].filter((predecessor) => dominators.has(predecessor));
      let intersection: Set<string> = new Set();
      predecessors.forEach((predecessor, position) => {
        const predecessorDominators = dominators.get(predecessor) as Set<string>;
        intersection =
          position === 0
            ? new Set(predecessorDominators)
            : new Set([...intersection].filter((dominator) => predecessorDominators.has(dominator)));
      });
      intersection.add(nodeId);
      const current = dominators.get(nodeId) as Set<string>;
      if (intersection.size !== current.size || [...intersection].some((dominator) => !current.has(dominator))) {
        dominators.set(nodeId, intersection);
        changed = true;
      }
    }
  }
  return dominators;
}

function isSubset(subset: Set<string>, superset: Set<string>): boolean {
  return [...subset].every((element) => superset.has(element));
}

function partiallyOverlap(first: Set<string>, second: Set<string>): boolean {
  const intersects = [...first].some((element) => second.has(element));
  return intersects && !isSubset(first, second) && !isSubset(second, first);
}

/**
 * Port of the Engine's deploy-time Complex region analysis for one flow-element
 * container. Every Complex join pairs with the nearest dominating Complex split;
 * the nodes between them must form a single-entry, single-exit region, and two
 * regions must be disjoint or strictly nested.
 */
function analyzeContainer(container: ModdleNode): JoinPairing[] {
  const flowElements = (container.flowElements as ModdleNode[] | undefined) ?? [];
  const nodes = flowElements.filter((element) => !isAny(element, NON_FLOW_NODE_TYPES));
  const flows = flowElements
    .filter((element) => is(element, 'bpmn:SequenceFlow'))
    .map((flow) => ({ sourceId: flow.sourceRef?.id as string, targetId: flow.targetRef?.id as string }))
    .filter((flow) => flow.sourceId && flow.targetId);

  const incomingIndex: AdjacencyIndex = new Map();
  const outgoingIndex: AdjacencyIndex = new Map();
  for (const flow of flows) {
    addToIndex(incomingIndex, flow.targetId, flow.sourceId);
    addToIndex(outgoingIndex, flow.sourceId, flow.targetId);
  }
  const incomingCount = (nodeId: string) => incomingIndex.get(nodeId)?.length ?? 0;
  const outgoingCount = (nodeId: string) => outgoingIndex.get(nodeId)?.length ?? 0;

  const complexGateways = nodes.filter((node) => is(node, 'bpmn:ComplexGateway'));
  const splitIds = new Set(
    complexGateways
      .filter((node) => outgoingCount(node.id) > 1 && incomingCount(node.id) <= 1)
      .map((node) => node.id as string),
  );
  const joinIds = complexGateways
    .filter((node) => incomingCount(node.id) > 1 && outgoingCount(node.id) <= 1)
    .map((node) => node.id as string);
  if (joinIds.length === 0) {
    return [];
  }

  const nodeIds = nodes.map((node) => node.id as string);
  const explicitStartIds = nodes.filter((node) => is(node, 'bpmn:StartEvent')).map((node) => node.id as string);
  const startIds =
    explicitStartIds.length > 0 ? explicitStartIds : nodeIds.filter((nodeId) => incomingCount(nodeId) === 0);
  const dominators = computeDominators(nodeIds, startIds, incomingIndex, outgoingIndex);

  const pairings = joinIds.map((joinId): JoinPairing => {
    const joinDominators = dominators.get(joinId) ?? new Set<string>();
    const splitId = [...joinDominators]
      .filter((dominator) => dominator !== joinId && splitIds.has(dominator))
      .reduce<string | undefined>(
        (nearest, candidate) =>
          nearest == null || (dominators.get(candidate)?.size ?? 0) > (dominators.get(nearest)?.size ?? 0)
            ? candidate
            : nearest,
        undefined,
      );
    if (splitId == null) {
      return {
        joinId,
        splitId,
        region: new Set(),
        violations: ['Complex join has no dominating Complex split to pair with (EXR-021)'],
      };
    }

    const forward = traverse([splitId], outgoingIndex, joinId);
    const backward = traverse([joinId], incomingIndex, splitId);
    const region = new Set(
      [...forward].filter((nodeId) => backward.has(nodeId) && nodeId !== splitId && nodeId !== joinId),
    );

    const violations = new Set<string>();
    for (const { sourceId, targetId } of flows) {
      const entersRegion = region.has(targetId) || targetId === joinId;
      if (entersRegion && !region.has(sourceId) && sourceId !== splitId) {
        violations.add(
          `Complex region between split "${splitId}" and this join is entered from "${sourceId}" outside the region (EXR-021)`,
        );
      }
      const leavesRegion = region.has(sourceId) || sourceId === splitId;
      if (leavesRegion && !region.has(targetId) && targetId !== joinId) {
        violations.add(
          `Complex region between split "${splitId}" and this join leaks to "${targetId}" outside the region (EXR-021)`,
        );
      }
    }
    return { joinId, splitId, region, violations: [...violations] };
  });

  const wellFormed = pairings.filter((pairing) => pairing.splitId != null && pairing.violations.length === 0);
  const fullSet = (pairing: JoinPairing) => new Set([...pairing.region, pairing.splitId as string, pairing.joinId]);
  for (const first of wellFormed) {
    for (const second of wellFormed) {
      if (first.joinId < second.joinId && partiallyOverlap(fullSet(first), fullSet(second))) {
        first.violations.push(
          `Complex region (split "${first.splitId}" / join "${first.joinId}") partially overlaps region (split "${second.splitId}" / join "${second.joinId}"); regions must be disjoint or strictly nested (EXR-021)`,
        );
      }
    }
  }
  return pairings;
}

export function complexGatewayJoinCondition() {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ComplexGateway')) {
      return;
    }
    const isJoin = (node.incoming?.length ?? 0) > 1 && (node.outgoing?.length ?? 0) <= 1;
    if (isJoin && isBlank((node.activationCondition as ModdleNode | undefined)?.body)) {
      reporter.report(node.id, 'Complex join must define an activationCondition (EXR-020)');
    }
  }

  return { check };
}

export function complexGatewayRegion() {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!isAny(node, FLOW_ELEMENT_CONTAINER_TYPES)) {
      return;
    }
    for (const pairing of analyzeContainer(node)) {
      for (const violation of pairing.violations) {
        reporter.report(pairing.joinId, violation);
      }
    }
  }

  return { check };
}
