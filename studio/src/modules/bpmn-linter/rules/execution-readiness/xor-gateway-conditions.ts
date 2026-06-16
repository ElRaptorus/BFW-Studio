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
    if (defaultFlow) {
      return;
    }
    const allConditional = outgoing.every((flow) => !!flow?.conditionExpression);
    if (!allConditional) {
      reporter.report(
        node.id,
        'Exclusive gateway with multiple outgoing flows should set a default flow or conditions on each path (EXR-011)',
      );
    }
  }

  return { check };
}
