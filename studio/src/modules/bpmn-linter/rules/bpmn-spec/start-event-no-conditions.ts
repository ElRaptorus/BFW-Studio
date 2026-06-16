import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:StartEvent')) {
      return;
    }
    const outgoing = node.outgoing || [];
    for (const flow of outgoing) {
      if (flow?.conditionExpression) {
        reporter.report(flow.id, 'Outgoing flow from start event must not have a condition (BSC-004)');
      }
    }
  }

  return { check };
}
