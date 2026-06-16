import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const MAX_DEPTH = 3;

export default function checkNestingDepth(analyzer: ProcessModelAnalyzer, severity: RuleSeverityConfig): LintFinding[] {
  const findings: LintFinding[] = [];
  const depth = analyzer.getNestingDepth();

  if (depth > MAX_DEPTH) {
    findings.push({
      ruleId: 'nesting-depth',
      severity: mapToLintSeverity(severity),
      elementId: null,
      elementName: null,
      message: `Subprocess nesting depth of ${depth} exceeds maximum of ${MAX_DEPTH} (AST-211)`,
      why: 'Deep nesting hurts readability and makes error handling, compensation, and transaction reasoning complex.',
      suggestion:
        'Extract deeply nested subprocesses into separate processes called via call activities. Aim for 2–3 nesting levels maximum.',
      category: 'logic-patterns',
    });
  }

  return findings;
}
