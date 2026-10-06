import type { Bifrost } from '#bifrost/Bifrost';
import type {
  SourceControlCommitResult,
  SourceControlFileStatus,
  SourceControlPullResult,
  SourceControlRepositoryState,
} from '#bifrost/contracts/SourceControlTypes';
import debounce from 'lodash.debounce';

import type { CommitOptions, HistoryPage } from './GitTypes';
import type { GitDecorationProvider } from './initializers/initializeDecorations';

/** Number of history entries the Source Overview loads per page. */
const GIT_HISTORY_PAGE_SIZE = 100;

/**
 * The git-cruiser view of the solution's repositories: which project lives in which repository, the last known state
 * of each repository, and the selected repository. Operations that change a repository go through here so the state
 * is refreshed afterwards; read-only queries go to `bifrost.sourceControl` directly.
 */
export class RepositoryStore {
  private readonly bifrost: Bifrost;
  private gitAvailable = false;

  private repoStateMap = new Map<string, SourceControlRepositoryState>();
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

  private get sourceControl(): Bifrost['sourceControl'] {
    return this.bifrost.sourceControl;
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

  setSelectedRepo(repositoryRoot: string | null): void {
    if (this.selectedRepo === repositoryRoot) {
      return;
    }
    this.selectedRepo = repositoryRoot;
    this.bifrost.events.emitInternalBifrostEvent('sourceControlSelectedRepositoryChanged', [repositoryRoot]);
  }

  hasSelectedRepo(): boolean {
    return this.selectedRepo != null;
  }

  getRepoState(repositoryRoot: string): SourceControlRepositoryState | undefined {
    return this.repoStateMap.get(repositoryRoot);
  }

  getAllRepoStates(): SourceControlRepositoryState[] {
    return Array.from(this.repoStateMap.values());
  }

  getRepoRootForUri(uri: string): string | null {
    const filePath = this.uriToPath(uri);
    for (const [, repositoryRoot] of this.repoRootForProject) {
      if (filePath.startsWith(repositoryRoot)) {
        return repositoryRoot;
      }
    }
    return null;
  }

  getFileStatus(uri: string): SourceControlFileStatus | null {
    const repositoryRoot = this.getRepoRootForUri(uri);
    if (!repositoryRoot) {
      return null;
    }

    const state = this.repoStateMap.get(repositoryRoot);
    if (!state) {
      return null;
    }

    const filePath = this.uriToPath(uri);
    const relativePath = filePath.substring(repositoryRoot.length + 1);

    return state.files.find((fileStatus) => fileStatus.path === relativePath) ?? null;
  }

  isTrackedFile(uri: string): boolean {
    const repositoryRoot = this.getRepoRootForUri(uri);
    if (!repositoryRoot) {
      return false;
    }

    const state = this.repoStateMap.get(repositoryRoot);
    if (!state) {
      return false;
    }

    const filePath = this.uriToPath(uri);
    const relativePath = filePath.substring(repositoryRoot.length + 1);

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
    const repositoryRoot = this.getRepoRootForUri(uri);
    if (!repositoryRoot) {
      this.fileHistoryCache.set(uri, false);
      return;
    }

    this.fileHistoryCache.set(uri, 'pending');

    const relativePath = this.uriToPath(uri).substring(repositoryRoot.length + 1);

    this.sourceControl
      .getLog(repositoryRoot, { file: relativePath, maxCount: 2 })
      .then((log) => {
        this.fileHistoryCache.set(uri, log.length >= 2);
        this.bifrost.events.emit('unspecifiedGlobalUpdate');
      })
      .catch(() => {
        this.fileHistoryCache.set(uri, false);
      });
  }

  async initialize(): Promise<void> {
    this.gitAvailable = await this.sourceControl.isAvailable();

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
      const projectPath = this.uriToPath(project.baseUri);

      const repositoryRoot = await this.sourceControl.findRepositoryRoot(projectPath);
      if (repositoryRoot) {
        newProjectMap.set(projectPath, repositoryRoot);
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

    for (const repositoryRoot of uniqueRoots) {
      await this.refreshRepo(repositoryRoot);
    }
  }

  async refreshRepo(repositoryRoot: string): Promise<void> {
    try {
      this.repoStateMap.set(repositoryRoot, await this.sourceControl.getRepositoryState(repositoryRoot));
    } catch (error) {
      console.error(`[git-cruiser] Failed to refresh repo at ${repositoryRoot}:`, error);
      this.repoStateMap.delete(repositoryRoot);
    }

    this.emitStatusChanged();
  }

  private emitStatusChanged(): void {
    this.fileHistoryCache.clear();
    this.bifrost.events.emitInternalBifrostEvent('sourceControlStatusChanged', []);
    this.bifrost.events.emit('unspecifiedGlobalUpdate');
    this.decorationProvider?.refresh(this.getAllRepoStates());
  }

  scheduleRefresh(): void {
    this.debouncedRefresh();
  }

  async stage(repositoryRoot: string, filePaths: string[]): Promise<void> {
    await this.sourceControl.stage(repositoryRoot, filePaths);
    await this.refreshRepo(repositoryRoot);
  }

  async unstage(repositoryRoot: string, filePaths: string[]): Promise<void> {
    await this.sourceControl.unstage(repositoryRoot, filePaths);
    await this.refreshRepo(repositoryRoot);
  }

  async commit(repositoryRoot: string, options: CommitOptions): Promise<SourceControlCommitResult> {
    const message = options.body ? `${options.title}\n\n${options.body}` : options.title;
    const result = await this.sourceControl.commit(repositoryRoot, message);
    await this.refreshRepo(repositoryRoot);
    return result;
  }

  async push(repositoryRoot: string, options?: { setUpstream?: boolean }): Promise<void> {
    await this.sourceControl.push(repositoryRoot, options);
    await this.refreshRepo(repositoryRoot);
  }

  async pull(repositoryRoot: string, options?: { rebase?: boolean }): Promise<SourceControlPullResult> {
    const result = await this.sourceControl.pull(repositoryRoot, options);

    if (result.success) {
      await this.refreshRepo(repositoryRoot);
      const state = this.repoStateMap.get(repositoryRoot);
      if (state?.mergeState.kind != null && state.mergeState.conflictedFiles.length > 0) {
        return { success: false, error: 'Merge conflicts detected', recoverable: 'merge-conflicts' };
      }
    } else if (result.recoverable === 'merge-conflicts') {
      await this.refreshRepo(repositoryRoot);
    }

    return result;
  }

  async revert(repositoryRoot: string, filePaths: string[]): Promise<void> {
    await this.sourceControl.revert(repositoryRoot, filePaths);
    await this.refreshRepo(repositoryRoot);
  }

  async stash(repositoryRoot: string, message?: string): Promise<void> {
    await this.sourceControl.stash(repositoryRoot, message);
    await this.refreshRepo(repositoryRoot);
  }

  async stashApply(repositoryRoot: string, index?: number, options?: { restoreIndex?: boolean }): Promise<void> {
    await this.sourceControl.stashApply(repositoryRoot, index, options);
    await this.refreshRepo(repositoryRoot);
  }

  async switchBranch(repositoryRoot: string, branchName: string): Promise<void> {
    await this.sourceControl.switchBranch(repositoryRoot, branchName);
    await this.refreshRepo(repositoryRoot);
  }

  async createBranch(repositoryRoot: string, branchName: string, checkout = true): Promise<void> {
    await this.sourceControl.createBranch(repositoryRoot, branchName, checkout);
    await this.refreshRepo(repositoryRoot);
  }

  /**
   * First-parent history of the checked-out branch, newest first. `skip` and `maxCount` page through it; the upstream
   * (when the branch has one) marks commits that are not pushed yet.
   */
  async getHistory(repositoryRoot: string, skip: number, maxCount = GIT_HISTORY_PAGE_SIZE): Promise<HistoryPage> {
    const upstream = this.repoStateMap.get(repositoryRoot)?.branch.tracking ?? null;
    const entries = await this.sourceControl.getHistory(repositoryRoot, { skip, maxCount, upstream });
    // ponytail: a history whose length is an exact multiple of the page size offers "load more" once and then gets an
    // empty page. Upgrade path: request maxCount + 1 and drop the extra entry.
    return { entries, hasMore: maxCount > 0 && entries.length === maxCount };
  }

  async remove(repositoryRoot: string, filePaths: string[]): Promise<void> {
    await this.sourceControl.remove(repositoryRoot, filePaths);
    await this.refreshRepo(repositoryRoot);
  }

  async mergeAbort(repositoryRoot: string): Promise<void> {
    await this.sourceControl.mergeAbort(repositoryRoot);
    await this.refreshRepo(repositoryRoot);
  }

  async rebaseAbort(repositoryRoot: string): Promise<void> {
    await this.sourceControl.rebaseAbort(repositoryRoot);
    await this.refreshRepo(repositoryRoot);
  }

  async rebaseContinue(repositoryRoot: string): Promise<void> {
    await this.sourceControl.rebaseContinue(repositoryRoot);
    await this.refreshRepo(repositoryRoot);
  }

  async cherryPickAbort(repositoryRoot: string): Promise<void> {
    await this.sourceControl.cherryPickAbort(repositoryRoot);
    await this.refreshRepo(repositoryRoot);
  }

  async cherryPickContinue(repositoryRoot: string): Promise<void> {
    await this.sourceControl.cherryPickContinue(repositoryRoot);
    await this.refreshRepo(repositoryRoot);
  }

  async clone(url: string, targetDirectory: string, branch?: string): Promise<void> {
    await this.sourceControl.clone(url, targetDirectory, branch);
    await this.detectRepos();
  }

  async connectFolderToRemote(targetDirectory: string, url: string, branch: string, newBranch?: string): Promise<void> {
    await this.sourceControl.connectFolderToRemote(targetDirectory, url, branch, newBranch);
    await this.detectRepos();
  }

  private uriToPath(uri: string): string {
    if (uri.startsWith('file://')) {
      return uri.substring('file://'.length);
    }
    return uri;
  }
}
