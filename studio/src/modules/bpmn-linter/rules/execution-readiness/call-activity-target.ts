import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:CallActivity')) {
      return;
    }
    if (!(node.calledElement as string | undefined)) {
      reporter.report(node.id, 'Call activity should declare calledElement (EXR-009)');
    }
  }

  return { check };
}
