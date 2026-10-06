import type {
  SourceControlBranchList,
  SourceControlChangedFile,
  SourceControlCommitResult,
  SourceControlConflictBlobs,
  SourceControlHistoryEntry,
  SourceControlHistoryRequest,
  SourceControlLogEntry,
  SourceControlPullResult,
  SourceControlRemoteBranch,
  SourceControlRepositoryState,
  SourceControlStashEntry,
} from '../contracts/SourceControlTypes';

/**
 * Provides version control operations on repositories, addressed by their absolute root path.
 *
 * Stateless: it neither caches repository states nor reads settings. Platform-dependent; the Electron build talks to
 * git in the main process (`SourceControlServiceElectron`), other builds report that source control is not available
 * (`SourceControlServiceDefault`).
 */
export abstract class SourceControlService {
  abstract isAvailable(): Promise<boolean>;

  /** Root of the repository that contains `directoryPath`, or `null` when it is not inside one. */
  abstract findRepositoryRoot(directoryPath: string): Promise<string | null>;

  abstract getRepositoryState(repositoryRoot: string): Promise<SourceControlRepositoryState>;

  abstract stage(repositoryRoot: string, filePaths: string[]): Promise<void>;
  abstract unstage(repositoryRoot: string, filePaths: string[]): Promise<void>;
  abstract remove(repositoryRoot: string, filePaths: string[]): Promise<void>;
  /** Discards working tree changes of the given files. */
  abstract revert(repositoryRoot: string, filePaths: string[]): Promise<void>;
  abstract commit(repositoryRoot: string, message: string): Promise<SourceControlCommitResult>;
  abstract push(repositoryRoot: string, options?: { setUpstream?: boolean }): Promise<void>;
  /** Never rejects; failures come back classified. */
  abstract pull(repositoryRoot: string, options?: { rebase?: boolean }): Promise<SourceControlPullResult>;
  abstract fetch(repositoryRoot: string): Promise<void>;

  abstract stash(repositoryRoot: string, message?: string): Promise<void>;
  abstract stashApply(repositoryRoot: string, index?: number, options?: { restoreIndex?: boolean }): Promise<void>;
  abstract stashList(repositoryRoot: string): Promise<SourceControlStashEntry[]>;

  abstract getBranches(repositoryRoot: string): Promise<SourceControlBranchList>;
  abstract switchBranch(repositoryRoot: string, branchName: string): Promise<void>;
  abstract createBranch(repositoryRoot: string, branchName: string, checkout: boolean): Promise<void>;

  /** Content of `relativePath` at `revision` (a commit hash, branch or `HEAD`). */
  abstract getFileContentAtRevision(repositoryRoot: string, revision: string, relativePath: string): Promise<string>;
  abstract getLog(
    repositoryRoot: string,
    options?: { maxCount?: number; file?: string },
  ): Promise<SourceControlLogEntry[]>;
  /** First-parent history of the checked-out branch, newest first. */
  abstract getHistory(
    repositoryRoot: string,
    request: SourceControlHistoryRequest,
  ): Promise<SourceControlHistoryEntry[]>;
  /** Files that differ between two revisions; `fromRevision` null lists everything a root commit added. */
  abstract getChangedFilesBetween(
    repositoryRoot: string,
    fromRevision: string | null,
    toRevision: string,
  ): Promise<SourceControlChangedFile[]>;
  abstract getMergeBase(repositoryRoot: string, firstRevision: string, secondRevision: string): Promise<string | null>;

  abstract getConflictBlobs(repositoryRoot: string, relativePath: string): Promise<SourceControlConflictBlobs>;
  abstract mergeAbort(repositoryRoot: string): Promise<void>;
  abstract rebaseAbort(repositoryRoot: string): Promise<void>;
  abstract rebaseContinue(repositoryRoot: string): Promise<void>;
  abstract cherryPickAbort(repositoryRoot: string): Promise<void>;
  abstract cherryPickContinue(repositoryRoot: string): Promise<void>;

  abstract clone(url: string, targetDirectory: string, branch?: string): Promise<void>;
  abstract listRemoteBranches(url: string): Promise<SourceControlRemoteBranch[]>;
  abstract connectFolderToRemote(
    targetDirectory: string,
    url: string,
    branch: string,
    newBranch?: string,
  ): Promise<void>;
  /** Progress of a running `clone` or `connectFolderToRemote`. Returns the unsubscribe function. */
  abstract onCloneProgress(callback: (stage: string, progress: number) => void): () => void;
}
