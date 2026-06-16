import { profiles } from './rules/config';
import type { ScorePolicy } from './types';

const SCORE_POLICY_FALLBACK: ScorePolicy = {
  validMinPercent: 85,
  riskyMinPercent: 60,
  instantFailOnAnyError: false,
  instantRiskOnAnyWarning: false,
};

function mergePolicy(base: ScorePolicy, patch?: Partial<ScorePolicy> | null): ScorePolicy {
  return { ...base, ...patch };
}

function clampPolicy(policy: ScorePolicy): ScorePolicy {
  let risky = Math.min(100, Math.max(0, policy.riskyMinPercent));
  let valid = Math.min(100, Math.max(0, policy.validMinPercent));
  if (valid < risky) {
    [valid, risky] = [risky, valid];
  }
  return {
    ...policy,
    validMinPercent: valid,
    riskyMinPercent: risky,
  };
}

/**
 * Resolves the effective score policy for the active profile name, including custom ruleset overrides.
 */
export function resolveScorePolicy(activeProfileName: string, customRulesets: Record<string, unknown>): ScorePolicy {
  const custom = customRulesets[activeProfileName] as { base?: string; scorePolicy?: Partial<ScorePolicy> } | undefined;
  if (custom && typeof custom === 'object') {
    const baseName = typeof custom.base === 'string' ? custom.base : 'bpmn-development';
    const baseProfile = profiles[baseName];
    const basePolicy = mergePolicy(SCORE_POLICY_FALLBACK, baseProfile?.scorePolicy);
    return clampPolicy(mergePolicy(basePolicy, custom.scorePolicy));
  }
  const builtIn = profiles[activeProfileName];
  return clampPolicy(mergePolicy(SCORE_POLICY_FALLBACK, builtIn?.scorePolicy));
}
