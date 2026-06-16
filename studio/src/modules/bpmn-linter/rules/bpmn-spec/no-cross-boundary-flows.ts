import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:SequenceFlow')) {
      return;
    }
    const sourceParent = node.sourceRef?.$parent;
    const targetParent = node.targetRef?.$parent;
    if (sourceParent && targetParent && sourceParent !== targetParent) {
      reporter.report(node.id, 'Sequence flow must not cross sub-process or process boundary (BSC-010)');
    }
  }

  return { check };
}
