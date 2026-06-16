import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:EventBasedGateway')) {
      return;
    }
    for (const flow of node.outgoing || []) {
      const target = flow?.targetRef;
      if (target && !isAny(target, ['bpmn:IntermediateCatchEvent', 'bpmn:ReceiveTask'])) {
        reporter.report(
          target.id,
          'Target of event-based gateway must be an intermediate catch event or receive task (BSC-007)',
        );
      }
    }
  }

  return { check };
}
