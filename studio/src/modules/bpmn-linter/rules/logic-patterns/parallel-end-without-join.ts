import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

export default function checkParallelEndWithoutJoin(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const parallelGateways = analyzer.getGatewaysByType('bpmn:ParallelGateway');

  const hasFork = parallelGateways.some((gw) => analyzer.getOutgoingFlows(gw.id).length > 1);
  if (!hasFork) {
    return findings;
  }

  const endEvents = analyzer.getFlowElements().filter((el) => el.type === 'bpmn:EndEvent');
  const untypedEndEvents = endEvents.filter((el) => !el.node.eventDefinitions || el.node.eventDefinitions.length === 0);
  if (untypedEndEvents.length <= 1) {
    return findings;
  }

  const hasJoin = parallelGateways.some((gw) => analyzer.getIncomingFlows(gw.id).length > 1);
  if (hasJoin) {
    return findings;
  }

  findings.push({
    ruleId: 'parallel-end-without-join',
    severity: mapToLintSeverity(severity),
    elementId: null,
    elementName: null,
    message: `Process has a parallel fork with ${untypedEndEvents.length} separate end events but no parallel join (AST-216)`,
    why: "When parallel branches each reach their own end event without synchronization, the engine's behavior depends on token semantics. Explicit synchronization removes ambiguity.",
    suggestion: 'Add a parallel join gateway to synchronize all branches before a single end event.',
    category: 'logic-patterns',
  });

  return findings;
}
