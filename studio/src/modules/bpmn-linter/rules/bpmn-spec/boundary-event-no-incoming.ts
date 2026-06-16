import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:BoundaryEvent')) {
      return;
    }
    if ((node.incoming?.length ?? 0) > 0) {
      reporter.report(node.id, 'Boundary event must not have incoming sequence flows (BSC-009)');
    }
  }

  return { check };
}
