import { is } from 'bpmnlint-utils';

import { type LintFinding, type ModdleEventDefinition, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

export default function checkTimeoutEscalation(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const userTasks = analyzer.getTasksByType('bpmn:UserTask');

  for (const task of userTasks) {
    const boundaryEvents = analyzer.getBoundaryEvents(task.id);
    const timerBoundaries = boundaryEvents.filter((be) =>
      (be.eventDefinitions ?? []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:TimerEventDefinition')),
    );

    for (const timerBoundary of timerBoundaries) {
      if (timerLeadsDirectlyToEnd(analyzer, timerBoundary.id)) {
        findings.push({
          ruleId: 'timeout-escalation',
          severity: mapToLintSeverity(severity),
          elementId: task.id,
          elementName: task.name,
          message: `Timer boundary on "${task.name ?? task.id}" leads directly to process end without escalation (AST-203)`,
          why: 'A timeout that leads straight to process termination rarely matches real business needs. Typically, timeouts should trigger escalation (reminders, reassignment, manager notification).',
          suggestion:
            'Implement a multi-step escalation chain instead of an immediate end. Consider non-interrupting reminders followed by an interrupting escalation timer.',
          category: 'logic-patterns',
        });
      }
    }
  }

  return findings;
}

function timerLeadsDirectlyToEnd(analyzer: ProcessModelAnalyzer, boundaryEventId: string): boolean {
  const outgoing = analyzer.getOutgoingFlows(boundaryEventId);
  for (const flow of outgoing) {
    const target = analyzer.getElement(flow.targetId);
    if (!target) {
      continue;
    }
    if (target.type === 'bpmn:EndEvent') {
      return true;
    }
    const targetSuccessors = analyzer.getSuccessors(flow.targetId);
    if (targetSuccessors.some((succ) => succ.type === 'bpmn:EndEvent')) {
      return true;
    }
  }
  return false;
}
