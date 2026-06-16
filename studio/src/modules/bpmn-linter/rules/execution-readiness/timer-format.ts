import { is } from 'bpmnlint-utils';

import type { BpmnlintReporter, ModdleNode } from '../../types';

function exprBody(expr: unknown): string {
  if (!expr) {
    return '';
  }
  if (typeof expr === 'string') {
    return expr.trim();
  }
  if (typeof expr === 'object' && expr !== null && 'body' in expr) {
    const body = (expr as { body?: unknown }).body;
    return typeof body === 'string' ? body.trim() : '';
  }
  return '';
}

export default function () {
  function check(node: ModdleNode, reporter: BpmnlintReporter) {
    if (!is(node, 'bpmn:TimerEventDefinition')) {
      return;
    }
    const parent = node.$parent;
    const reportId = parent?.id ?? node.id;

    for (const prop of ['timeDate', 'timeDuration', 'timeCycle'] as const) {
      const val = node[prop];
      if (!val) {
        continue;
      }
      const text = exprBody(val);
      if (!text) {
        reporter.report(reportId, `Timer ${prop} must not be empty (EXR-005)`);
      }
    }
  }

  return { check };
}
