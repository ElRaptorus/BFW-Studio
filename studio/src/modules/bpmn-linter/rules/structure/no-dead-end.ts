import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function hasEventDefinition(node: ModdleNode, type: string): boolean {
  return ((node.eventDefinitions as ModdleNode[] | undefined) ?? []).some((definition) => is(definition, type));
}

function isExempt(node: ModdleNode): boolean {
  if (is(node, 'bpmn:EndEvent')) {
    return true;
  }
  if (is(node, 'bpmn:IntermediateThrowEvent') && hasEventDefinition(node, 'bpmn:LinkEventDefinition')) {
    return true;
  }
  if (node.isForCompensation === true || node.triggeredByEvent === true) {
    return true;
  }
  if (is(node, 'bpmn:BoundaryEvent') && hasEventDefinition(node, 'bpmn:CompensateEventDefinition')) {
    return true;
  }
  return node.$parent != null && is(node.$parent, 'bpmn:AdHocSubProcess');
}

/**
 * The Engine fails the instance with `:dead_end` when a non-end flow node
 * completes without an outgoing sequence flow.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!isAny(node, ['bpmn:Activity', 'bpmn:Event', 'bpmn:Gateway']) || isExempt(node)) {
      return;
    }
    const siblings = (node.$parent?.flowElements as ModdleNode[] | undefined) ?? [];
    const hasOutgoingFlow = siblings.some(
      (element) => is(element, 'bpmn:SequenceFlow') && element.sourceRef?.id === node.id,
    );
    if (!hasOutgoingFlow) {
      reporter.report(
        node.id,
        'Element has no outgoing flow — the Engine fails the instance when it completes (AST-021)',
      );
    }
  }

  return { check };
}
