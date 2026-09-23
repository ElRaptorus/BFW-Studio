import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:ServiceTask')) {
      return;
    }
    if (!(node.implementation as string | undefined)?.trim()) {
      reporter.report(node.id, 'Service task must declare an implementation (EXR-003)');
    }
  }

  return { check };
}
