import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const INTEGRATION_INDICATORS = [
  'sync',
  'transform',
  'map',
  'convert',
  'parse',
  'serialize',
  'validate schema',
  'marshal',
  'unmarshal',
  'encode',
  'decode',
  'extract',
  'enrich',
  'translate',
];

const INTEGRATION_PATTERN = new RegExp(`\\b(${INTEGRATION_INDICATORS.join('|')})\\b`, 'i');

export default function checkLayerSeparation(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const tasks = analyzer.getTasks();

  let hasIntegrationTask = false;
  let hasBusinessTask = false;

  for (const task of tasks) {
    if (isIntegrationTask(task)) {
      hasIntegrationTask = true;
    } else {
      hasBusinessTask = true;
    }

    if (hasIntegrationTask && hasBusinessTask) {
      break;
    }
  }

  if (hasIntegrationTask && hasBusinessTask) {
    findings.push({
      ruleId: 'layer-separation',
      severity: mapToLintSeverity(severity),
      elementId: null,
      elementName: null,
      message: 'Process mixes business logic tasks with integration tasks (AST-105)',
      why: 'PDA separates Layer 1 (business logic) from Layer 2 (integration logic). A process containing both is not system-independent and mixes concerns.',
      suggestion:
        'Move integration tasks into a separate integration process (Layer 2) or into the Service Contract Implementation. The Layer 1 process should only describe the business workflow.',
      category: 'pda-compliance',
    });
  }

  return findings;
}

function isIntegrationTask(task: { type: string; name: string | null }): boolean {
  if (task.type === 'bpmn:ScriptTask') {
    return true;
  }
  const name = task.name ?? '';
  return INTEGRATION_PATTERN.test(name);
}
