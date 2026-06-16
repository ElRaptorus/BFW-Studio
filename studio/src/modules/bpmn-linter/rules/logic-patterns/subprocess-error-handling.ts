import { is } from 'bpmnlint-utils';

import {
  type LintFinding,
  type ModdleEventDefinition,
  type ModdleNode,
  type RuleSeverityConfig,
  mapToLintSeverity,
} from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

function scopeHasErrorEventSubprocess(container: ModdleNode): boolean {
  for (const el of container.flowElements || []) {
    if (
      is(el, 'bpmn:SubProcess') &&
      el.triggeredByEvent &&
      (el.flowElements || []).some(
        (child: ModdleNode) =>
          is(child, 'bpmn:StartEvent') &&
          (child.eventDefinitions || []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:ErrorEventDefinition')),
      )
    ) {
      return true;
    }
  }
  return false;
}

export default function checkSubprocessErrorHandling(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];

  const serviceTaskCount =
    analyzer.getTasksByType('bpmn:ServiceTask').length + analyzer.getTasksByType('bpmn:CallActivity').length;
  if (serviceTaskCount === 0) {
    return findings;
  }

  for (const subprocess of analyzer.getSubprocesses()) {
    if (subprocess.triggeredByEvent) {
      continue;
    }
    if (analyzer.hasErrorBoundary(subprocess.id)) {
      continue;
    }
    if (subprocess.$parent && scopeHasErrorEventSubprocess(subprocess.$parent)) {
      continue;
    }
    findings.push({
      ruleId: 'subprocess-error-handling',
      severity: mapToLintSeverity(severity),
      elementId: subprocess.id,
      elementName: subprocess.name ?? null,
      message: `Subprocess "${subprocess.name ?? subprocess.id}" has no error boundary event (AST-207)`,
      why: 'Service task errors inside a subprocess may propagate to the parent process unhandled. Local error handling within the subprocess provides better control.',
      suggestion:
        'Add an error boundary event to the subprocess, an error end event inside, or an error event subprocess for specific error types.',
      category: 'logic-patterns',
    });
  }

  return findings;
}
