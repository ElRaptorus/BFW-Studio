import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const STATE_CHANGING_VERBS = [
  'create',
  'update',
  'delete',
  'send',
  'book',
  'charge',
  'submit',
  'cancel',
  'approve',
  'reject',
  'anlegen',
  'ändern',
  'löschen',
  'buchen',
  'senden',
  'stornieren',
];

export default function checkMissingCompensation(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const serviceTasks = analyzer.getTasksByType('bpmn:ServiceTask');

  for (const task of serviceTasks) {
    const name = (task.name ?? '').toLowerCase();
    const hasStateChangingVerb = STATE_CHANGING_VERBS.some((verb) => name.includes(verb));
    if (!hasStateChangingVerb) {
      continue;
    }

    if (analyzer.hasCompensationBoundary(task.id)) {
      continue;
    }

    const successors = analyzer.getSuccessors(task.id);
    const hasServiceSuccessor = successors.some((succ) =>
      ['bpmn:ServiceTask', 'bpmn:CallActivity', 'bpmn:SendTask'].includes(succ.type),
    );
    if (!hasServiceSuccessor) {
      continue;
    }

    findings.push({
      ruleId: 'missing-compensation',
      severity: mapToLintSeverity(severity),
      elementId: task.id,
      elementName: task.name,
      message: `Service task "${task.name ?? task.id}" performs a state-changing operation without compensation (AST-202)`,
      why: 'Without compensation, partial side effects remain when a successor step fails. The process may leave data in an inconsistent state.',
      suggestion:
        'Add a compensation boundary event handler that reverses the action. Alternatively, use error boundary events with manual recovery or implement a saga pattern at the engine level.',
      category: 'logic-patterns',
    });
  }

  return findings;
}
