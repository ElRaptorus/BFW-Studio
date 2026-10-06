import type { SourceControlBranchInfo, SourceControlFileStatusCode } from './SourceControlTypes';

/**
 * Channels between `SourceControlServiceElectron` (renderer) and `registerGitHandlers` (main). Only those two files
 * use them; everything else goes through `bifrost.sourceControl`.
 */
export const IPC_INVOKE_GIT_IS_AVAILABLE = 'IPC_INVOKE_GIT_IS_AVAILABLE';
export const IPC_INVOKE_GIT_IS_REPO = 'IPC_INVOKE_GIT_IS_REPO';
export const IPC_INVOKE_GIT_STATUS = 'IPC_INVOKE_GIT_STATUS';
export const IPC_INVOKE_GIT_STAGE = 'IPC_INVOKE_GIT_STAGE';
export const IPC_INVOKE_GIT_UNSTAGE = 'IPC_INVOKE_GIT_UNSTAGE';
export const IPC_INVOKE_GIT_COMMIT = 'IPC_INVOKE_GIT_COMMIT';
export const IPC_INVOKE_GIT_PUSH = 'IPC_INVOKE_GIT_PUSH';
export const IPC_INVOKE_GIT_PULL = 'IPC_INVOKE_GIT_PULL';
export const IPC_INVOKE_GIT_REVERT = 'IPC_INVOKE_GIT_REVERT';
export const IPC_INVOKE_GIT_STASH = 'IPC_INVOKE_GIT_STASH';
export const IPC_INVOKE_GIT_STASH_APPLY = 'IPC_INVOKE_GIT_STASH_APPLY';
export const IPC_INVOKE_GIT_STASH_LIST = 'IPC_INVOKE_GIT_STASH_LIST';
export const IPC_INVOKE_GIT_BRANCH_LIST = 'IPC_INVOKE_GIT_BRANCH_LIST';
export const IPC_INVOKE_GIT_BRANCH_SWITCH = 'IPC_INVOKE_GIT_BRANCH_SWITCH';
export const IPC_INVOKE_GIT_BRANCH_CREATE = 'IPC_INVOKE_GIT_BRANCH_CREATE';
export const IPC_INVOKE_GIT_FETCH = 'IPC_INVOKE_GIT_FETCH';
export const IPC_INVOKE_GIT_SHOW = 'IPC_INVOKE_GIT_SHOW';
export const IPC_INVOKE_GIT_LOG = 'IPC_INVOKE_GIT_LOG';
export const IPC_INVOKE_GIT_HISTORY = 'IPC_INVOKE_GIT_HISTORY';
export const IPC_INVOKE_GIT_DIFF_NAME_STATUS = 'IPC_INVOKE_GIT_DIFF_NAME_STATUS';
export const IPC_INVOKE_GIT_MERGE_BASE = 'IPC_INVOKE_GIT_MERGE_BASE';

export const IPC_INVOKE_GIT_MERGE_STATE = 'IPC_INVOKE_GIT_MERGE_STATE';
export const IPC_INVOKE_GIT_MERGE_ABORT = 'IPC_INVOKE_GIT_MERGE_ABORT';
export const IPC_INVOKE_GIT_REBASE_ABORT = 'IPC_INVOKE_GIT_REBASE_ABORT';
export const IPC_INVOKE_GIT_REBASE_CONTINUE = 'IPC_INVOKE_GIT_REBASE_CONTINUE';
export const IPC_INVOKE_GIT_CHERRY_PICK_ABORT = 'IPC_INVOKE_GIT_CHERRY_PICK_ABORT';
export const IPC_INVOKE_GIT_CHERRY_PICK_CONTINUE = 'IPC_INVOKE_GIT_CHERRY_PICK_CONTINUE';
export const IPC_INVOKE_GIT_CONFLICT_BLOBS = 'IPC_INVOKE_GIT_CONFLICT_BLOBS';
export const IPC_INVOKE_GIT_REMOVE = 'IPC_INVOKE_GIT_REMOVE';

export const IPC_INVOKE_GIT_CLONE = 'IPC_INVOKE_GIT_CLONE';
export const IPC_INVOKE_GIT_LS_REMOTE = 'IPC_INVOKE_GIT_LS_REMOTE';
export const IPC_INVOKE_GIT_CONNECT_TO_REMOTE = 'IPC_INVOKE_GIT_CONNECT_TO_REMOTE';

export const IPC_MESSAGE_GIT_CLONE_PROGRESS = 'IPC_MESSAGE_GIT_CLONE_PROGRESS';

/** Result of `IPC_INVOKE_GIT_STATUS`. */
export type GitStatusPayload = {
  readonly branch: SourceControlBranchInfo;
  readonly files: {
    readonly path: string;
    readonly indexStatus: SourceControlFileStatusCode | null;
    readonly workingTreeStatus: SourceControlFileStatusCode | null;
    readonly isConflicted: boolean;
  }[];
  readonly hasStash: boolean;
};
