import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleEventDefinition, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:BoundaryEvent')) {
      return;
    }
    const defs = node.eventDefinitions || [];
    const isCompensation = defs.some((ed: ModdleEventDefinition) => is(ed, 'bpmn:CompensateEventDefinition'));
    if (!isCompensation) {
      return;
    }
    if ((node.outgoing?.length ?? 0) > 0) {
      reporter.report(node.id, 'Compensation boundary event must not have outgoing sequence flows (BSC-011)');
    }
  }

  return { check };
}
