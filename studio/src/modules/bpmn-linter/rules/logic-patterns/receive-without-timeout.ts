import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

export default function checkReceiveWithoutTimeout(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];

  const receiveTasks = analyzer.getTasksByType('bpmn:ReceiveTask');
  for (const task of receiveTasks) {
    if (!analyzer.hasTimerBoundary(task.id)) {
      findings.push(createFinding(task.id, task.name, severity));
    }
  }

  return findings;
}

function createFinding(elementId: string, elementName: string | null, severity: RuleSeverityConfig): LintFinding {
  return {
    ruleId: 'receive-without-timeout',
    severity: mapToLintSeverity(severity),
    elementId,
    elementName,
    message: `"${elementName ?? elementId}" waits for an external message without a timer boundary (AST-213)`,
    why: 'If the external sender fails or the message is lost, the process waits indefinitely without a timeout.',
    suggestion:
      'Add a timer boundary event with a retry or escalation path. Define appropriate timeout values based on the expected response time.',
    category: 'logic-patterns',
  };
}
