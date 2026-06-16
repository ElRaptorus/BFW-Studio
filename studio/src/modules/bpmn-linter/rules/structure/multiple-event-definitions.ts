import { isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const EVENT_TYPES = [
  'bpmn:StartEvent',
  'bpmn:EndEvent',
  'bpmn:IntermediateCatchEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:BoundaryEvent',
];

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!isAny(node, EVENT_TYPES)) {
      return;
    }
    const defs = node.eventDefinitions;
    if (defs && defs.length > 1) {
      reporter.report(node.id, 'Event must not declare more than one event definition (AST-016)');
    }
  }

  return { check };
}
