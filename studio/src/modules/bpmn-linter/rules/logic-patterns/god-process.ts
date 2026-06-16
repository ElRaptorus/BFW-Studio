import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const DEFAULT_MAX_SEQUENTIAL = 5;

export default function checkGodProcess(analyzer: ProcessModelAnalyzer, severity: RuleSeverityConfig): LintFinding[] {
  const findings: LintFinding[] = [];
  const chains = analyzer.findSequentialChains();
  const elementCount = analyzer.getElementCount();

  let maxTasks = DEFAULT_MAX_SEQUENTIAL;
  if (elementCount > 40) {
    maxTasks = Math.max(maxTasks - 2, 3);
  }

  for (const chain of chains) {
    if (chain.length > maxTasks) {
      const firstElement = analyzer.getElement(chain[0]);
      findings.push({
        ruleId: 'god-process',
        severity: mapToLintSeverity(severity),
        elementId: chain[0],
        elementName: firstElement?.name ?? null,
        message: `Sequential chain of ${chain.length} tasks exceeds threshold of ${maxTasks} (AST-201)`,
        why: 'Long linear task chains suggest a monolithic process that is hard to maintain, test, and reuse. Hidden decisions, error paths, or parallel branches may be buried inside.',
        suggestion:
          'Check whether the chain contains hidden decisions (missing gateways), parallelizable steps, error scenarios, or logically grouped tasks that could be extracted into subprocesses.',
        category: 'logic-patterns',
      });
    }
  }

  return findings;
}
