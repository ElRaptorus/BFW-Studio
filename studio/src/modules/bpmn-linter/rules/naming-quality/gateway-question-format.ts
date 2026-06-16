import { isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!isAny(node, ['bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway'])) {
      return;
    }
    if ((node.outgoing?.length ?? 0) <= 1) {
      return;
    }
    const name = (node.name || '').trim();
    if (name && !name.endsWith('?')) {
      reporter.report(node.id, 'Decision gateway with multiple branches should use a question as the label (NMQ-006)');
    }
  }

  return { check };
}
