import { ipcRenderer } from 'electron';

import { SourceControlService } from '../common/SourceControlService';
import type { GitStatusPayload } from '../contracts/GitIpcChannels';
import {
  IPC_INVOKE_GIT_BRANCH_CREATE,
  IPC_INVOKE_GIT_BRANCH_LIST,
  IPC_INVOKE_GIT_BRANCH_SWITCH,
  IPC_INVOKE_GIT_CHERRY_PICK_ABORT,
  IPC_INVOKE_GIT_CHERRY_PICK_CONTINUE,
  IPC_INVOKE_GIT_CLONE,
  IPC_INVOKE_GIT_COMMIT,
  IPC_INVOKE_GIT_CONFLICT_BLOBS,
  IPC_INVOKE_GIT_CONNECT_TO_REMOTE,
  IPC_INVOKE_GIT_DIFF_NAME_STATUS,
  IPC_INVOKE_GIT_FETCH,
  IPC_INVOKE_GIT_HISTORY,
  IPC_INVOKE_GIT_IS_AVAILABLE,
  IPC_INVOKE_GIT_IS_REPO,
  IPC_INVOKE_GIT_LOG,
  IPC_INVOKE_GIT_LS_REMOTE,
  IPC_INVOKE_GIT_MERGE_ABORT,
  IPC_INVOKE_GIT_MERGE_BASE,
  IPC_INVOKE_GIT_MERGE_STATE,
  IPC_INVOKE_GIT_PULL,
  IPC_INVOKE_GIT_PUSH,
  IPC_INVOKE_GIT_REBASE_ABORT,
  IPC_INVOKE_GIT_REBASE_CONTINUE,
  IPC_INVOKE_GIT_REMOVE,
  IPC_INVOKE_GIT_REVERT,
  IPC_INVOKE_GIT_SHOW,
  IPC_INVOKE_GIT_STAGE,
  IPC_INVOKE_GIT_STASH,
  IPC_INVOKE_GIT_STASH_APPLY,
  IPC_INVOKE_GIT_STASH_LIST,
  IPC_INVOKE_GIT_STATUS,
  IPC_INVOKE_GIT_UNSTAGE,
  IPC_MESSAGE_GIT_CLONE_PROGRESS,
} from '../contracts/GitIpcChannels';
import type {
  SourceControlBranchList,
  SourceControlChangedFile,
  SourceControlCommitResult,
  SourceControlConflictBlobs,
  SourceControlFileStatus,
  SourceControlHistoryEntry,
  SourceControlHistoryRequest,
  SourceControlLogEntry,
  SourceControlMergeStateKind,
  SourceControlPullResult,
  SourceControlRemoteBranch,
  SourceControlRepositoryState,
  SourceControlStashEntry,
} from '../contracts/SourceControlTypes';

/** Recognises the git pull failures the user can recover from, by the text git prints. */
function classifyPullError(message: string): SourceControlPullResult['recoverable'] {
  if (message.includes('CONFLICT') || message.includes('Automatic merge failed')) {
    return 'merge-conflicts';
  }
  if (message.includes('diverged') || message.includes('overwritten by merge')) {
    return 'rebase';
  }
  if (message.includes('uncommitted changes') || message.includes('not possible because you have unmerged')) {
    return 'stash-and-retry';
  }
  return null;
}

/**
 * Talks to git in the main process (`registerGitHandlers`) over IPC.
 */
export class SourceControlServiceElectron extends SourceControlService {
  async isAvailable(): Promise<boolean> {
    const result: { available: boolean } = await ipcRenderer.invoke(IPC_INVOKE_GIT_IS_AVAILABLE);
    return result.available;
  }

  async findRepositoryRoot(directoryPath: string): Promise<string | null> {
    const result: { isRepo: boolean; root: string | null } = await ipcRenderer.invoke(
      IPC_INVOKE_GIT_IS_REPO,
      directoryPath,
    );
    return result.isRepo && result.root ? result.root : null;
  }

  async getRepositoryState(repositoryRoot: string): Promise<SourceControlRepositoryState> {
    const [status, mergeState]: [GitStatusPayload, { kind: SourceControlMergeStateKind }] = await Promise.all([
      ipcRenderer.invoke(IPC_INVOKE_GIT_STATUS, repositoryRoot),
      ipcRenderer.invoke(IPC_INVOKE_GIT_MERGE_STATE, repositoryRoot),
    ]);

    const files: SourceControlFileStatus[] = status.files.map((file) => ({
      uri: `file://${repositoryRoot}/${file.path}`,
      path: file.path,
      indexStatus: file.indexStatus,
      workingTreeStatus: file.workingTreeStatus,
    }));

    const conflictedFiles = files.filter(
      (file, index) =>
        file.workingTreeStatus === 'conflicted' ||
        file.indexStatus === 'conflicted' ||
        status.files[index].isConflicted,
    );

    return {
      repositoryRoot,
      branch: status.branch,
      files,
      hasStash: status.hasStash,
      mergeState: { kind: mergeState.kind ?? null, conflictedFiles },
    };
  }

  async stage(repositoryRoot: string, filePaths: string[]): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_STAGE, repositoryRoot, filePaths);
  }

  async unstage(repositoryRoot: string, filePaths: string[]): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_UNSTAGE, repositoryRoot, filePaths);
  }

  async remove(repositoryRoot: string, filePaths: string[]): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_REMOVE, repositoryRoot, filePaths);
  }

  async revert(repositoryRoot: string, filePaths: string[]): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_REVERT, repositoryRoot, filePaths);
  }

  async commit(repositoryRoot: string, message: string): Promise<SourceControlCommitResult> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_COMMIT, repositoryRoot, message);
  }

  async push(repositoryRoot: string, options?: { setUpstream?: boolean }): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_PUSH, repositoryRoot, options);
  }

  async pull(repositoryRoot: string, options?: { rebase?: boolean }): Promise<SourceControlPullResult> {
    try {
      await ipcRenderer.invoke(IPC_INVOKE_GIT_PULL, repositoryRoot, options);
      return { success: true };
    } catch (error: any) {
      const message: string = error?.message ?? String(error);
      return { success: false, error: message, recoverable: classifyPullError(message) };
    }
  }

  async fetch(repositoryRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_FETCH, repositoryRoot);
  }

  async stash(repositoryRoot: string, message?: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_STASH, repositoryRoot, message);
  }

  async stashApply(repositoryRoot: string, index?: number, options?: { restoreIndex?: boolean }): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_STASH_APPLY, repositoryRoot, index, options);
  }

  async stashList(repositoryRoot: string): Promise<SourceControlStashEntry[]> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_STASH_LIST, repositoryRoot);
  }

  async getBranches(repositoryRoot: string): Promise<SourceControlBranchList> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_BRANCH_LIST, repositoryRoot);
  }

  async switchBranch(repositoryRoot: string, branchName: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_BRANCH_SWITCH, repositoryRoot, branchName);
  }

  async createBranch(repositoryRoot: string, branchName: string, checkout: boolean): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_BRANCH_CREATE, repositoryRoot, branchName, checkout);
  }

  async getFileContentAtRevision(repositoryRoot: string, revision: string, relativePath: string): Promise<string> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_SHOW, repositoryRoot, revision, relativePath);
  }

  async getLog(
    repositoryRoot: string,
    options?: { maxCount?: number; file?: string },
  ): Promise<SourceControlLogEntry[]> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_LOG, repositoryRoot, options);
  }

  async getHistory(repositoryRoot: string, request: SourceControlHistoryRequest): Promise<SourceControlHistoryEntry[]> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_HISTORY, repositoryRoot, request);
  }

  async getChangedFilesBetween(
    repositoryRoot: string,
    fromRevision: string | null,
    toRevision: string,
  ): Promise<SourceControlChangedFile[]> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_DIFF_NAME_STATUS, repositoryRoot, fromRevision, toRevision);
  }

  async getMergeBase(repositoryRoot: string, firstRevision: string, secondRevision: string): Promise<string | null> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_MERGE_BASE, repositoryRoot, firstRevision, secondRevision);
  }

  async getConflictBlobs(repositoryRoot: string, relativePath: string): Promise<SourceControlConflictBlobs> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_CONFLICT_BLOBS, repositoryRoot, relativePath);
  }

  async mergeAbort(repositoryRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_MERGE_ABORT, repositoryRoot);
  }

  async rebaseAbort(repositoryRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_REBASE_ABORT, repositoryRoot);
  }

  async rebaseContinue(repositoryRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_REBASE_CONTINUE, repositoryRoot);
  }

  async cherryPickAbort(repositoryRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_CHERRY_PICK_ABORT, repositoryRoot);
  }

  async cherryPickContinue(repositoryRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_CHERRY_PICK_CONTINUE, repositoryRoot);
  }

  async clone(url: string, targetDirectory: string, branch?: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_CLONE, url, targetDirectory, branch);
  }

  async listRemoteBranches(url: string): Promise<SourceControlRemoteBranch[]> {
    const result: { branches: SourceControlRemoteBranch[] } = await ipcRenderer.invoke(IPC_INVOKE_GIT_LS_REMOTE, url);
    return result.branches;
  }

  async connectFolderToRemote(targetDirectory: string, url: string, branch: string, newBranch?: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_CONNECT_TO_REMOTE, url, targetDirectory, branch, newBranch);
  }

  onCloneProgress(callback: (stage: string, progress: number) => void): () => void {
    const handler = (_event: unknown, data: { stage: string; progress: number }): void => {
      callback(data.stage, data.progress);
    };
    ipcRenderer.on(IPC_MESSAGE_GIT_CLONE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_MESSAGE_GIT_CLONE_PROGRESS, handler);
  }
}
