import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const THRESHOLD_INFO = 30;
const THRESHOLD_WARN = 50;

export default function checkProcessSize(analyzer: ProcessModelAnalyzer, severity: RuleSeverityConfig): LintFinding[] {
  const findings: LintFinding[] = [];
  const count = analyzer.getElementCount();

  if (count > THRESHOLD_WARN) {
    findings.push(createFinding(count, `Process has ${count} elements (> ${THRESHOLD_WARN})`, severity));
  } else if (count > THRESHOLD_INFO) {
    findings.push(createFinding(count, `Process has ${count} elements (> ${THRESHOLD_INFO})`, severity));
  }

  return findings;
}

function createFinding(count: number, message: string, severity: RuleSeverityConfig): LintFinding {
  return {
    ruleId: 'process-size',
    severity: mapToLintSeverity(severity),
    elementId: null,
    elementName: null,
    message: `${message} (AST-210)`,
    why: 'The "7 Process Modelling Guidelines" recommend processes with approximately 30 elements. Larger processes are harder to understand and maintain.',
    suggestion:
      'Extract related groups of activities into subprocesses or call activities. Aim for ~30 elements per diagram level.',
    category: 'logic-patterns',
  };
}
