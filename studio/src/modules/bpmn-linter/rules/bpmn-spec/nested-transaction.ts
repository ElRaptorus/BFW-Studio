import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (is(node, 'bpmn:Transaction') && node.$parent && is(node.$parent, 'bpmn:Transaction')) {
      reporter.report(node.id, 'Transactions must not be nested directly inside another transaction (BSC-023)');
    }
  }

  return { check };
}
