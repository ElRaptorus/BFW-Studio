import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:EventBasedGateway')) {
      return;
    }
    for (const flow of node.outgoing || []) {
      const target = flow?.targetRef;
      if (!target) {
        continue;
      }
      const incomingCount = target.incoming?.length ?? 0;
      if (incomingCount > 1) {
        reporter.report(
          target.id,
          'Target of event-based gateway must not have additional incoming sequence flows (BSC-008)',
        );
      }
    }
  }

  return { check };
}
