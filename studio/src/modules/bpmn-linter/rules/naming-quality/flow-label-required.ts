import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ExclusiveGateway')) {
      return;
    }
    const outgoing = node.outgoing || [];
    if (outgoing.length <= 1) {
      return;
    }
    const defaultFlow = node.default;
    for (const flow of outgoing) {
      if (flow === defaultFlow) {
        continue;
      }
      const label = (flow?.name || '').trim();
      if (!label) {
        reporter.report(flow.id, 'Non-default outgoing flow from XOR gateway should have a visible label (NMQ-007)');
      }
    }
  }

  return { check };
}
