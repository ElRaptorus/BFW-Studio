import { is } from 'bpmnlint-utils';

import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const TECHNICAL_PATTERNS = [
  /\.json$/i,
  /\.xml$/i,
  /\.csv$/i,
  /^tbl_/i,
  /^sys_/i,
  /^api_/i,
  /_response$/i,
  /_request$/i,
  /_dto$/i,
  /_payload$/i,
  /_entity$/i,
  /_model$/i,
  /_schema$/i,
  /\bJSON\b/,
  /\bXML\b/,
  /\bDTO\b/,
];

export default function checkCanonicalDataNaming(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const elements = analyzer.getFlowElements();

  for (const element of elements) {
    if (!is(element.node, 'bpmn:DataObjectReference') && !is(element.node, 'bpmn:DataStoreReference')) {
      continue;
    }

    const name = element.name ?? '';
    if (!name) {
      continue;
    }

    if (hasTechnicalName(name)) {
      findings.push({
        ruleId: 'canonical-data-naming',
        severity: mapToLintSeverity(severity),
        elementId: element.id,
        elementName: element.name,
        message: `Data element "${name}" uses a technical or system-specific name (AST-103)`,
        why: 'The PDA canonical data model uses business vocabulary. System-specific data names couple the process to backend data structures.',
        suggestion:
          'Rename using business terms (e.g., "Customer Order" instead of "SAP_SO_Response"). The mapping to system-specific data formats happens in the Mapper (Layer 3).',
        category: 'pda-compliance',
      });
    }
  }

  return findings;
}

function hasTechnicalName(name: string): boolean {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(name));
}
