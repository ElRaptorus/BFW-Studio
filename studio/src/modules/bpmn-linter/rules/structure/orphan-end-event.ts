import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:EndEvent')) {
      return;
    }
    if ((node.incoming?.length ?? 0) === 0) {
      reporter.report(node.id, 'End event has no incoming sequence flow (AST-010)');
    }
  }

  return { check };
}
