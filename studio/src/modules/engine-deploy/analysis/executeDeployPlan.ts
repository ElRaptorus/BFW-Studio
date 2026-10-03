import type { DeployFailureDetail, DeployRulesetFailure } from '#modules/engine-core';
import { formatDeployErrorMessage } from '#modules/engine-core';

import type { DeployFileKind, DeployItemResult } from './types';

export type DeployPlanFile = { uri: string; kind: DeployFileKind };

/** Deploys one file; resolves with its result and may throw. */
export type DeployFile = (file: DeployPlanFile) => Promise<DeployItemResult>;

export function extractRulesetFailures(error: unknown): DeployRulesetFailure[] {
  const failures: DeployFailureDetail[] =
    (error as { _deployFailures?: DeployFailureDetail[] } | null)?._deployFailures ?? [];
  return failures.flatMap((failure) => failure.rulesetFailures ?? []);
}

export function toFailedResult(uri: string, error: unknown): DeployItemResult {
  return {
    uri,
    status: 'failed',
    message: formatDeployErrorMessage(error),
    rulesetFailures: extractRulesetFailures(error),
  };
}

/**
 * Deploys the files one request each, DMN files before BPMN files and otherwise in plan order. A failed or cancelled
 * file does not stop the others, because the Engine only makes a single request atomic.
 */
export async function executeDeployPlan(files: DeployPlanFile[], deployFile: DeployFile): Promise<DeployItemResult[]> {
  const ordered = [...files.filter((file) => file.kind === 'dmn'), ...files.filter((file) => file.kind === 'bpmn')];
  const results: DeployItemResult[] = [];
  for (const file of ordered) {
    try {
      results.push(await deployFile(file));
    } catch (error) {
      results.push(toFailedResult(file.uri, error));
    }
  }
  return results;
}
