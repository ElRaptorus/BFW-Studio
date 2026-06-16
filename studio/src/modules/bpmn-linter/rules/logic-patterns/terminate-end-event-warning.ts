import { is } from 'bpmnlint-utils';

import { type LintFinding, type ModdleEventDefinition, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

export default function checkTerminateEndEventWarning(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const endEvents = analyzer.getFlowElements().filter((el) => el.type === 'bpmn:EndEvent');

  for (const event of endEvents) {
    const hasTerminate = (event.node.eventDefinitions ?? []).some((ed: ModdleEventDefinition) =>
      is(ed, 'bpmn:TerminateEventDefinition'),
    );
    if (hasTerminate) {
      findings.push({
        ruleId: 'terminate-end-event-warning',
        severity: mapToLintSeverity(severity),
        elementId: event.id,
        elementName: event.name,
        message: `End event "${event.name ?? event.id}" uses a terminate event definition (AST-217)`,
        why: 'A terminate end event kills all tokens in the current scope immediately — no compensation, no cleanup, no graceful shutdown.',
        suggestion:
          'Prefer normal end events or error end events for controlled shutdown. Use terminate end events only for deliberate hard-abort scenarios.',
        category: 'logic-patterns',
      });
    }
  }

  return findings;
}
