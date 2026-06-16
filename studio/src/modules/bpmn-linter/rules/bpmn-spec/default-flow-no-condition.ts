import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:SequenceFlow')) {
      return;
    }
    const source = node.sourceRef;
    if (source && source.default === node && node.conditionExpression) {
      reporter.report(node.id, 'Default sequence flow must not have a condition expression (BSC-003)');
    }
  }

  return { check };
}
