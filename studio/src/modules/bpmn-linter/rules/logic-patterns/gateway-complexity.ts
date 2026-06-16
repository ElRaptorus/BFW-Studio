import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const DEFAULT_MAX_PATHS = 4;

export default function checkGatewayComplexity(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const exclusive = analyzer.getGatewaysByType('bpmn:ExclusiveGateway');
  const inclusive = analyzer.getGatewaysByType('bpmn:InclusiveGateway');

  for (const gateway of [...exclusive, ...inclusive]) {
    const outCount = analyzer.getOutgoingFlows(gateway.id).length;
    if (outCount > DEFAULT_MAX_PATHS) {
      findings.push({
        ruleId: 'gateway-complexity',
        severity: mapToLintSeverity(severity),
        elementId: gateway.id,
        elementName: gateway.name,
        message: `Gateway "${gateway.name ?? gateway.id}" has ${outCount} outgoing paths (max ${DEFAULT_MAX_PATHS}) (AST-206)`,
        why: 'A gateway with many branches is difficult to test exhaustively. Complex branching logic often belongs in a DMN decision table.',
        suggestion:
          'Extract complex decision logic into a Business Rule Task (DMN). Alternatively, cascade gateways to reduce individual complexity.',
        category: 'logic-patterns',
      });
    }
  }

  return findings;
}
