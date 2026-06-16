import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:MessageEventDefinition')) {
      return;
    }
    if (!(node.messageRef as ModdleNode | undefined)) {
      const parent = node.$parent;
      reporter.report(parent?.id ?? node.id, 'Message event definition should reference a message (EXR-007)');
    }
  }

  return { check };
}
