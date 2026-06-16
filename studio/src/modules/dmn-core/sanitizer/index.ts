export type {
  DmnSanitizableIssue,
  DmnSanitizerIssueType,
  DmnSanitizerIssueTypeDiscriminant,
  DmnSanitizerIssueCategory,
  DmnSanitizerIssueSeverity,
} from './sanitizerTypes';

export { analyzeDmnSanitizableIssues, type ModdleParseWarning } from './DmnSanitizerAnalyzer';
export { buildDmnSanitizerFixCommands } from './DmnSanitizerFixer';

export type { DmnSanitizableIssueDescription } from './sanitizerIssueDescriptions';
export { issueDescriptions, CATEGORY_LABELS, CATEGORY_SEVERITY_ORDER } from './sanitizerIssueDescriptions';
