import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const THRESHOLD_INFO = 30;
const THRESHOLD_WARN = 50;

export default function checkProcessComplexity(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const cfc = analyzer.getControlFlowComplexity();

  if (cfc > THRESHOLD_WARN) {
    findings.push(createFinding(cfc, `CFC of ${cfc} is very high (> ${THRESHOLD_WARN})`, severity));
  } else if (cfc > THRESHOLD_INFO) {
    findings.push(createFinding(cfc, `CFC of ${cfc} exceeds recommended threshold of ${THRESHOLD_INFO}`, severity));
  }

  return findings;
}

function createFinding(cfc: number, message: string, severity: RuleSeverityConfig): LintFinding {
  return {
    ruleId: 'process-complexity',
    severity: mapToLintSeverity(severity),
    elementId: null,
    elementName: null,
    message: `${message} (AST-209)`,
    why: 'High control flow complexity correlates with error-prone, hard-to-maintain processes. Each additional gateway branch increases the number of execution paths exponentially.',
    suggestion:
      'Decompose complex processes into subprocesses or call activities. Replace multi-branch gateways with DMN decision tables. Target CFC < 30.',
    category: 'logic-patterns',
  };
}
