import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

export default function checkUserTaskWithoutTimer(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const userTasks = analyzer.getTasksByType('bpmn:UserTask');

  for (const task of userTasks) {
    if (!analyzer.hasTimerBoundary(task.id)) {
      findings.push({
        ruleId: 'user-task-without-timer',
        severity: mapToLintSeverity(severity),
        elementId: task.id,
        elementName: task.name,
        message: `User task "${task.name ?? task.id}" has no timer boundary event (AST-212)`,
        why: 'User tasks without timers have no SLA enforcement. A human task could remain unhandled indefinitely.',
        suggestion:
          'Add a non-interrupting timer boundary for reminders and an interrupting timer for escalation (e.g., reassignment after timeout).',
        category: 'logic-patterns',
      });
    }
  }

  return findings;
}
