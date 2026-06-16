import { type LintFinding, type RuleSeverityConfig, mapToLintSeverity } from '../../types';
import type { ProcessModelAnalyzer } from '../ProcessModelAnalyzer';

const BLOCKLIST = [
  'sap',
  'rest',
  'api',
  'kafka',
  'sql',
  'http',
  'soap',
  'grpc',
  'oracle',
  'salesforce',
  'jira',
  's3',
  'azure',
  'aws',
  'lambda',
  'redis',
  'mongodb',
  'elasticsearch',
  'rabbitmq',
  'activemq',
  'dynamodb',
  'postgres',
  'mysql',
  'mssql',
  'graphql',
  'websocket',
  'smtp',
  'ftp',
  'ldap',
];

const BLOCKLIST_PATTERN = new RegExp(`\\b(${BLOCKLIST.join('|')})\\b`, 'i');

export default function checkSystemIndependentNaming(
  analyzer: ProcessModelAnalyzer,
  severity: RuleSeverityConfig,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const serviceTasks = analyzer.getTasksByType('bpmn:ServiceTask');

  for (const task of serviceTasks) {
    const name = task.name ?? '';
    if (!name) {
      continue;
    }

    const match = name.match(BLOCKLIST_PATTERN);
    if (match) {
      findings.push({
        ruleId: 'system-independent-naming',
        severity: mapToLintSeverity(severity),
        elementId: task.id,
        elementName: task.name,
        message: `Service task "${name}" contains system-specific term "${match[1]}" (AST-101)`,
        why: 'PDA Layer 1 processes must be system-independent. A task name that references a specific backend system couples the business process to that system.',
        suggestion:
          'Rename the task to describe the business action (e.g., "Create Order", "Notify Customer"). The concrete target system is resolved in the Service Contract Interface (Layer 2).',
        category: 'pda-compliance',
      });
    }
  }

  return findings;
}
