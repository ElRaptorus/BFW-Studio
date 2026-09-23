import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (isAny(node, ['bpmn:SendTask', 'bpmn:ReceiveTask'])) {
      if (!(node.messageRef as ModdleNode | undefined)) {
        const taskLabel = is(node, 'bpmn:SendTask') ? 'Send task' : 'Receive task';
        reporter.report(node.id, `${taskLabel} must reference a message (EXR-007)`);
      }
      return;
    }
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
