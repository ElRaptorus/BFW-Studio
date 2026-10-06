import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { ILoadable } from '#bifrost/contracts/LoaderTypes';
import { MAXIMUM_HISTORY_SEARCH_LENGTH } from '#bifrost/contracts/SourceControlTypes';
import type {
  ModelChangeDigest,
  SourceControlBranchList,
  SourceControlChangedFile,
  SourceControlFileStatus,
  SourceControlHistoryEntry,
  SourceControlRepositoryState,
} from '#bifrost/contracts/SourceControlTypes';
import { createHash } from 'crypto';
import debounce from 'lodash.debounce';
import * as path from 'path';

import type { RepositoryStore } from '../RepositoryStore';

export const SOURCE_OVERVIEW_URI = 'git:overview';

const REFRESH_DEBOUNCE_MILLISECONDS = 500;

// ponytail: only the first 20 model files of a change list are summarized automatically, the rest wait for a click on
// "Summarize". Ceiling: a very large change set stays partly unsummarized until the user asks.
const EAGER_DIGEST_LIMIT = 20;

export const DIGEST_COMMANDS: Record<string, string> = {
  '.bpmn': 'bpmn.diff.getChangeDigest',
  '.dmn': 'dmn.diff.getChangeDigest',
};

// ponytail: the default base is guessed from the usual names; the branch `origin/HEAD` points to is not read.
const DEFAULT_BASE_CANDIDATES = ['main', 'master', 'origin/main', 'origin/master'];

type OverviewMode = 'uncommitted' | 'comparison' | 'history';

type OverviewAvailability = 'ready' | 'disabled' | 'git-missing' | 'no-repository';

type OverviewFileStatus = SourceControlChangedFile['status'] | 'conflicted';

/** One file in a list of changes, with the two versions a diff of it compares. */
export type OverviewFile = {
  /** Relative to the repository root. */
  readonly path: string;
  /** Path before a rename, or `null`. */
  readonly previousPath: string | null;
  readonly status: OverviewFileStatus;
  /** A commit hash, `HEAD`, `WORKING` or `NONE`, as understood by `git.showChangeDiff`. */
  readonly beforeRef: string;
  readonly afterRef: string;
};

export type DigestState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly digest: ModelChangeDigest }
  | { readonly kind: 'failed' };

/**
 * `loading` means the files are not known yet; `ready` has files; `on-base` means the branch is the base itself;
 * `no-base` means there is nothing to compare with; `failed` means git could not read the changes.
 */
type ComparisonState = {
  readonly kind: 'loading' | 'ready' | 'on-base' | 'no-base' | 'failed';
  readonly base: string | null;
  readonly files: readonly OverviewFile[];
};

export type ExpandedCommit =
  'loading' | { readonly files: readonly OverviewFile[]; readonly previewablePaths: ReadonlySet<string> };

export function isModelFile(relativePath: string): boolean {
  return DIGEST_COMMANDS[path.extname(relativePath).toLowerCase()] != null;
}

function toOverviewFile(file: SourceControlChangedFile, beforeRef: string, afterRef: string): OverviewFile {
  return {
    path: file.path,
    previousPath: file.previousPath,
    status: file.status,
    beforeRef: file.status === 'added' ? 'NONE' : beforeRef,
    afterRef: file.status === 'deleted' ? 'NONE' : afterRef,
  };
}

function toUncommittedFile(file: SourceControlFileStatus, isConflicted: boolean): OverviewFile {
  const codes = [file.workingTreeStatus, file.indexStatus];
  const isNew = codes.includes('untracked') || file.indexStatus === 'added';
  const isDeleted = codes.includes('deleted');

  // ponytail: a file staged as new and then deleted on disk shows as Deleted with no readable side, because its index
  // version has no ref here. Upgrade path: read the index version (`:0:<path>`) in getFileContentAtRevision.
  let status: OverviewFileStatus = 'modified';
  if (isConflicted) {
    status = 'conflicted';
  } else if (isDeleted) {
    status = 'deleted';
  } else if (isNew) {
    status = 'added';
  } else if (codes.includes('renamed')) {
    status = 'renamed';
  }

  return {
    path: file.path,
    previousPath: file.previousPath,
    status,
    beforeRef: isNew ? 'NONE' : 'HEAD',
    afterRef: isDeleted ? 'NONE' : 'WORKING',
  };
}

function buildUncommittedFiles(state: SourceControlRepositoryState): OverviewFile[] {
  const conflictedPaths = new Set([
    ...state.mergeState.conflictedFiles.map((file) => file.path),
    ...state.files
      .filter((file) => file.indexStatus === 'conflicted' || file.workingTreeStatus === 'conflicted')
      .map((file) => file.path),
  ]);

  const seenPaths = new Set<string>();
  const files: OverviewFile[] = [];
  for (const file of [...state.files, ...state.mergeState.conflictedFiles]) {
    if (seenPaths.has(file.path) || file.workingTreeStatus === 'ignored') {
      continue;
    }
    seenPaths.add(file.path);
    files.push(toUncommittedFile(file, conflictedPaths.has(file.path)));
  }
  return files;
}

function hashText(text: string | null): string {
  return text == null ? 'none' : createHash('sha1').update(text).digest('hex');
}

function isSameBranch(reference: string, currentBranch: string): boolean {
  return reference === currentBranch || reference.endsWith(`/${currentBranch}`);
}

/**
 * Finds what a branch can be compared with: the branches offered in the menu, the default base (the first usual
 * default branch other than the current one) and, when the current branch is itself the usual default, its name.
 */
function findComparisonBases(
  branchList: SourceControlBranchList,
  currentBranch: string,
): { options: string[]; defaultBase: string | null; baseBranchWeAreOn: string | null } {
  const names = new Set(branchList.branches.map((branch) => branch.name));
  const exists = (reference: string) => names.has(reference) || names.has(`remotes/${reference}`);
  const existingDefaults = DEFAULT_BASE_CANDIDATES.filter(exists);

  const localBranches = branchList.branches
    .filter((branch) => !branch.name.startsWith('remotes/') && branch.name !== currentBranch)
    .map((branch) => branch.name);
  const remoteDefaults = existingDefaults.filter(
    (reference) => reference.includes('/') && !names.has(reference.substring(reference.indexOf('/') + 1)),
  );

  const defaultBase = existingDefaults.find((reference) => !isSameBranch(reference, currentBranch)) ?? null;
  const baseBranchWeAreOn =
    defaultBase == null ? (existingDefaults.find((reference) => isSameBranch(reference, currentBranch)) ?? null) : null;

  return {
    options: [
      ...new Set([...localBranches, ...remoteDefaults.filter((reference) => !isSameBranch(reference, currentBranch))]),
    ],
    defaultBase,
    baseBranchWeAreOn,
  };
}

/**
 * The model of the Source Overview: pending changes with a short summary per model, the history of the checked-out
 * branch and the comparison with a base branch. Everything shown is derived from the repository selected in the Git
 * pane; the only view state kept in metadata is the mode, the chosen base and a revision counter.
 */
export default class SourceOverviewDocumentModel extends EditorDocumentModel {
  private readonly bifrost: Bifrost;
  private readonly repositoryStore: RepositoryStore;

  private mode: OverviewMode = 'uncommitted';
  private chosenBase: string | null = null;
  private revision = 0;
  private refreshSequence = 0;
  private subscriptions: { dispose: () => void }[] = [];
  // a status change updates the file lists, but does not read every model file again
  private readonly debouncedRefresh = debounce(() => void this.refresh(false), REFRESH_DEBOUNCE_MILLISECONDS);
  private refreshesRunning = 0;
  private changePending = false;

  private repositoryState: SourceControlRepositoryState | null = null;
  private uncommittedFiles: OverviewFile[] = [];
  private historyEntries: SourceControlHistoryEntry[] = [];
  private historyHasMore = false;
  private historySearchText = '';
  // every history load gets a number; the result of a load that is no longer the latest one is dropped
  private historySequence = 0;
  private historyReloading = false;
  private loadingMoreHistory = false;
  private comparison: ComparisonState = { kind: 'loading', base: null, files: [] };
  private baseOptions: string[] = [];
  private expandedCommits = new Map<string, ExpandedCommit>();
  private digests = new Map<string, DigestState>();
  private digestContentHashes = new Map<string, { beforeHash: string; afterHash: string }>();

  private constructor(uri: string, restoredMetadata: any, bifrost: Bifrost) {
    super(uri);

    this.bifrost = bifrost;
    this.repositoryStore = bifrost.commands.executeCommand<RepositoryStore>('git.getRepositoryStoreRef');
    if (restoredMetadata?.mode === 'comparison' || restoredMetadata?.mode === 'history') {
      this.mode = restoredMetadata.mode;
    }
    if (typeof restoredMetadata?.comparisonBase === 'string') {
      this.chosenBase = restoredMetadata.comparisonBase;
    }
  }

  static async create(
    uri: string,
    _restoredCurrentData: any,
    restoredMetadata: any,
    _fileLoader: ILoadable,
    bifrost: Bifrost,
  ): Promise<SourceOverviewDocumentModel> {
    return new SourceOverviewDocumentModel(uri, restoredMetadata, bifrost);
  }

  onEditorDocumentModelDidRegister(): void {
    this.updateLabel('Source Overview');
    this.subscriptions.push(
      this.bifrost.events.on('sourceControlStatusChanged', () => this.debouncedRefresh()),
      this.bifrost.events.on('sourceControlSelectedRepositoryChanged', () => this.debouncedRefresh()),
    );
    void this.refresh();
  }

  /** The files may have changed while another tab was in front. */
  onEditorDocumentDidFocus(): void {
    if (this.refreshesRunning === 0) {
      void this.refresh();
    }
  }

  onEditorDocumentWillClose(): void {
    this.debouncedRefresh.cancel();
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.subscriptions = [];
  }

  // ─── Getters ───────────────────────────────────────────────────────

  getRevision(): number {
    return this.revision;
  }

  getMode(): OverviewMode {
    return this.mode;
  }

  getAvailability(): OverviewAvailability {
    if (!this.repositoryStore.isEnabled) {
      return 'disabled';
    }
    if (!this.repositoryStore.isGitAvailable) {
      return 'git-missing';
    }
    return this.repositoryState == null ? 'no-repository' : 'ready';
  }

  getRepositoryRoot(): string | null {
    return this.repositoryState?.repositoryRoot ?? null;
  }

  getRepositoryName(): string {
    return this.repositoryState == null ? 'Source' : path.basename(this.repositoryState.repositoryRoot);
  }

  /** One line under the title, e.g. "main · 2 commits not pushed · 4 uncommitted changes". */
  getStatusSummary(): string {
    const branch = this.repositoryState?.branch;
    if (branch == null) {
      return '';
    }

    const parts: string[] = [];
    if (branch.detached) {
      parts.push('Detached — you are looking at an older commit, not a branch.');
    } else {
      parts.push(branch.current);
      if (branch.tracking == null) {
        parts.push('This branch is not on a server yet.');
      } else if (branch.ahead > 0) {
        parts.push(`${branch.ahead} ${branch.ahead === 1 ? 'commit' : 'commits'} not pushed`);
      }
    }

    const changeCount = this.uncommittedFiles.length;
    if (changeCount > 0) {
      parts.push(`${changeCount} uncommitted ${changeCount === 1 ? 'change' : 'changes'}`);
    }
    return parts.join(' · ');
  }

  getUncommittedFiles(): readonly OverviewFile[] {
    return this.uncommittedFiles;
  }

  getComparison(): ComparisonState {
    return this.comparison;
  }

  /** The branches offered as comparison base in the toolbar menu. */
  getBaseOptions(): readonly string[] {
    return this.baseOptions;
  }

  getHistory(): readonly SourceControlHistoryEntry[] {
    return this.historyEntries;
  }

  hasMoreHistory(): boolean {
    return this.historyHasMore;
  }

  /** The text the history is filtered by, empty when it is not. */
  getHistorySearchText(): string {
    return this.historySearchText;
  }

  getExpandedCommit(hash: string): ExpandedCommit | null {
    return this.expandedCommits.get(hash) ?? null;
  }

  /** `null` when no summary was requested for this file yet. */
  getDigest(file: OverviewFile): DigestState | null {
    return this.digests.get(this.getDigestKey(file)) ?? null;
  }

  // ─── Actions ───────────────────────────────────────────────────────

  /**
   * Reads the repository again. `rereadContents` makes the summaries of files that already have one read their
   * versions again; a refresh caused by a status change skips that, because the file lists are enough.
   */
  async refresh(rereadContents = true): Promise<void> {
    this.refreshesRunning++;
    try {
      await this.refreshRepository(rereadContents);
    } finally {
      this.refreshesRunning--;
    }
  }

  private async refreshRepository(rereadContents: boolean): Promise<void> {
    const sequence = ++this.refreshSequence;

    const selectedRepository = this.repositoryStore.getSelectedRepo();
    const states = this.repositoryStore.getAllRepoStates();
    const state = states.find((candidate) => candidate.repositoryRoot === selectedRepository) ?? states[0] ?? null;

    if (state?.repositoryRoot !== this.repositoryState?.repositoryRoot) {
      this.digests.clear();
      this.digestContentHashes.clear();
      this.expandedCommits.clear();
      this.historySearchText = '';
      if (state != null) {
        this.comparison = { kind: 'loading', base: null, files: [] };
      }
      if (this.repositoryState != null) {
        // the base of the previous repository means nothing here; the very first load keeps the restored one
        this.chosenBase = null;
      }
    }
    this.repositoryState = state;

    if (state == null) {
      this.uncommittedFiles = [];
      this.historyEntries = [];
      this.historyHasMore = false;
      this.historySequence++;
      this.historyReloading = false;
      this.comparison = { kind: 'no-base', base: null, files: [] };
      this.markChanged();
      return;
    }

    this.uncommittedFiles = buildUncommittedFiles(state);
    this.markChanged();

    // an empty repository has no history and no base to compare with; each part must work without the others
    const results = await Promise.allSettled([
      this.loadHistory(state.repositoryRoot, true),
      this.loadComparison(state, sequence, rereadContents),
      this.summarizeModelFiles(this.uncommittedFiles, rereadContents),
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[git-cruiser] Could not refresh a part of the Source Overview:', result.reason);
      }
    }
  }

  async setMode(mode: OverviewMode): Promise<void> {
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    if (mode === 'comparison') {
      this.comparison = { ...this.comparison, kind: 'loading', files: [] };
      this.markChanged();
    }
    await this.refresh();
  }

  async setComparisonBase(base: string): Promise<void> {
    this.chosenBase = base;
    this.mode = 'comparison';
    this.comparison = { ...this.comparison, kind: 'loading', files: [] };
    this.markChanged();
    await this.refresh();
  }

  async toggleCommit(hash: string): Promise<void> {
    if (this.expandedCommits.delete(hash)) {
      this.markChanged();
      return;
    }

    const repositoryRoot = this.getRepositoryRoot();
    const entry = this.historyEntries.find((candidate) => candidate.hash === hash);
    if (repositoryRoot == null || entry == null) {
      return;
    }

    this.expandedCommits.set(hash, 'loading');
    this.markChanged();

    try {
      const parent = entry.parents[0] ?? null;
      const changedFiles = await this.bifrost.sourceControl.getChangedFilesBetween(repositoryRoot, parent, hash);
      const files = changedFiles.map((file) => toOverviewFile(file, parent ?? 'NONE', hash));

      const previewablePaths = new Set<string>();
      await Promise.all(
        files
          .filter((file) => isModelFile(file.path) && file.status !== 'deleted')
          .map(async (file) => {
            const exists = await this.bifrost.files.doesFileOrDirectoryExist(`${repositoryRoot}/${file.path}`);
            if (exists) {
              previewablePaths.add(file.path);
            }
          }),
      );

      // the commit was collapsed, or another repository was selected, while the files were read
      if (this.expandedCommits.get(hash) !== 'loading' || this.getRepositoryRoot() !== repositoryRoot) {
        return;
      }
      this.expandedCommits.set(hash, { files, previewablePaths });
      this.markChanged();
      await this.summarizeModelFiles(files);
    } catch (error) {
      console.error('[git-cruiser] Could not read the files of commit', hash, error);
      if (this.expandedCommits.get(hash) !== 'loading' || this.getRepositoryRoot() !== repositoryRoot) {
        return;
      }
      this.expandedCommits.delete(hash);
      this.markChanged();
      this.bifrost.notifications.open('Could not read the files of this commit.');
    }
  }

  async loadMoreHistory(): Promise<void> {
    const repositoryRoot = this.getRepositoryRoot();
    if (repositoryRoot == null || !this.historyHasMore || this.historyReloading || this.loadingMoreHistory) {
      return;
    }

    const sequence = this.historySequence;
    this.loadingMoreHistory = true;
    try {
      const page = await this.repositoryStore.getHistory(
        repositoryRoot,
        this.historyEntries.length,
        this.historySearchText,
      );
      if (sequence !== this.historySequence) {
        return;
      }
      this.historyEntries = [...this.historyEntries, ...page.entries];
      this.historyHasMore = page.hasMore;
      this.markChanged();
    } catch {
      this.bifrost.notifications.open('Could not load older commits.');
    } finally {
      this.loadingMoreHistory = false;
    }
  }

  /** Lists only the commits whose message contains the text (the whole history is searched, not only what is loaded). */
  async setHistorySearchText(text: string): Promise<void> {
    const searchText = text.trim().substring(0, MAXIMUM_HISTORY_SEARCH_LENGTH);
    const repositoryRoot = this.getRepositoryRoot();
    if (searchText === this.historySearchText || repositoryRoot == null) {
      return;
    }

    this.historySearchText = searchText;
    try {
      await this.loadHistory(repositoryRoot, false);
    } catch {
      this.bifrost.notifications.open('Could not search the commits.');
    }
  }

  /** Summarizes a model file that was beyond the automatic limit. */
  async summarizeFile(file: OverviewFile): Promise<void> {
    await this.summarize(file);
  }

  // ─── Loading ───────────────────────────────────────────────────────

  /** `keepLoadedCount` reads as many pages as were shown before, so a refresh does not collapse a long list. */
  private async loadHistory(repositoryRoot: string, keepLoadedCount: boolean): Promise<void> {
    const sequence = ++this.historySequence;
    const searchText = this.historySearchText;
    const wantedLength = keepLoadedCount ? this.historyEntries.length : 0;

    this.historyReloading = true;
    try {
      let page = await this.repositoryStore.getHistory(repositoryRoot, 0, searchText);
      const entries = [...page.entries];
      while (page.hasMore && entries.length < wantedLength) {
        page = await this.repositoryStore.getHistory(repositoryRoot, entries.length, searchText);
        entries.push(...page.entries);
      }

      if (sequence !== this.historySequence) {
        return;
      }
      this.historyEntries = entries;
      this.historyHasMore = page.hasMore;

      const shownHashes = new Set(entries.map((entry) => entry.hash));
      for (const hash of this.expandedCommits.keys()) {
        if (!shownHashes.has(hash)) {
          this.expandedCommits.delete(hash);
        }
      }
      this.markChanged();
    } finally {
      if (sequence === this.historySequence) {
        this.historyReloading = false;
      }
    }
  }

  private async loadComparison(
    state: SourceControlRepositoryState,
    sequence: number,
    rereadContents: boolean,
  ): Promise<void> {
    const repositoryRoot = state.repositoryRoot;
    let options = this.baseOptions;
    let comparison: ComparisonState;
    try {
      const branchList = await this.bifrost.sourceControl.getBranches(repositoryRoot);
      const bases = findComparisonBases(branchList, state.branch.current);
      options = bases.options;
      const { defaultBase, baseBranchWeAreOn } = bases;

      // a chosen base that no longer exists (deleted branch, other repository) is ignored
      const base = this.chosenBase != null && options.includes(this.chosenBase) ? this.chosenBase : defaultBase;
      if (base == null) {
        comparison = { kind: baseBranchWeAreOn == null ? 'no-base' : 'on-base', base: baseBranchWeAreOn, files: [] };
      } else if (isSameBranch(base, state.branch.current)) {
        comparison = { kind: 'on-base', base, files: [] };
      } else if (this.mode !== 'comparison') {
        // the toolbar names the base even while the uncommitted changes are shown; the files are needed on demand
        comparison = { kind: 'ready', base, files: [] };
      } else {
        const mergeBase = await this.bifrost.sourceControl.getMergeBase(repositoryRoot, base, 'HEAD');
        const changedFiles =
          mergeBase == null
            ? []
            : await this.bifrost.sourceControl.getChangedFilesBetween(repositoryRoot, mergeBase, 'HEAD');
        comparison = {
          kind: 'ready',
          base,
          files: changedFiles.map((file) => toOverviewFile(file, mergeBase ?? 'NONE', 'HEAD')),
        };
      }
    } catch (error) {
      console.error('[git-cruiser] Could not read the changes of this branch:', error);
      comparison = { kind: 'failed', base: this.comparison.base, files: [] };
    }

    if (sequence !== this.refreshSequence) {
      return;
    }
    this.baseOptions = options;
    this.comparison = comparison;
    this.markChanged();
    await this.summarizeModelFiles(comparison.files, rereadContents);
  }

  // ─── Digests ───────────────────────────────────────────────────────

  private async summarizeModelFiles(files: readonly OverviewFile[], rereadContents = true): Promise<void> {
    for (const file of files.filter((candidate) => isModelFile(candidate.path)).slice(0, EAGER_DIGEST_LIMIT)) {
      await this.summarize(file, rereadContents);
    }
  }

  private getDigestKey(file: OverviewFile): string {
    return [this.getRepositoryRoot(), file.path, file.beforeRef, file.afterRef].join('\u0000');
  }

  private async summarize(file: OverviewFile, rereadContents = true): Promise<void> {
    const repositoryRoot = this.getRepositoryRoot();
    const command = DIGEST_COMMANDS[path.extname(file.path).toLowerCase()];
    if (
      repositoryRoot == null ||
      command == null ||
      file.status === 'conflicted' ||
      !this.bifrost.commands.isRegistered(command)
    ) {
      return;
    }

    const key = this.getDigestKey(file);
    if (!rereadContents && this.digests.get(key)?.kind === 'ready') {
      return;
    }
    if (!this.digests.has(key)) {
      this.digests.set(key, { kind: 'loading' });
      this.markChanged();
    }

    try {
      const [beforeText, afterText] = await Promise.all([
        this.readVersion(repositoryRoot, file.beforeRef, file.previousPath ?? file.path),
        this.readVersion(repositoryRoot, file.afterRef, file.path),
      ]);

      const beforeHash = hashText(beforeText);
      const afterHash = hashText(afterText);
      const known = this.digestContentHashes.get(key);
      if (
        known?.beforeHash === beforeHash &&
        known.afterHash === afterHash &&
        this.digests.get(key)?.kind === 'ready'
      ) {
        return;
      }

      const digest = await this.bifrost.commands.executeCommand<ModelChangeDigest>(command, [beforeText, afterText]);
      this.digestContentHashes.set(key, { beforeHash, afterHash });
      this.digests.set(key, { kind: 'ready', digest });
    } catch {
      this.digests.set(key, { kind: 'failed' });
    }
    this.markChanged();
  }

  private async readVersion(repositoryRoot: string, ref: string, relativePath: string): Promise<string | null> {
    if (ref === 'NONE') {
      return null;
    }
    if (ref === 'WORKING') {
      return this.bifrost.files.load(`file://${repositoryRoot}/${relativePath}`);
    }
    return this.bifrost.sourceControl.getFileContentAtRevision(repositoryRoot, ref, relativePath);
  }

  /** Many changes within one task (a refresh touches the model several times) produce one update of the view. */
  private markChanged(): void {
    if (this.changePending) {
      return;
    }
    this.changePending = true;
    queueMicrotask(() => {
      this.changePending = false;
      this.revision++;
      this.updateMetadata({ revision: this.revision, mode: this.mode, comparisonBase: this.chosenBase });
    });
  }
}
