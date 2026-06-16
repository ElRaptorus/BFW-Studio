import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const TECHNICAL_PATTERNS = [
  /\b[2-5]\d{2}\b/,
  /\bstatus[_\s]?code\b/i,
  /\bnull\b/i,
  /\bundefined\b/i,
  /\/api\//i,
  /\/v\d\//i,
  /\bSELECT\b/i,
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bWHERE\b/i,
  /\w+\.\w+\.\w+/,
];

export default function checkTechnicalConditions(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const exclusiveGateways = analyzer.getGatewaysByType('bpmn:ExclusiveGateway');
  const inclusiveGateways = analyzer.getGatewaysByType('bpmn:InclusiveGateway');

  for (const gateway of [...exclusiveGateways, ...inclusiveGateways]) {
    const outgoing = analyzer.getOutgoingFlows(gateway.id);

    for (const flow of outgoing) {
      const textsToCheck = [flow.name, flow.conditionExpression].filter(Boolean);

      for (const text of textsToCheck) {
        if (hasTechnicalPattern(text!)) {
          findings.push({
            ruleId: 'technical-conditions',
            severity: mapToLintSeverity(severity),
            elementId: gateway.id,
            elementName: gateway.name,
            message: `Gateway "${gateway.name ?? gateway.id}" has a flow with technical condition language (AST-102)`,
            why: 'Gateway conditions in PDA Layer 1 must be expressed in business language. Technical conditions cannot be validated by business stakeholders. Note: detection is regex-based and may produce false positives.',
            suggestion:
              'Rephrase conditions in business terms (e.g., "Order approved?" instead of "statusCode == 200"). For complex rules, use a Business Rule Task (DMN).',
            category: 'pda-compliance',
          });
          break;
        }
      }
    }
  }

  return findings;
}

function hasTechnicalPattern(text: string): boolean {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
}
