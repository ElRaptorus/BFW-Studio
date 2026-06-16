import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const PARALLELIZABLE_TYPES = new Set(['bpmn:ServiceTask', 'bpmn:ScriptTask', 'bpmn:SendTask', 'bpmn:BusinessRuleTask']);

export default function checkParallelizationPotential(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const chains = analyzer.findSequentialChains();

  for (const chain of chains) {
    for (let idx = 0; idx < chain.length - 1; idx++) {
      const taskA = analyzer.getElement(chain[idx]);
      const taskB = analyzer.getElement(chain[idx + 1]);
      if (!taskA || !taskB) {
        continue;
      }

      if (!PARALLELIZABLE_TYPES.has(taskA.type) || !PARALLELIZABLE_TYPES.has(taskB.type)) {
        continue;
      }

      if (analyzer.hasDataOutputAssociation(taskA.id) && analyzer.hasDataInputAssociation(taskB.id)) {
        continue;
      }

      findings.push({
        ruleId: 'parallelization-potential',
        severity: mapToLintSeverity(severity),
        elementId: taskA.id,
        elementName: taskA.name,
        message: `"${taskA.name ?? taskA.id}" and "${taskB.name ?? taskB.id}" may be parallelizable (AST-204)`,
        why: 'Unnecessary sequential execution of independent tasks increases process latency. Explicit parallelism via parallel gateways makes independence visible.',
        suggestion:
          'If the tasks are truly independent, wrap them in a parallel gateway. If there are dependencies, make them explicit with data associations.',
        category: 'logic-patterns',
      });
    }
  }

  return findings;
}
