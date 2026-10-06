import type {
  SourceControlBranchList,
  SourceControlChangedFile,
  SourceControlCommitResult,
  SourceControlConflictBlobs,
  SourceControlHistoryEntry,
  SourceControlLogEntry,
  SourceControlPullResult,
  SourceControlRemoteBranch,
  SourceControlRepositoryState,
  SourceControlStashEntry,
} from '../contracts/SourceControlTypes';
import { SourceControlService } from './SourceControlService';

const UNAVAILABLE_MESSAGE = 'Source control is not available in this version of the Studio.';

/**
 * Used by builds without a version control backend (e.g. the web app). Reports itself as unavailable; every
 * operation rejects, except `pull`, which resolves with an unsuccessful result as its contract requires.
 */
export class SourceControlServiceDefault extends SourceControlService {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  findRepositoryRoot(): Promise<string | null> {
    return this.unavailable();
  }

  getRepositoryState(): Promise<SourceControlRepositoryState> {
    return this.unavailable();
  }

  stage(): Promise<void> {
    return this.unavailable();
  }

  unstage(): Promise<void> {
    return this.unavailable();
  }

  remove(): Promise<void> {
    return this.unavailable();
  }

  revert(): Promise<void> {
    return this.unavailable();
  }

  commit(): Promise<SourceControlCommitResult> {
    return this.unavailable();
  }

  push(): Promise<void> {
    return this.unavailable();
  }

  async pull(): Promise<SourceControlPullResult> {
    return { success: false, error: UNAVAILABLE_MESSAGE, recoverable: null };
  }

  fetch(): Promise<void> {
    return this.unavailable();
  }

  stash(): Promise<void> {
    return this.unavailable();
  }

  stashApply(): Promise<void> {
    return this.unavailable();
  }

  stashList(): Promise<SourceControlStashEntry[]> {
    return this.unavailable();
  }

  getBranches(): Promise<SourceControlBranchList> {
    return this.unavailable();
  }

  switchBranch(): Promise<void> {
    return this.unavailable();
  }

  createBranch(): Promise<void> {
    return this.unavailable();
  }

  getFileContentAtRevision(): Promise<string> {
    return this.unavailable();
  }

  getLog(): Promise<SourceControlLogEntry[]> {
    return this.unavailable();
  }

  getHistory(): Promise<SourceControlHistoryEntry[]> {
    return this.unavailable();
  }

  getChangedFilesBetween(): Promise<SourceControlChangedFile[]> {
    return this.unavailable();
  }

  getMergeBase(): Promise<string | null> {
    return this.unavailable();
  }

  getConflictBlobs(): Promise<SourceControlConflictBlobs> {
    return this.unavailable();
  }

  mergeAbort(): Promise<void> {
    return this.unavailable();
  }

  rebaseAbort(): Promise<void> {
    return this.unavailable();
  }

  rebaseContinue(): Promise<void> {
    return this.unavailable();
  }

  cherryPickAbort(): Promise<void> {
    return this.unavailable();
  }

  cherryPickContinue(): Promise<void> {
    return this.unavailable();
  }

  clone(): Promise<void> {
    return this.unavailable();
  }

  listRemoteBranches(): Promise<SourceControlRemoteBranch[]> {
    return this.unavailable();
  }

  connectFolderToRemote(): Promise<void> {
    return this.unavailable();
  }

  onCloneProgress(): () => void {
    return () => {};
  }

  private async unavailable(): Promise<never> {
    throw new Error(UNAVAILABLE_MESSAGE);
  }
}
