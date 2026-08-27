import type { Bifrost } from '#bifrost/Bifrost';
import { ipcRenderer } from 'electron';
import debounce from 'lodash.debounce';

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
  IPC_INVOKE_GIT_FETCH,
  IPC_INVOKE_GIT_IS_AVAILABLE,
  IPC_INVOKE_GIT_IS_REPO,
  IPC_INVOKE_GIT_LOG,
  IPC_INVOKE_GIT_LS_REMOTE,
  IPC_INVOKE_GIT_MERGE_ABORT,
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
} from './GitIpcChannels';
import type {
  GitCommitOptions,
  GitConflictBlobs,
  GitFileStatus,
  GitFileStatusCode,
  GitLogEntry,
  GitMergeState,
  GitMergeStateType,
  GitPullResult,
  GitRemoteBranch,
  GitRepoState,
  GitStashEntry,
} from './GitTypes';
import type { GitDecorationProvider } from './initializers/initializeDecorations';

function mapStatusCode(code: string): GitFileStatusCode | null {
  switch (code.trim()) {
    case 'M':
      return 'modified';
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    case '?':
      return 'untracked';
    case '!':
      return 'ignored';
    case 'U':
      return 'conflicted';
    case '':
    case ' ':
      return null;
    default:
      return 'modified';
  }
}

export class GitService {
  private readonly bifrost: Bifrost;
  private gitAvailable = false;

  private repoStateMap = new Map<string, GitRepoState>();
  private repoRootForProject = new Map<string, string>();
  private decorationProvider: GitDecorationProvider | null = null;
  private selectedRepo: string | null = null;
  isSyncing = false;

  private readonly debouncedRefresh: () => void;
  private fileHistoryCache = new Map<string, boolean | 'pending'>();

  constructor(bifrost: Bifrost) {
    this.bifrost = bifrost;
    const debounceMs = bifrost.settings.get('gitCruiser.general.refreshDebounceMs') ?? 500;
    this.debouncedRefresh = debounce(() => this.refreshAllRepos(), debounceMs);
  }

  setDecorationProvider(provider: GitDecorationProvider): void {
    this.decorationProvider = provider;
  }

  get isGitAvailable(): boolean {
    return this.gitAvailable;
  }

  get isEnabled(): boolean {
    return this.bifrost.settings.get('gitCruiser.general.enabled') !== false;
  }

  get isActive(): boolean {
    return this.gitAvailable && this.isEnabled;
  }

  getSelectedRepo(): string | null {
    return this.selectedRepo;
  }

  setSelectedRepo(repoRoot: string): void {
    this.selectedRepo = repoRoot;
  }

  hasSelectedRepo(): boolean {
    return this.selectedRepo != null;
  }

  getRepoState(repoRoot: string): GitRepoState | undefined {
    return this.repoStateMap.get(repoRoot);
  }

  getAllRepoStates(): GitRepoState[] {
    return Array.from(this.repoStateMap.values());
  }

  getRepoRootForUri(uri: string): string | null {
    const filePath = this.uriToPath(uri);
    for (const [, repoRoot] of this.repoRootForProject) {
      if (filePath.startsWith(repoRoot)) {
        return repoRoot;
      }
    }
    return null;
  }

  getFileStatus(uri: string): GitFileStatus | null {
    const repoRoot = this.getRepoRootForUri(uri);
    if (!repoRoot) {
      return null;
    }

    const state = this.repoStateMap.get(repoRoot);
    if (!state) {
      return null;
    }

    const filePath = this.uriToPath(uri);
    const relativePath = filePath.substring(repoRoot.length + 1);

    return state.files.find((fileStatus) => fileStatus.path === relativePath) ?? null;
  }

  isTrackedFile(uri: string): boolean {
    const repoRoot = this.getRepoRootForUri(uri);
    if (!repoRoot) {
      return false;
    }

    const state = this.repoStateMap.get(repoRoot);
    if (!state) {
      return false;
    }

    const filePath = this.uriToPath(uri);
    const relativePath = filePath.substring(repoRoot.length + 1);

    const status = state.files.find((fileStatus) => fileStatus.path === relativePath);
    return status == null || status.workingTreeStatus !== 'untracked';
  }

  hasModifications(uri: string): boolean {
    const status = this.getFileStatus(uri);
    return status != null && status.workingTreeStatus !== 'untracked';
  }

  /**
   * Synchronous enablement check for `git.showFileHistory`.
   *
   * Returns `false` only after a completed check found fewer than 2 commits.
   * Unknown and in-flight lookups return `true` so `executeCommand` is not
   * blocked while `getLog` runs. The handler itself awaits `getLog` and
   * notifies if there is nothing to browse. A cache miss starts
   * `checkFileHistoryInBackground`, which emits `unspecifiedGlobalUpdate`
   * when the result is stored.
   */
  hasFileHistory(uri: string): boolean {
    const cached = this.fileHistoryCache.get(uri);
    if (cached === true) {
      return true;
    }
    if (cached === false) {
      return false;
    }
    if (cached !== 'pending') {
      this.checkFileHistoryInBackground(uri);
    }
    // Unknown or in-flight: stay enabled. Returning false here made
    // executeCommand throw on the first call and after every status refresh
    // (emitStatusChanged clears this cache). showFileHistory awaits getLog
    // and notifies if there is nothing to browse.
    return true;
  }

  private checkFileHistoryInBackground(uri: string): void {
    const repoRoot = this.getRepoRootForUri(uri);
    if (!repoRoot) {
      this.fileHistoryCache.set(uri, false);
      return;
    }

    this.fileHistoryCache.set(uri, 'pending');

    const filePath = uri.startsWith('file://') ? uri.substring('file://'.length) : uri;
    const relativePath = filePath.substring(repoRoot.length + 1);

    this.getLog(repoRoot, { file: relativePath, maxCount: 2 })
      .then((log) => {
        this.fileHistoryCache.set(uri, log.length >= 2);
        this.bifrost.events.emit('unspecifiedGlobalUpdate');
      })
      .catch(() => {
        this.fileHistoryCache.set(uri, false);
      });
  }

  async initialize(): Promise<void> {
    const result = await ipcRenderer.invoke(IPC_INVOKE_GIT_IS_AVAILABLE);
    this.gitAvailable = result.available;

    if (!this.gitAvailable) {
      return;
    }

    await this.detectRepos();
  }

  async detectRepos(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    const solution = this.bifrost.solution.getSolution();
    if (!solution) {
      this.repoRootForProject.clear();
      this.repoStateMap.clear();
      this.emitStatusChanged();
      return;
    }

    const newProjectMap = new Map<string, string>();

    for (const project of solution.projects) {
      const baseUri = project.baseUri;
      const projectPath = this.uriToPath(baseUri);

      const result = await ipcRenderer.invoke(IPC_INVOKE_GIT_IS_REPO, projectPath);
      if (result.isRepo && result.root) {
        newProjectMap.set(projectPath, result.root);
      }
    }

    const newRoots = new Set(newProjectMap.values());
    for (const oldRoot of this.repoStateMap.keys()) {
      if (!newRoots.has(oldRoot)) {
        this.repoStateMap.delete(oldRoot);
      }
    }

    this.repoRootForProject = newProjectMap;
    await this.refreshAllRepos();
  }

  async refreshAllRepos(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    const uniqueRoots = new Set(this.repoRootForProject.values());

    for (const repoRoot of uniqueRoots) {
      await this.refreshRepo(repoRoot);
    }
  }

  async refreshRepo(repoRoot: string): Promise<void> {
    try {
      const [rawStatus, rawMergeState] = await Promise.all([
        ipcRenderer.invoke(IPC_INVOKE_GIT_STATUS, repoRoot),
        ipcRenderer.invoke(IPC_INVOKE_GIT_MERGE_STATE, repoRoot),
      ]);

      const files: GitFileStatus[] = rawStatus.files.map((rawFile: any) => ({
        uri: this.pathToUri(`${repoRoot}/${rawFile.path}`),
        path: rawFile.path,
        indexStatus: mapStatusCode(rawFile.indexStatus),
        workingTreeStatus: mapStatusCode(rawFile.workingTreeStatus),
      }));

      const mergeKind: GitMergeStateType = rawMergeState.kind ?? null;
      const conflictedFiles = files.filter(
        (file, index) =>
          file.workingTreeStatus === 'conflicted' ||
          file.indexStatus === 'conflicted' ||
          rawStatus.files[index].isConflicted === true,
      );

      const mergeState: GitMergeState = {
        kind: mergeKind,
        conflictedFiles,
      };

      const state: GitRepoState = {
        repoRoot,
        branch: rawStatus.branch,
        files,
        hasStash: rawStatus.hasStash,
        mergeState,
      };

      this.repoStateMap.set(repoRoot, state);
    } catch (error) {
      console.error(`[git-cruiser] Failed to refresh repo at ${repoRoot}:`, error);
      this.repoStateMap.delete(repoRoot);
    }

    this.emitStatusChanged();
  }

  private emitStatusChanged(): void {
    this.fileHistoryCache.clear();
    this.bifrost.events.emitInternalBifrostEvent('gitStatusChanged', []);
    this.bifrost.events.emit('unspecifiedGlobalUpdate');
    this.decorationProvider?.refresh(this.getAllRepoStates());
  }

  scheduleRefresh(): void {
    this.debouncedRefresh();
  }

  async stage(repoRoot: string, filePaths: string[]): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_STAGE, repoRoot, filePaths);
    await this.refreshRepo(repoRoot);
  }

  async unstage(repoRoot: string, filePaths: string[]): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_UNSTAGE, repoRoot, filePaths);
    await this.refreshRepo(repoRoot);
  }

  async commit(repoRoot: string, options: GitCommitOptions): Promise<{ hash: string; summary: any }> {
    const message = options.body ? `${options.title}\n\n${options.body}` : options.title;
    const result = await ipcRenderer.invoke(IPC_INVOKE_GIT_COMMIT, repoRoot, message);
    await this.refreshRepo(repoRoot);
    return result;
  }

  async push(repoRoot: string, options?: { setUpstream?: boolean }): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_PUSH, repoRoot, options);
    await this.refreshRepo(repoRoot);
  }

  async pull(repoRoot: string, options?: { rebase?: boolean }): Promise<GitPullResult> {
    try {
      await ipcRenderer.invoke(IPC_INVOKE_GIT_PULL, repoRoot, options);
      await this.refreshRepo(repoRoot);

      const state = this.repoStateMap.get(repoRoot);
      if (state?.mergeState.kind != null && state.mergeState.conflictedFiles.length > 0) {
        return { success: false, error: 'Merge conflicts detected', recoverable: 'merge-conflicts' };
      }

      return { success: true };
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      let recoverable: GitPullResult['recoverable'] = null;

      if (msg.includes('CONFLICT') || msg.includes('Automatic merge failed')) {
        await this.refreshRepo(repoRoot);
        recoverable = 'merge-conflicts';
      } else if (msg.includes('diverged') || msg.includes('overwritten by merge')) {
        recoverable = 'rebase';
      } else if (msg.includes('uncommitted changes') || msg.includes('not possible because you have unmerged')) {
        recoverable = 'stash-and-retry';
      }

      return { success: false, error: msg, recoverable };
    }
  }

  async fetch(repoRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_FETCH, repoRoot);
  }

  async revert(repoRoot: string, filePaths: string[]): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_REVERT, repoRoot, filePaths);
    await this.refreshRepo(repoRoot);
  }

  async stash(repoRoot: string, message?: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_STASH, repoRoot, message);
    await this.refreshRepo(repoRoot);
  }

  async stashApply(repoRoot: string, index?: number, options?: { restoreIndex?: boolean }): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_STASH_APPLY, repoRoot, index, options);
    await this.refreshRepo(repoRoot);
  }

  async stashList(repoRoot: string): Promise<GitStashEntry[]> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_STASH_LIST, repoRoot);
  }

  async getBranches(repoRoot: string): Promise<{ current: string; branches: any[] }> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_BRANCH_LIST, repoRoot);
  }

  async switchBranch(repoRoot: string, branchName: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_BRANCH_SWITCH, repoRoot, branchName);
    await this.refreshRepo(repoRoot);
  }

  async createBranch(repoRoot: string, branchName: string, checkout = true): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_BRANCH_CREATE, repoRoot, branchName, checkout);
    await this.refreshRepo(repoRoot);
  }

  async showFileAtRef(repoRoot: string, ref: string): Promise<string> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_SHOW, repoRoot, ref);
  }

  async getLog(repoRoot: string, options?: { maxCount?: number; file?: string }): Promise<GitLogEntry[]> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_LOG, repoRoot, options);
  }

  async getConflictBlobs(repoRoot: string, relativePath: string): Promise<GitConflictBlobs> {
    return await ipcRenderer.invoke(IPC_INVOKE_GIT_CONFLICT_BLOBS, repoRoot, relativePath);
  }

  async remove(repoRoot: string, filePaths: string[]): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_REMOVE, repoRoot, filePaths);
    await this.refreshRepo(repoRoot);
  }

  async mergeAbort(repoRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_MERGE_ABORT, repoRoot);
    await this.refreshRepo(repoRoot);
  }

  async rebaseAbort(repoRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_REBASE_ABORT, repoRoot);
    await this.refreshRepo(repoRoot);
  }

  async rebaseContinue(repoRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_REBASE_CONTINUE, repoRoot);
    await this.refreshRepo(repoRoot);
  }

  async cherryPickAbort(repoRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_CHERRY_PICK_ABORT, repoRoot);
    await this.refreshRepo(repoRoot);
  }

  async cherryPickContinue(repoRoot: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_CHERRY_PICK_CONTINUE, repoRoot);
    await this.refreshRepo(repoRoot);
  }

  async clone(url: string, targetDir: string, branch?: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_CLONE, url, targetDir, branch);
    await this.detectRepos();
  }

  async listRemoteBranches(url: string): Promise<GitRemoteBranch[]> {
    const result = await ipcRenderer.invoke(IPC_INVOKE_GIT_LS_REMOTE, url);
    return result.branches;
  }

  async connectFolderToRemote(targetDir: string, url: string, branch: string, newBranch?: string): Promise<void> {
    await ipcRenderer.invoke(IPC_INVOKE_GIT_CONNECT_TO_REMOTE, url, targetDir, branch, newBranch);
    await this.detectRepos();
  }

  onCloneProgress(callback: (stage: string, progress: number) => void): () => void {
    const handler = (_event: any, data: { stage: string; progress: number }): void => {
      callback(data.stage, data.progress);
    };
    ipcRenderer.on(IPC_MESSAGE_GIT_CLONE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_MESSAGE_GIT_CLONE_PROGRESS, handler);
  }

  private uriToPath(uri: string): string {
    if (uri.startsWith('file://')) {
      return uri.substring('file://'.length);
    }
    return uri;
  }

  private pathToUri(filePath: string): string {
    if (filePath.startsWith('file://')) {
      return filePath;
    }
    return `file://${filePath}`;
  }
}
