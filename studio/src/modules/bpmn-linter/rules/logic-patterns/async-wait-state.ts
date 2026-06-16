import { is } from 'bpmnlint-utils';

import { type LintFinding, type ModdleEventDefinition, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

export default function checkAsyncWaitState(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];

  const sendTasks = analyzer.getTasksByType('bpmn:SendTask');
  for (const task of sendTasks) {
    if (!hasWaitStateSuccessor(analyzer, task.id)) {
      findings.push(createFinding(task.id, task.name, severity));
    }
  }

  const throwEvents = analyzer
    .getFlowElements()
    .filter(
      (el) =>
        el.type === 'bpmn:IntermediateThrowEvent' &&
        (el.node.eventDefinitions ?? []).some((ed: ModdleEventDefinition) => is(ed, 'bpmn:MessageEventDefinition')),
    );
  for (const event of throwEvents) {
    if (!hasWaitStateSuccessor(analyzer, event.id)) {
      findings.push(createFinding(event.id, event.name, severity));
    }
  }

  return findings;
}

function hasWaitStateSuccessor(analyzer: ProcessModelAnalyzer, elementId: string): boolean {
  const successors = analyzer.getSuccessors(elementId);
  return successors.some((succ) => succ.type === 'bpmn:IntermediateCatchEvent' || succ.type === 'bpmn:ReceiveTask');
}

function createFinding(elementId: string, elementName: string | null, severity: RuleSeverityConfig): LintFinding {
  return {
    ruleId: 'async-wait-state',
    severity: mapToLintSeverity(severity),
    elementId,
    elementName,
    message: `"${elementName ?? elementId}" sends a message without a corresponding catch (AST-205)`,
    why: 'An async send without a wait state may be fire-and-forget or indicate a missing catch. If a response is expected, the absent catch creates a modelling gap.',
    suggestion:
      'If a response is expected, add a message intermediate catch event or receive task after the send. If fire-and-forget is intentional, no action is needed.',
    category: 'logic-patterns',
  };
}
