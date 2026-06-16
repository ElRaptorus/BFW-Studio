import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

export default function checkTransactionWithoutCompensation(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];

  const allElements = analyzer.getFlowElements();
  const hasAnyCompensation = allElements.some((el) => analyzer.hasCompensationBoundary(el.id));
  if (hasAnyCompensation) {
    return findings;
  }

  const serviceCount =
    analyzer.getTasksByType('bpmn:ServiceTask').length + analyzer.getTasksByType('bpmn:CallActivity').length;
  if (serviceCount < 2) {
    return findings;
  }

  for (const subprocess of analyzer.getSubprocesses()) {
    if (subprocess.triggeredByEvent) {
      continue;
    }
    findings.push({
      ruleId: 'transaction-without-compensation',
      severity: mapToLintSeverity(severity),
      elementId: subprocess.id,
      elementName: subprocess.name ?? null,
      message: `Subprocess "${subprocess.name ?? subprocess.id}" has no compensation handling in a process with multiple service tasks (AST-214)`,
      why: 'Multiple state-changing steps without rollback capability risk data inconsistency on failure.',
      suggestion:
        'Add compensation boundary events and handlers for critical state changes. Consider using a transaction subprocess or saga pattern for multi-step operations.',
      category: 'logic-patterns',
    });
  }

  return findings;
}
