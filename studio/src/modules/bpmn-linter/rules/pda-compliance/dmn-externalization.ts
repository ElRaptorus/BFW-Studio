import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const RULE_LIKE_PATTERNS = [
  /\b(AND|OR)\b.*\b(AND|OR)\b/i,
  /[><=!]+\s*\d+.*\b(AND|OR)\b/i,
  /\w+\.\w+\s*[><=!]+/,
  /\b(if|then|else|when)\b/i,
];

export default function checkDmnExternalization(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const exclusiveGateways = analyzer.getGatewaysByType('bpmn:ExclusiveGateway');
  const inclusiveGateways = analyzer.getGatewaysByType('bpmn:InclusiveGateway');

  for (const gateway of [...exclusiveGateways, ...inclusiveGateways]) {
    const outgoing = analyzer.getOutgoingFlows(gateway.id);

    for (const flow of outgoing) {
      const expression = flow.conditionExpression;
      if (!expression) {
        continue;
      }

      if (hasRuleLikePattern(expression)) {
        findings.push({
          ruleId: 'dmn-externalization',
          severity: mapToLintSeverity(severity),
          elementId: gateway.id,
          elementName: gateway.name,
          message: `Gateway "${gateway.name ?? gateway.id}" contains complex rule logic that could be externalized to DMN (AST-104)`,
          why: 'Business rules hardcoded as gateway conditions can only be changed by modifying the process model. However, reliably distinguishing "too complex" conditions from legitimate inline logic is not possible for a linter.',
          suggestion:
            'Create a Business Rule Task (DMN) before the gateway. The DMN decision table evaluates the rule and stores the result as a process variable.',
          category: 'pda-compliance',
        });
        break;
      }
    }
  }

  return findings;
}

function hasRuleLikePattern(expression: string): boolean {
  return RULE_LIKE_PATTERNS.some((pattern) => pattern.test(expression));
}
