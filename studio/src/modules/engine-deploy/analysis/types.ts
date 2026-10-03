import type { DeployRulesetFailure } from '#modules/engine-core';
import type { StoredLinterScore } from '#modules/solution-models/types';

export type ProcessDeployStatus =
  | 'new'
  | 'newVersion'
  | 'unchanged'
  | 'changedWithoutVersionBump'
  | 'versionMissing'
  /** Not executable, so it is never deployed. */
  | 'skipped'
  /** The Engine state is not available (offline). */
  | 'unknown';

export type DeployItemStatus = ProcessDeployStatus | 'invalid';

export type DependencyState = 'inPlan' | 'onEngine' | 'localNotInPlan' | 'missing' | 'unknown';

export type DeployFileKind = 'bpmn' | 'dmn';

/** What the Engine has deployed, restricted to the ids the plan and its dependencies mention. */
export type EngineSnapshot = {
  health: { ok: boolean; message: string | null };
  /** Process id -> deployed versions with the SHA-256 of the deployed XML. */
  processes: Record<string, { version: string; sha256: string | null }[]>;
  /** Decision definitions id -> deployed version strings. */
  decisions: Record<string, string[]>;
};

export type DeployConnection = {
  engineId: string | null;
  connected: boolean;
  canDeployBpmn: boolean;
  canDeployDmn: boolean;
};

export type DeployProcessAnalysis = {
  processId: string;
  name: string | null;
  version: string | null;
  status: ProcessDeployStatus;
};

export type DeployDependency = {
  kind: 'process' | 'decision';
  id: string;
  /** Pinned `bfw:calledProcessVersion`; always null for decisions. */
  version: string | null;
  state: DependencyState;
  /** The local file defining it, when there is one. */
  fileUri: string | null;
  /** URIs of the files that reference it. */
  requiredBy: string[];
};

export type DeployItemAnalysis = {
  uri: string;
  kind: DeployFileKind | 'invalid';
  status: DeployItemStatus;
  processes: DeployProcessAnalysis[];
  storedLinterScores: StoredLinterScore[];
  /** Info line when a BPMN file carries no stored linter score. */
  linterInfo: string | null;
  blockers: string[];
  /** Whether the item is ticked when it is added to the plan. */
  includedByDefault: boolean;
};

export type DeployAnalysis = {
  globalBlockers: string[];
  items: DeployItemAnalysis[];
  dependencies: DeployDependency[];
};

export type DeployItemResult = {
  uri: string;
  status: 'deployed' | 'cancelled' | 'failed';
  message: string | null;
  rulesetFailures: DeployRulesetFailure[];
};
