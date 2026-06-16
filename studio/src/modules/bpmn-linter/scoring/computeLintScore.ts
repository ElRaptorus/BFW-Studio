import type { LintFinding, LintScoreComplianceStatus, LintScoreSnapshot, LintSeverity, ScorePolicy } from '../types';
import { DIAGRAM_BUCKET_ID, countScorableElements, resolveFindingBucketId } from './isScorableElement';

export const LINT_SCORE_SCHEMA_VERSION = 1;

const DEFAULT_POLICY: ScorePolicy = {
  validMinPercent: 85,
  riskyMinPercent: 60,
  instantFailOnAnyError: false,
  instantRiskOnAnyWarning: false,
};

export type ComputeLintScoreInput = {
  findings: LintFinding[];
  elementRegistry: { getAll: () => unknown[]; get: (id: string) => unknown | undefined };
  rootElementId: string | null;
  scorePolicy?: Partial<ScorePolicy> | null;
};

function mergePolicy(policy: Partial<ScorePolicy> | null | undefined): ScorePolicy {
  return { ...DEFAULT_POLICY, ...policy };
}

function formatPercentOneDecimal(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function worstSeverityForBucket(severities: Set<LintSeverity>): 'error' | 'warning' | null {
  if (severities.has('error')) {
    return 'error';
  }
  if (severities.has('warning')) {
    return 'warning';
  }
  return null;
}

/**
 * Pure scoring: per-element 1 / 0.5 penalty, info ignored, __diagram__ bucket (+1 maxPoints when used).
 */
export function computeLintScore(input: ComputeLintScoreInput): LintScoreSnapshot {
  const policy = mergePolicy(input.scorePolicy);
  const scorableCount = countScorableElements(input.elementRegistry, input.rootElementId);

  const relevantFindings = input.findings.filter((finding) => finding.severity !== 'info');
  const bucketToSeverities = new Map<string, Set<LintSeverity>>();

  for (const finding of relevantFindings) {
    const bucket = resolveFindingBucketId(finding.elementId, input.elementRegistry);
    let set = bucketToSeverities.get(bucket);
    if (set == null) {
      set = new Set();
      bucketToSeverities.set(bucket, set);
    }
    set.add(finding.severity);
  }

  const usesDiagramBucket = bucketToSeverities.has(DIAGRAM_BUCKET_ID);
  const maxPoints = scorableCount + (usesDiagramBucket ? 1 : 0);

  let errorPenaltyPoints = 0;
  let warningPenaltyPoints = 0;
  let errorElementCount = 0;
  let warningOnlyElementCount = 0;

  for (const [, severities] of bucketToSeverities) {
    const worst = worstSeverityForBucket(severities);
    if (worst === 'error') {
      errorPenaltyPoints += 1;
      errorElementCount += 1;
    } else if (worst === 'warning') {
      warningPenaltyPoints += 0.5;
      warningOnlyElementCount += 1;
    }
  }

  const penaltyPoints = errorPenaltyPoints + warningPenaltyPoints;

  const rawFindingErrors = input.findings.filter((finding) => finding.severity === 'error').length;
  const rawFindingWarnings = input.findings.filter((finding) => finding.severity === 'warning').length;

  const remainingPoints = maxPoints > 0 ? Math.max(0, maxPoints - penaltyPoints) : 0;
  const scorePercent = maxPoints > 0 ? Math.max(0, (remainingPoints / maxPoints) * 100) : 100;

  const errorPenaltyPercentOfTotal = maxPoints > 0 ? (errorElementCount / maxPoints) * 100 : 0;
  const warningPenaltyPercentOfTotal = maxPoints > 0 ? ((0.5 * warningOnlyElementCount) / maxPoints) * 100 : 0;

  const reasonCodes: string[] = [];
  let compliance: LintScoreComplianceStatus = 'valid';

  if (scorePercent < policy.riskyMinPercent) {
    compliance = 'failed';
    reasonCodes.push('below_risky_threshold');
  } else if (scorePercent < policy.validMinPercent) {
    compliance = 'risky';
    reasonCodes.push('below_valid_threshold');
  }

  if (policy.instantFailOnAnyError && rawFindingErrors > 0) {
    compliance = 'failed';
    reasonCodes.push('instant_fail_any_error');
  }
  if (policy.instantRiskOnAnyWarning && rawFindingWarnings > 0 && rawFindingErrors === 0 && compliance !== 'failed') {
    compliance = 'risky';
    reasonCodes.push('instant_risk_any_warning');
  }

  return {
    schemaVersion: LINT_SCORE_SCHEMA_VERSION,
    maxPoints,
    penaltyPoints,
    errorPenaltyPoints,
    warningPenaltyPoints,
    remainingPoints,
    scorePercent,
    scorePercentDisplay: formatPercentOneDecimal(scorePercent),
    errorElementCount,
    warningOnlyElementCount,
    rawFindingErrors,
    rawFindingWarnings,
    errorPenaltyPercentOfTotal,
    warningPenaltyPercentOfTotal,
    complianceStatus: compliance,
    reasonCodes,
    scorePolicyUsed: policy,
    usesDiagramBucket,
  };
}
