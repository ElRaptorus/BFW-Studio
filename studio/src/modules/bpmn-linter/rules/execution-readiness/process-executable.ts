import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:Process')) {
      return;
    }
    if (!(node.isExecutable as boolean | undefined)) {
      reporter.report(node.id, 'Process should be marked executable (EXR-001)');
    }
  }

  return { check };
}
