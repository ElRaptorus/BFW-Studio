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

function getStandardLoop(node: ModdleNode): ModdleNode | undefined {
  if (!isAny(node, ACTIVITY_TYPES)) {
    return undefined;
  }
  const loop = node.loopCharacteristics as ModdleNode | undefined;
  return loop != null && is(loop, 'bpmn:StandardLoopCharacteristics') ? loop : undefined;
}

function getLoopMaximum(loop: ModdleNode): string | undefined {
  const loopMaximum = loop.loopMaximum != null ? String(loop.loopMaximum).trim() : '';
  return loopMaximum === '' ? undefined : loopMaximum;
}

/**
 * Standard loop settings the Engine rejects at deploy time: a missing loop
 * condition or a loopMaximum that is not a positive integer.
 */
export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    const loop = getStandardLoop(node);
    if (loop == null) {
      return;
    }

    const loopCondition = loop.loopCondition as ModdleNode | undefined;
    const conditionBody = loopCondition?.body != null ? String(loopCondition.body) : undefined;
    if (conditionBody == null || conditionBody.trim() === '') {
      reporter.report(node.id, 'Standard Loop must define a loop condition (EXR-013)');
    }

    const loopMaximum = getLoopMaximum(loop);
    if (loopMaximum != null) {
      const parsed = parseInt(loopMaximum, 10);
      if (isNaN(parsed) || parsed <= 0) {
        reporter.report(node.id, 'loopMaximum must be a positive integer (EXR-013)');
      }
    }
  }

  return { check };
}

/**
 * Advice: a standard loop without loopMaximum has no safety cap on iterations.
 */
export function standardLoopMaximum() {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    const loop = getStandardLoop(node);
    if (loop != null && getLoopMaximum(loop) == null) {
      reporter.report(
        node.id,
        'Standard Loop has no maximum iteration limit — consider adding loopMaximum as a safety guard (EXR-013)',
      );
    }
  }

  return { check };
}
