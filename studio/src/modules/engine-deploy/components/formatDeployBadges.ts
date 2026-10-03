import type { StoredLinterScore } from '#modules/solution-models/types';

import type { DeployItemStatus } from '../analysis/types';

export type DeployStatusBadgeTone = 'positive' | 'neutral' | 'warning' | 'error';

type DeployStatusPresentation = { label: string; tooltip: string; tone: DeployStatusBadgeTone };

const STATUS_PRESENTATIONS: Record<DeployItemStatus, DeployStatusPresentation> = {
  new: { label: 'New', tooltip: 'The Engine does not know this process yet.', tone: 'positive' },
  newVersion: {
    label: 'New version',
    tooltip: 'The Engine knows the process, but not this version.',
    tone: 'positive',
  },
  unchanged: { label: 'Unchanged', tooltip: 'The Engine already has exactly this version.', tone: 'neutral' },
  changedWithoutVersionBump: {
    label: 'No version bump',
    tooltip: 'The file differs from the version on the Engine, but the version number is the same.',
    tone: 'warning',
  },
  versionMissing: {
    label: 'Version missing',
    tooltip: 'The process has no version. Add a version before deploying.',
    tone: 'error',
  },
  skipped: { label: 'Skipped', tooltip: 'Skipped (not executable), so it is never deployed.', tone: 'neutral' },
  unknown: {
    label: 'Unknown',
    tooltip: 'Unknown (Engine offline): the deployed state cannot be compared.',
    tone: 'neutral',
  },
  invalid: { label: 'Unreadable', tooltip: 'The file could not be read as a BPMN or DMN model.', tone: 'error' },
};

export function describeDeployStatus(status: DeployItemStatus): DeployStatusPresentation {
  return STATUS_PRESENTATIONS[status];
}

const RULESET_SHORT_LABELS: Record<string, string> = {
  'bpmn-development': 'Dev',
  'bpmn-production-ready': 'Prod',
};

const RULESET_LONG_LABELS: Record<string, string> = {
  'bpmn-development': 'Development',
  'bpmn-production-ready': 'Production Ready',
};

export type LinterVerdict = 'valid' | 'risky' | 'failed' | 'unknown';

const VERDICT_RANK: Record<LinterVerdict, number> = { valid: 0, unknown: 0, risky: 1, failed: 2 };

export function toLinterVerdict(complianceStatus: string): LinterVerdict {
  return complianceStatus === 'valid' || complianceStatus === 'risky' || complianceStatus === 'failed'
    ? complianceStatus
    : 'unknown';
}

/** The worse of two verdicts; an unknown verdict never hides a known one. */
export function worstLinterVerdict(first: LinterVerdict, second: LinterVerdict): LinterVerdict {
  return VERDICT_RANK[second] > VERDICT_RANK[first] ? second : first;
}

export function formatPercent(percent: number, locale?: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(percent)}%`;
}

export function shortRulesetLabel(rulesetId: string): string {
  return RULESET_SHORT_LABELS[rulesetId] ?? rulesetId;
}

export function longRulesetLabel(rulesetId: string): string {
  return RULESET_LONG_LABELS[rulesetId] ?? rulesetId;
}

export type LinterBadgePresentation = { label: string; tooltip: string; verdict: LinterVerdict };

/** A stored score as `Dev: 92,6%`, coloured by the linter's own verdict. Returns null for an unreadable percentage. */
export function describeStoredLinterScore(score: StoredLinterScore, locale?: string): LinterBadgePresentation | null {
  const percent = Number(score.scorePercent);
  if (!Number.isFinite(percent)) {
    return null;
  }
  const verdict = toLinterVerdict(score.complianceStatus);
  const verdictText = verdict === 'unknown' ? score.complianceStatus : verdict;
  return {
    label: `${shortRulesetLabel(score.rulesetId)}: ${formatPercent(percent, locale)}`,
    tooltip: `${longRulesetLabel(score.rulesetId)}: ${formatPercent(percent, locale)} (${verdictText}), computed ${score.computedAtIso}`,
    verdict,
  };
}
