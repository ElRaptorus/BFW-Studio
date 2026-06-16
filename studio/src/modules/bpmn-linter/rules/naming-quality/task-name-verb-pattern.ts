import { isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const TASK_TYPES = [
  'bpmn:Task',
  'bpmn:ServiceTask',
  'bpmn:UserTask',
  'bpmn:ScriptTask',
  'bpmn:BusinessRuleTask',
  'bpmn:ManualTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
];

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!isAny(node, TASK_TYPES)) {
      return;
    }
    const name = (node.name || '').trim();
    if (!name) {
      return;
    }
    if (!/\s/.test(name)) {
      reporter.report(node.id, 'Task name should use a verb + object pattern (multiple words) (NMQ-003)');
    }
  }

  return { check };
}
