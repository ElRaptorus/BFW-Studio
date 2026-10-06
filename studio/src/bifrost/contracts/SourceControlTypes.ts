export type SourceControlFileStatusCode =
  'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'ignored' | 'conflicted';

export type SourceControlFileStatus = {
  readonly uri: string;
  /** Relative to the repository root. */
  readonly path: string;
  readonly indexStatus: SourceControlFileStatusCode | null;
  readonly workingTreeStatus: SourceControlFileStatusCode | null;
  /** Relative path before a rename, `null` for every file that was not renamed. */
  readonly previousPath: string | null;
};

export type SourceControlBranchInfo = {
  readonly current: string;
  readonly tracking: string | null;
  readonly ahead: number;
  readonly behind: number;
  readonly detached: boolean;
};

export type SourceControlMergeStateKind = 'merge' | 'rebase' | 'cherry-pick' | null;

type SourceControlMergeState = {
  readonly kind: SourceControlMergeStateKind;
  readonly conflictedFiles: SourceControlFileStatus[];
};

export type SourceControlConflictBlobs = {
  readonly base: string | null;
  readonly ours: string | null;
  readonly theirs: string | null;
};

export type SourceControlRepositoryState = {
  readonly repositoryRoot: string;
  readonly branch: SourceControlBranchInfo;
  readonly files: SourceControlFileStatus[];
  readonly hasStash: boolean;
  readonly mergeState: SourceControlMergeState;
};

export type SourceControlStashEntry = {
  readonly index: number;
  readonly message: string;
  readonly date: string;
};

export type SourceControlCommitResult = {
  readonly hash: string;
  readonly summary: { readonly changes: number; readonly insertions: number; readonly deletions: number };
};

type SourceControlBranch = {
  /** Local branches by name, remote branches as `remotes/<remote>/<name>`. */
  readonly name: string;
  readonly current: boolean;
  readonly commit: string;
  readonly label: string;
};

export type SourceControlBranchList = {
  readonly current: string;
  readonly branches: SourceControlBranch[];
};

export type SourceControlLogEntry = {
  readonly hash: string;
  readonly date: string;
  readonly message: string;
  readonly author: string;
};

type SourceControlRefDecorationKind = 'head' | 'local' | 'remote' | 'tag';

export type SourceControlRefDecoration = {
  readonly kind: SourceControlRefDecorationKind;
  readonly name: string;
};

/** The longest search text a history request may carry. */
export const MAXIMUM_HISTORY_SEARCH_LENGTH = 200;

export type SourceControlHistoryRequest = {
  readonly skip: number;
  readonly maxCount: number;
  /** Only commits whose message contains this text (case-insensitive, literal) are listed; empty means all. */
  readonly searchText?: string;
  /** Upstream ref (e.g. `origin/main`) used to find unpushed commits, or `null` when the branch has none. */
  readonly upstream: string | null;
};

export type SourceControlHistoryEntry = {
  readonly hash: string;
  readonly parents: readonly string[];
  readonly author: string;
  readonly date: string;
  readonly subject: string;
  readonly refs: readonly SourceControlRefDecoration[];
  readonly isUnpushed: boolean;
  /** Set for merge commits whose subject names the merged branch. */
  readonly mergedBranchName: string | null;
};

export type SourceControlChangedFileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export type SourceControlChangedFile = {
  readonly status: SourceControlChangedFileStatus;
  readonly path: string;
  readonly previousPath: string | null;
};

export type SourceControlPullResult = {
  readonly success: boolean;
  readonly summary?: string;
  readonly error?: string;
  readonly recoverable?: 'rebase' | 'stash-and-retry' | 'merge-conflicts' | null;
};

export type SourceControlRemoteBranch = {
  readonly name: string;
  readonly isHead: boolean;
};

/**
 * A compact, language-neutral summary of what changed in one BPMN or DMN model.
 *
 * Produced by the `bpmn.diff.getChangeDigest` and `dmn.diff.getChangeDigest` commands and consumed by
 * the Source Overview, which must not import the diff modules directly.
 */
export type ModelChangeDigest = {
  /**
   * Whether the whole model was added or deleted, or only parts of it changed.
   */
  readonly fileChange: 'added' | 'deleted' | 'modified';

  /**
   * The human-readable name of the model (BPMN process name, DMN definitions name), if it has one.
   */
  readonly modelName: string | null;

  /**
   * Display names of the added elements. Empty for `added` / `deleted` files.
   */
  readonly addedElementNames: readonly string[];

  /**
   * Display names of the removed elements. Empty for `added` / `deleted` files.
   */
  readonly removedElementNames: readonly string[];

  /**
   * Display names of the modified elements. Empty for `added` / `deleted` files.
   */
  readonly modifiedElementNames: readonly string[];

  /**
   * Number of elements that only moved or were resized.
   */
  readonly layoutChangedCount: number;

  /**
   * Whether file-level details changed that belong to no element, e.g. BPMN definitions metadata or linter scores.
   */
  readonly fileDetailsChanged: boolean;
};
