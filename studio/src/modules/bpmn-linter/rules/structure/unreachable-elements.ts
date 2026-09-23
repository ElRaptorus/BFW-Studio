import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleEventDefinition, ModdleNode } from '../../types';

const FLOW_NODE_TYPES = [
  'bpmn:Task',
  'bpmn:ServiceTask',
  'bpmn:UserTask',
  'bpmn:ScriptTask',
  'bpmn:BusinessRuleTask',
  'bpmn:ManualTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess',
  'bpmn:AdHocSubProcess',
  'bpmn:ExclusiveGateway',
  'bpmn:InclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:ComplexGateway',
  'bpmn:EventBasedGateway',
  'bpmn:IntermediateCatchEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:EndEvent',
];

function isFlowNode(el: ModdleNode): boolean {
  return isAny(el, FLOW_NODE_TYPES);
}

function getLinkEventDefinition(node: ModdleNode): ModdleEventDefinition | undefined {
  return node.eventDefinitions?.find((def) => def.$type === 'bpmn:LinkEventDefinition');
}

function isLinkThrowEvent(node: ModdleNode): boolean {
  return is(node, 'bpmn:IntermediateThrowEvent') && getLinkEventDefinition(node) !== undefined;
}

function isLinkCatchEvent(node: ModdleNode): boolean {
  return is(node, 'bpmn:IntermediateCatchEvent') && getLinkEventDefinition(node) !== undefined;
}

function lintScope(container: ModdleNode, reporter: BpmnlintReporter) {
  const elements = container.flowElements || [];
  const localIds = new Set(elements.map((el) => el.id).filter(Boolean));
  const flowNodes = elements.filter((el) => isFlowNode(el));
  const starts = elements.filter((e) => is(e, 'bpmn:StartEvent'));
  const nodeById = new Map<string, ModdleNode>();
  for (const el of elements) {
    if (el.id) {
      nodeById.set(el.id, el);
    }
  }

  // Build adjacency from sequence flows directly — the `outgoing` property
  // on flow nodes is only populated when bpmn-moddle resolves back-references,
  // which doesn't happen for externally authored or imported BPMN files.
  const outgoingTargets = new Map<string, string[]>();
  for (const el of elements) {
    if (is(el, 'bpmn:SequenceFlow') && el.sourceRef?.id && el.targetRef?.id) {
      if (!outgoingTargets.has(el.sourceRef.id)) {
        outgoingTargets.set(el.sourceRef.id, []);
      }
      outgoingTargets.get(el.sourceRef.id)!.push(el.targetRef.id);
    }
  }

  const boundaryEventsByHost = new Map<string, ModdleNode[]>();
  for (const el of elements) {
    if (is(el, 'bpmn:BoundaryEvent') && el.attachedToRef?.id) {
      const hostId = el.attachedToRef.id;
      if (!boundaryEventsByHost.has(hostId)) {
        boundaryEventsByHost.set(hostId, []);
      }
      boundaryEventsByHost.get(hostId)!.push(el);
    }
  }

  // Build link-name → Link Catch Event map so that visiting a Link Throw
  // implicitly reaches the matching Link Catch (same semantics as runtime).
  const linkCatchByName = new Map<string, ModdleNode[]>();
  for (const el of elements) {
    if (isLinkCatchEvent(el)) {
      const linkName = getLinkEventDefinition(el)?.name as string | undefined;
      if (linkName) {
        if (!linkCatchByName.has(linkName)) {
          linkCatchByName.set(linkName, []);
        }
        linkCatchByName.get(linkName)!.push(el);
      }
    }
  }

  const reachable = new Set<string>();
  const queue: ModdleNode[] = [...starts];

  while (queue.length) {
    const current = queue.shift();
    if (!current?.id || reachable.has(current.id)) {
      continue;
    }
    reachable.add(current.id);
    const targets = outgoingTargets.get(current.id) || [];
    for (const targetId of targets) {
      const target = nodeById.get(targetId);
      if (target && localIds.has(targetId)) {
        queue.push(target);
      }
    }
    const attachedBoundaryEvents = boundaryEventsByHost.get(current.id);
    if (attachedBoundaryEvents) {
      for (const boundaryEvent of attachedBoundaryEvents) {
        queue.push(boundaryEvent);
      }
    }

    if (isLinkThrowEvent(current)) {
      const linkName = getLinkEventDefinition(current)?.name as string | undefined;
      if (linkName) {
        const matchingCatches = linkCatchByName.get(linkName);
        if (matchingCatches) {
          for (const catchEvent of matchingCatches) {
            queue.push(catchEvent);
          }
        }
      }
    }
  }

  for (const fn of flowNodes) {
    if (!fn.id || is(fn, 'bpmn:StartEvent')) {
      continue;
    }
    if (is(fn, 'bpmn:SubProcess') && fn.triggeredByEvent) {
      continue;
    }
    // Compensation handlers are reached through a compensation boundary association, never a sequence flow.
    if (fn.isForCompensation) {
      continue;
    }
    if (!reachable.has(fn.id)) {
      reporter.report(fn.id, 'Element is not reachable from any start event in this scope (AST-008)');
    }
  }

  for (const el of elements) {
    // Inner ad-hoc elements have no sequence flows, so this scope is not walked.
    // The ad-hoc shell is still checked for reachability in its parent scope.
    if (is(el, 'bpmn:AdHocSubProcess')) {
      continue;
    }
    if (is(el, 'bpmn:SubProcess') && !el.triggeredByEvent) {
      lintScope(el, reporter);
    }
  }
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:Process')) {
      return;
    }
    lintScope(node, reporter);
  }

  return { check };
}
