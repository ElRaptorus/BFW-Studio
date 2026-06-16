import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

export default function checkCanonicalDataFlow(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const serviceTasks = analyzer.getTasksByType('bpmn:ServiceTask');

  for (const task of serviceTasks) {
    const hasInput = analyzer.hasDataInputAssociation(task.id);
    const hasOutput = analyzer.hasDataOutputAssociation(task.id);

    if (!hasInput && !hasOutput) {
      findings.push({
        ruleId: 'canonical-data-flow',
        severity: mapToLintSeverity(severity),
        elementId: task.id,
        elementName: task.name,
        message: `Service task "${task.name ?? task.id}" has no data associations (AST-106)`,
        why: "Without explicit data flow, it's unclear what data the service task consumes and produces. This information is essential for the PDA canonical data model.",
        suggestion:
          'Define Data Input/Output Associations for the service task using Data Objects with canonical business terms (e.g., "Customer Order", "Invoice").',
        category: 'pda-compliance',
      });
    }
  }

  return findings;
}
