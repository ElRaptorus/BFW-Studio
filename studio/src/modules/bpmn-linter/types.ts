// ---------------------------------------------------------------------------
// BPMN Moddle Types
// ---------------------------------------------------------------------------
// Lightweight structural interfaces for the moddle element shapes the linter
// accesses. These are NOT the full bpmn-moddle schema; they only model the
// properties actually read by linter code. The index signature allows access
// to BPMN properties not explicitly listed (returns `unknown`, not `any`).

export interface ModdleEventDefinition {
  readonly $type: string;
  readonly id?: string;
  [property: string]: unknown;
}

export interface ModdleFormalExpression {
  readonly $type: string;
  readonly body?: string;
  [property: string]: unknown;
}

export interface ModdleNode {
  readonly $type: string;
  readonly id: string;
  readonly name?: string;
  readonly $parent?: ModdleNode;
  readonly $attrs?: Record<string, string>;

  readonly eventDefinitions?: ModdleEventDefinition[];

  readonly incoming?: ModdleNode[];
  readonly outgoing?: ModdleNode[];

  readonly flowElements?: ModdleNode[];
  readonly triggeredByEvent?: boolean;
  readonly isForCompensation?: boolean;

  readonly sourceRef?: ModdleNode;
  readonly targetRef?: ModdleNode;
  readonly conditionExpression?: ModdleFormalExpression;

  readonly attachedToRef?: ModdleNode;

  readonly default?: ModdleNode;

  [property: string]: unknown;
}

export interface ModdleDefinitions {
  readonly $type: 'bpmn:Definitions';
  readonly rootElements: ModdleNode[];
  [property: string]: unknown;
}

// ---------------------------------------------------------------------------
// bpmnlint Library Types
// ---------------------------------------------------------------------------

export interface BpmnlintReporter {
  report(id: string, message: string): void;
}

export type BpmnlintCheckFn = (node: ModdleNode, reporter: BpmnlintReporter) => void;

export type BpmnlintRuleDefinition = {
  check: BpmnlintCheckFn | Record<string, BpmnlintCheckFn>;
};

export type BpmnlintRuleFactory = () => BpmnlintRuleDefinition;

export type BpmnlintReport = {
  id: string;
  message: string;
};

export type BpmnlintConfig = {
  rules: Record<string, string | number>;
};

export type BpmnlintResolver = {
  resolveRule(pkg: string, ruleName: string): BpmnlintRuleFactory | null;
  resolveConfig(pkg: string, configName: string): null;
};

// ---------------------------------------------------------------------------
// Diagram Origin Detection
// ---------------------------------------------------------------------------

export type BpmnOriginKind = 'bfw-engine' | 'foreign' | 'unknown';

export interface BpmnDiagramOrigin {
  readonly origin: BpmnOriginKind;
  readonly provider: string;
}

// ---------------------------------------------------------------------------
// Linter Domain Types
// ---------------------------------------------------------------------------

export type LintSeverity = 'error' | 'warning' | 'info';

export type LintCategory =
  'structure' | 'bpmn-spec' | 'execution-readiness' | 'logic-patterns' | 'naming-quality' | 'pda-compliance';

export type LintFinding = {
  ruleId: string;
  severity: LintSeverity;
  elementId: string | null;
  elementName: string | null;
  message: string;
  why: string;
  suggestion: string;
  category: LintCategory;
};

export type RuleSeverityConfig = 'error' | 'warn' | 'info' | 'off';

export type ScorePolicy = {
  /** Minimum percent (inclusive) for green / fully compliant when instant rules do not override. */
  validMinPercent: number;
  /** Minimum percent (inclusive) to avoid failed (red); between risky and valid → orange. */
  riskyMinPercent: number;
  /** If true, any error-level finding forces failed compliance. */
  instantFailOnAnyError: boolean;
  /** If true, any warning with zero errors forces risky compliance. */
  instantRiskOnAnyWarning: boolean;
};

export type LintScoreComplianceStatus = 'valid' | 'risky' | 'failed';

export type LintScoreSnapshot = {
  /** Persisted schema / calculation version */
  schemaVersion: number;
  maxPoints: number;
  penaltyPoints: number;
  errorPenaltyPoints: number;
  warningPenaltyPoints: number;
  remainingPoints: number;
  /** Full precision 0–100 */
  scorePercent: number;
  /** One decimal, e.g. "95.5%" */
  scorePercentDisplay: string;
  errorElementCount: number;
  warningOnlyElementCount: number;
  rawFindingErrors: number;
  rawFindingWarnings: number;
  errorPenaltyPercentOfTotal: number;
  warningPenaltyPercentOfTotal: number;
  complianceStatus: LintScoreComplianceStatus;
  reasonCodes: string[];
  scorePolicyUsed: ScorePolicy;
  usesDiagramBucket: boolean;
};

export type LintProfileConfig = {
  rules: Record<string, RuleSeverityConfig>;
  /** Optional per-profile linter score thresholds and instant rules. */
  scorePolicy?: ScorePolicy;
};

export type RuleMetadata = {
  category: LintCategory;
  why: string;
  suggestion: string;
};

export type FindingCounts = {
  errors: number;
  warnings: number;
  infos: number;
};

export type CustomRulesetEntry = {
  base: string;
  rules: Record<string, RuleSeverityConfig>;
};

/**
 * Public API surface of the LintBridge diagram-js service,
 * used by panes, initializers, and palette providers via
 * `getModelerComponentByName<LintBridgeApi>('lintBridge')`.
 */
export interface LintBridgeApi {
  isActive(): boolean;
  toggle(): void;
  getFindings(): LintFinding[];
  getCounts(): FindingCounts;
  getLintScoreSnapshot(): LintScoreSnapshot | null;
  getActiveProfile(): string;
  getAvailableProfiles(): { id: string; label: string; isCustom: boolean }[];
  selectElement(elementId: string, addToSelection?: boolean): void;
  highlightElement(elementId: string): void;
  unhighlightElement(elementId: string): void;
  getSelectedElementIds(): string[];
  getDiagramOrigin(): BpmnDiagramOrigin | null;
  isForeignDiagramLintingBlocked(): boolean;
  allowForeignLinting(): void;
}

/**
 * Maps a config-level severity (`RuleSeverityConfig`) to a finding-level
 * severity (`LintSeverity`). The config uses `'warn'` while findings use
 * `'warning'`; this helper bridges that gap without `as any` casts.
 */
export function mapToLintSeverity(config: RuleSeverityConfig): LintSeverity {
  if (config === 'warn') {
    return 'warning';
  }
  if (config === 'error' || config === 'info') {
    return config;
  }
  return 'warning';
}
