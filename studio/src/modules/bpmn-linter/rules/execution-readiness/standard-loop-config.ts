import { is, isAny } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

const ACTIVITY_TYPES = [
  'bpmn:Task',
  'bpmn:ServiceTask',
  'bpmn:UserTask',
  'bpmn:ScriptTask',
  'bpmn:ReceiveTask',
  'bpmn:SendTask',
  'bpmn:ManualTask',
  'bpmn:BusinessRuleTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess',
];

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!isAny(node, ACTIVITY_TYPES)) {
      return;
    }
    const loop = node.loopCharacteristics as ModdleNode | undefined;
    if (loop == null || !is(loop, 'bpmn:StandardLoopCharacteristics')) {
      return;
    }

    const loopCondition = loop.loopCondition as ModdleNode | undefined;
    const conditionBody = loopCondition?.body != null ? String(loopCondition.body) : undefined;
    if (conditionBody == null || conditionBody.trim() === '') {
      reporter.report(node.id, 'Standard Loop must define a loop condition (EXR-013)');
    }

    const loopMaximum = loop.loopMaximum != null ? String(loop.loopMaximum) : undefined;
    if (loopMaximum != null && loopMaximum.trim() !== '') {
      const parsed = parseInt(loopMaximum.trim(), 10);
      if (isNaN(parsed) || parsed <= 0) {
        reporter.report(node.id, 'loopMaximum must be a positive integer (EXR-013)');
      }
    } else {
      reporter.report(
        node.id,
        'Standard Loop has no maximum iteration limit — consider adding loopMaximum as a safety guard (EXR-013)',
      );
    }
  }

  return { check };
}
