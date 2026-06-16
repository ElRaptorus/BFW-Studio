import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:EventBasedGateway')) {
      return;
    }
    const count = node.outgoing?.length ?? 0;
    if (count < 2) {
      reporter.report(node.id, 'Event-based gateway must have at least two outgoing sequence flows (BSC-006)');
    }
  }

  return { check };
}
