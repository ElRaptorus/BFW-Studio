export type GitFileStatusCode =
  'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'ignored' | 'conflicted';

export type GitFileStatus = {
  readonly uri: string;
  readonly path: string;
  readonly indexStatus: GitFileStatusCode | null;
  readonly workingTreeStatus: GitFileStatusCode | null;
};

export type GitBranchInfo = {
  readonly current: string;
  readonly tracking: string | null;
  readonly ahead: number;
  readonly behind: number;
  readonly detached: boolean;
};

export type GitMergeStateType = 'merge' | 'rebase' | 'cherry-pick' | null;

export type GitMergeState = {
  readonly kind: GitMergeStateType;
  readonly conflictedFiles: GitFileStatus[];
};

export type GitConflictBlobs = {
  readonly base: string | null;
  readonly ours: string | null;
  readonly theirs: string | null;
};

export type GitRepoState = {
  readonly repoRoot: string;
  readonly branch: GitBranchInfo;
  readonly files: GitFileStatus[];
  readonly hasStash: boolean;
  readonly mergeState: GitMergeState;
};

export type GitStashEntry = {
  readonly index: number;
  readonly message: string;
  readonly date: string;
};

export type GitCommitOptions = {
  readonly title: string;
  readonly body?: string;
};

export type GitLogEntry = {
  hash: string;
  date: string;
  message: string;
  author: string;
};

export type GitPullResult = {
  readonly success: boolean;
  readonly summary?: string;
  readonly error?: string;
  readonly recoverable?: 'rebase' | 'stash-and-retry' | 'merge-conflicts' | null;
};

export const STATUS_BADGE_MAP: Record<GitFileStatusCode, string | null> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  untracked: 'U',
  conflicted: 'C',
  ignored: null,
};

export const STATUS_COLOR_TOKEN_MAP: Record<GitFileStatusCode, string> = {
  modified: 'var(--theme-git-modified)',
  added: 'var(--theme-git-added)',
  deleted: 'var(--theme-git-deleted)',
  renamed: 'var(--theme-git-renamed)',
  copied: 'var(--theme-git-added)',
  untracked: 'var(--theme-git-untracked)',
  conflicted: 'var(--theme-git-conflicted)',
  ignored: 'var(--theme-git-ignored)',
};

export const STATUS_SEVERITY: Record<GitFileStatusCode, number> = {
  ignored: 0,
  untracked: 1,
  added: 2,
  renamed: 2,
  copied: 2,
  deleted: 3,
  modified: 4,
  conflicted: 5,
};

export type GitRemoteBranch = {
  name: string;
  isHead: boolean;
};

export type MergeConflictKind = 'content' | 'ours-deleted' | 'theirs-deleted' | 'added-by-both';

export type MergeFileType = 'bpmn' | 'dmn' | 'text' | 'binary';

export type MergeFileEntry = {
  relativePath: string;
  uri: string;
  resolved: boolean;
  fileType: MergeFileType;
};

export type MergeProgress = {
  current: number;
  total: number;
  remaining: number;
};

export const EVENT_MERGE_FILE_CHANGED = 'EVENT_MERGE_FILE_CHANGED';
export const EVENT_RESOLUTION_CHANGED = 'EVENT_RESOLUTION_CHANGED';

export const MERGE_URI = 'merge://resolver';
