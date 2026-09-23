import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleEventDefinition, ModdleNode } from '../../types';

function hasNonBlankBody(expression: unknown): boolean {
  if (typeof expression === 'string') {
    return expression.trim() !== '';
  }
  const body = (expression as { body?: unknown } | undefined)?.body;
  return body != null && String(body).trim() !== '';
}

function hasTimerBody(definition: ModdleEventDefinition): boolean {
  return ['timeDate', 'timeDuration', 'timeCycle'].some((property) => hasNonBlankBody(definition[property]));
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:TimerEventDefinition')) {
      return;
    }
    if (hasTimerBody(node)) {
      return;
    }
    const parent = node.$parent;
    const reportId = parent?.id ?? node.id;
    reporter.report(reportId, 'Timer must define timeDate, timeDuration, or timeCycle (AST-004)');
  }

  return { check };
}
