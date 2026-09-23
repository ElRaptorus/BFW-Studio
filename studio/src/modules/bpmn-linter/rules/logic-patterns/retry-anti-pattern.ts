import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const GATEWAY_TYPES = new Set(['bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway']);

export default function checkRetryAntiPattern(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const serviceTasks = analyzer.getTasksByType('bpmn:ServiceTask');

  for (const task of serviceTasks) {
    const successors = analyzer.getSuccessors(task.id);

    for (const succ of successors) {
      if (!GATEWAY_TYPES.has(succ.type)) {
        continue;
      }
      const gatewayOutgoing = analyzer.getOutgoingFlows(succ.id);
      const loopsBack = gatewayOutgoing.some((flow) => flow.targetId === task.id);
      if (loopsBack) {
        findings.push({
          ruleId: 'retry-anti-pattern',
          severity: mapToLintSeverity(severity),
          elementId: task.id,
          elementName: task.name,
          message: `Service task "${task.name ?? task.id}" has a BPMN-level retry loop via gateway (AST-215)`,
          why: 'BPMN-level loops for technical retries clutter the diagram. The Engine has no automatic task retries: a failed task makes the process instance fatal, and a retry is a manual process-instance retry.',
          suggestion:
            'Retry technical failures inside the service task handler. Reserve BPMN retry loops for business-level retries.',
          category: 'logic-patterns',
        });
        break;
      }
    }
  }

  return findings;
}
