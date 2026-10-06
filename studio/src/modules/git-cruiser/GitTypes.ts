import type { MergeFileType } from '#bifrost/contracts/MergeTypes';
import type { SourceControlFileStatusCode, SourceControlHistoryEntry } from '#bifrost/contracts/SourceControlTypes';

export const STATUS_BADGE_MAP: Record<SourceControlFileStatusCode, string | null> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  untracked: 'U',
  conflicted: 'C',
  ignored: null,
};

export const STATUS_COLOR_TOKEN_MAP: Record<SourceControlFileStatusCode, string> = {
  modified: 'var(--theme-git-modified)',
  added: 'var(--theme-git-added)',
  deleted: 'var(--theme-git-deleted)',
  renamed: 'var(--theme-git-renamed)',
  copied: 'var(--theme-git-added)',
  untracked: 'var(--theme-git-untracked)',
  conflicted: 'var(--theme-git-conflicted)',
  ignored: 'var(--theme-git-ignored)',
};

export const STATUS_SEVERITY: Record<SourceControlFileStatusCode, number> = {
  ignored: 0,
  untracked: 1,
  added: 2,
  renamed: 2,
  copied: 2,
  deleted: 3,
  modified: 4,
  conflicted: 5,
};

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

export const MERGE_URI = 'merge://resolver';

export type CommitOptions = {
  readonly title: string;
  readonly body?: string;
};

export type HistoryPage = {
  readonly entries: SourceControlHistoryEntry[];
  readonly hasMore: boolean;
};
