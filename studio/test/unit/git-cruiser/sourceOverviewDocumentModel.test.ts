import { describe, expect, it, vi } from 'vitest';

import { EVENT_METADATA_UPDATED } from '../../../src/bifrost/contracts/internal/EditorEvents';
import SourceOverviewDocumentModel, {
  SOURCE_OVERVIEW_URI,
  isModelFile,
} from '../../../src/modules/git-cruiser/overview/SourceOverviewDocumentModel';

const repositoryRoot = '/work/repository';

function createFile(path: string, workingTreeStatus: string | null, indexStatus: string | null = null) {
  return { uri: `file://${repositoryRoot}/${path}`, path, workingTreeStatus, indexStatus, previousPath: null };
}

type FakeOptions = {
  files?: any[];
  conflictedFiles?: any[];
  branch?: Partial<{ current: string; tracking: string | null; ahead: number; detached: boolean }>;
  branchNames?: string[];
  mergeBase?: string | null;
  changedFilesBetween?: any[];
  historyEntries?: any[];
  existingFiles?: string[];
};

function createFakeModelEnvironment(options: FakeOptions = {}) {
  const state = {
    repositoryRoot,
    branch: { current: 'feature', tracking: 'origin/feature', ahead: 2, behind: 0, detached: false, ...options.branch },
    files: options.files ?? [],
    hasStash: false,
    mergeState: { kind: null, conflictedFiles: options.conflictedFiles ?? [] },
  };

  const store = {
    isEnabled: true,
    isGitAvailable: true,
    getSelectedRepo: () => repositoryRoot,
    getAllRepoStates: () => [state],
    getHistory: vi.fn(async (_root: string, _skip: number, _searchText?: string) => ({
      entries: options.historyEntries ?? [],
      hasMore: false,
    })),
  };

  const executeCommand = vi.fn((command: string, args?: any[]) => {
    if (command === 'git.getRepositoryStoreRef') {
      return store;
    }
    return { fileChange: 'modified', modelName: 'Order', addedElementNames: [args?.[1]], modifiedElementNames: [] };
  });

  const sourceControl = {
    getBranches: vi.fn(async () => ({
      current: state.branch.current,
      branches: (options.branchNames ?? ['feature', 'main']).map((name) => ({ name, current: false })),
    })),
    getMergeBase: vi.fn(async () => (options.mergeBase === undefined ? 'base123' : options.mergeBase)),
    getChangedFilesBetween: vi.fn(async () => options.changedFilesBetween ?? []),
    getFileContentAtRevision: vi.fn(async (_root: string, revision: string, path: string) => `${path}@${revision}`),
  };

  const bifrost = {
    commands: { executeCommand, isRegistered: () => true },
    events: { on: () => ({ dispose: () => undefined }) },
    sourceControl,
    files: {
      load: vi.fn(async (uri: string) => `disk:${uri}`),
      doesFileOrDirectoryExist: async (path: string) => (options.existingFiles ?? []).includes(path),
    },
    notifications: { open: vi.fn() },
  } as any;

  return { bifrost, sourceControl, executeCommand, store };
}

async function createModel(environment: ReturnType<typeof createFakeModelEnvironment>, metadata: any = null) {
  const model = await SourceOverviewDocumentModel.create(
    SOURCE_OVERVIEW_URI,
    null,
    metadata,
    null as any,
    environment.bifrost,
  );
  await model.refresh();
  return model;
}

describe('SourceOverviewDocumentModel', () => {
  it('recognizes BPMN and DMN files as models', () => {
    expect(isModelFile('a/order.bpmn')).toBe(true);
    expect(isModelFile('rules.DMN')).toBe(true);
    expect(isModelFile('readme.md')).toBe(false);
  });

  it('maps pending changes to two versions each and summarizes only model files', async () => {
    const environment = createFakeModelEnvironment({
      files: [
        createFile('order.bpmn', 'modified'),
        createFile('notes.txt', 'untracked'),
        createFile('old.dmn', 'deleted'),
      ],
      conflictedFiles: [createFile('clash.bpmn', 'conflicted', 'conflicted')],
    });
    const model = await createModel(environment);

    const files = Object.fromEntries(model.getUncommittedFiles().map((file) => [file.path, file]));
    expect(files['order.bpmn']).toMatchObject({ status: 'modified', beforeRef: 'HEAD', afterRef: 'WORKING' });
    expect(files['notes.txt']).toMatchObject({ status: 'added', beforeRef: 'NONE', afterRef: 'WORKING' });
    expect(files['old.dmn']).toMatchObject({ status: 'deleted', beforeRef: 'HEAD', afterRef: 'NONE' });
    expect(files['clash.bpmn']).toMatchObject({ status: 'conflicted' });

    const digestCalls = environment.executeCommand.mock.calls.filter(([command]) =>
      command.endsWith('getChangeDigest'),
    );
    expect(digestCalls.map(([command]) => command).sort()).toEqual([
      'bpmn.diff.getChangeDigest',
      'dmn.diff.getChangeDigest',
    ]);
    expect(digestCalls.find(([command]) => command.startsWith('bpmn'))?.[1]).toEqual([
      'order.bpmn@HEAD',
      `disk:file://${repositoryRoot}/order.bpmn`,
    ]);
    expect(model.getDigest(files['order.bpmn'])).toMatchObject({ kind: 'ready' });
    expect(model.getDigest(files['notes.txt'])).toBeNull();
    expect(model.getDigest(files['clash.bpmn'])).toBeNull();
  });

  it('does not summarize the same two versions twice', async () => {
    const environment = createFakeModelEnvironment({ files: [createFile('order.bpmn', 'modified')] });
    const model = await createModel(environment);
    await model.refresh();

    const digestCalls = environment.executeCommand.mock.calls.filter(([command]) =>
      command.endsWith('getChangeDigest'),
    );
    expect(digestCalls).toHaveLength(1);
  });

  it('describes the repository in one line', async () => {
    const environment = createFakeModelEnvironment({ files: [createFile('a.txt', 'modified')] });
    const model = await createModel(environment);

    expect(model.getStatusSummary()).toBe('feature · 2 commits not pushed · 1 uncommitted change');
    expect(model.getRepositoryName()).toBe('repository');
  });

  it('compares the branch with the default base from the merge base to HEAD', async () => {
    const environment = createFakeModelEnvironment({
      changedFilesBetween: [{ path: 'order.bpmn', previousPath: null, status: 'modified' }],
    });
    const model = await createModel(environment, { mode: 'comparison' });

    expect(environment.sourceControl.getMergeBase).toHaveBeenCalledWith(repositoryRoot, 'main', 'HEAD');
    const comparison = model.getComparison();
    expect(comparison.kind).toBe('ready');
    expect(comparison.base).toBe('main');
    expect(comparison.files[0]).toMatchObject({ beforeRef: 'base123', afterRef: 'HEAD' });
    expect(model.getBaseOptions()).toEqual(['main']);
  });

  it('offers the other branches and keeps a chosen base', async () => {
    const environment = createFakeModelEnvironment({ branchNames: ['feature', 'main', 'release'] });
    const model = await createModel(environment);
    expect(model.getBaseOptions()).toEqual(['main', 'release']);

    await model.setComparisonBase('release');
    expect(model.getMode()).toBe('comparison');
    expect(model.getComparison().base).toBe('release');
  });

  it('says so when the branch is the base itself or no base exists', async () => {
    const onMain = await createModel(
      createFakeModelEnvironment({ branch: { current: 'main' }, branchNames: ['main'] }),
      { mode: 'comparison' },
    );
    expect(onMain.getComparison()).toMatchObject({ kind: 'on-base', base: 'main' });

    const withoutBase = await createModel(createFakeModelEnvironment({ branchNames: ['feature'] }), {
      mode: 'comparison',
    });
    expect(withoutBase.getComparison().kind).toBe('no-base');
  });

  it('expands a commit into its files and finds the ones that can be previewed', async () => {
    const environment = createFakeModelEnvironment({
      historyEntries: [
        { hash: 'abc', parents: [], subject: 'First', author: 'A', date: '2026-01-01T00:00:00Z', refs: [] },
      ],
      changedFilesBetween: [
        { path: 'order.bpmn', previousPath: null, status: 'added' },
        { path: 'gone.bpmn', previousPath: null, status: 'deleted' },
      ],
      existingFiles: [`${repositoryRoot}/order.bpmn`],
    });
    const model = await createModel(environment);

    await model.toggleCommit('abc');
    const expanded = model.getExpandedCommit('abc');
    expect(expanded).not.toBe('loading');
    expect(expanded).not.toBeNull();
    if (expanded == null || expanded === 'loading') {
      return;
    }
    expect(environment.sourceControl.getChangedFilesBetween).toHaveBeenCalledWith(repositoryRoot, null, 'abc');
    expect(expanded.files[0]).toMatchObject({ beforeRef: 'NONE', afterRef: 'abc' });
    expect([...expanded.previewablePaths]).toEqual(['order.bpmn']);

    await model.toggleCommit('abc');
    expect(model.getExpandedCommit('abc')).toBeNull();
  });

  it('shows the history of the branch in its own mode', async () => {
    const environment = createFakeModelEnvironment({
      historyEntries: [
        { hash: 'abc', parents: [], subject: 'First', author: 'A', date: '2026-01-01T00:00:00Z', refs: [] },
      ],
    });
    const model = await createModel(environment, { mode: 'history' });

    expect(model.getMode()).toBe('history');
    expect(model.getHistory().map((entry) => entry.hash)).toEqual(['abc']);
    // the comparison files are only read in comparison mode
    expect(environment.sourceControl.getChangedFilesBetween).not.toHaveBeenCalled();
  });

  it('does not claim an empty comparison while the files are still being read', async () => {
    const environment = createFakeModelEnvironment({
      changedFilesBetween: [{ path: 'notes.txt', previousPath: null, status: 'modified' }],
    });
    let releaseMergeBase: (mergeBase: string) => void = () => undefined;
    environment.sourceControl.getMergeBase.mockImplementation(
      () => new Promise<string>((resolve) => (releaseMergeBase = resolve)),
    );
    const model = await SourceOverviewDocumentModel.create(
      SOURCE_OVERVIEW_URI,
      null,
      { mode: 'comparison' },
      null as any,
      environment.bifrost,
    );

    const refreshing = model.refresh();
    await vi.waitFor(() => expect(environment.sourceControl.getMergeBase).toHaveBeenCalled());
    expect(model.getComparison().kind).toBe('loading');

    releaseMergeBase('base123');
    await refreshing;
    expect(model.getComparison()).toMatchObject({ kind: 'ready' });
    expect(model.getComparison().files).toHaveLength(1);
  });

  it('does not read the model files again when only the status changed', async () => {
    const environment = createFakeModelEnvironment({ files: [createFile('order.bpmn', 'modified')] });
    const model = await createModel(environment);
    const readsBefore = environment.bifrost.files.load.mock.calls.length;

    await model.refresh(false);

    expect(environment.bifrost.files.load.mock.calls.length).toBe(readsBefore);
    expect(model.getDigest(model.getUncommittedFiles()[0])).toMatchObject({ kind: 'ready' });
  });

  it('forgets the chosen base when another repository is selected', async () => {
    const environment = createFakeModelEnvironment({ branchNames: ['feature', 'main', 'release'] });
    const model = await createModel(environment);
    await model.setComparisonBase('release');
    expect(model.getComparison().base).toBe('release');

    const otherState = { ...environment.store.getAllRepoStates()[0], repositoryRoot: '/work/other' };
    environment.store.getAllRepoStates = () => [otherState];
    await model.refresh();

    expect(model.getComparison().base).toBe('main');
  });

  it('ignores a restored base that no longer exists', async () => {
    const environment = createFakeModelEnvironment({ branchNames: ['feature', 'main'] });
    const model = await createModel(environment, { mode: 'comparison', comparisonBase: 'deleted-branch' });

    expect(model.getComparison().base).toBe('main');
  });

  it('turns the changes of one task into one update of the view', async () => {
    const environment = createFakeModelEnvironment({ branchNames: ['feature', 'main', 'release'] });
    const model = await createModel(environment);
    const updates: unknown[] = [];
    // the document model manager normally releases the buffered events
    model.UNSAFE_onEditorDocumentModelManagerListens();
    model.on(EVENT_METADATA_UPDATED, (partialMetadata: unknown) => updates.push(partialMetadata));

    void model.setComparisonBase('release');
    await Promise.resolve();

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual(expect.objectContaining({ mode: 'comparison' }));
  });

  it('shows a failed comparison instead of staying on loading when git fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const environment = createFakeModelEnvironment();
    environment.sourceControl.getBranches.mockRejectedValue(new Error('git failed'));
    const model = await createModel(environment);

    expect(model.getComparison().kind).toBe('failed');
    consoleError.mockRestore();
  });

  it('summarizes exactly the file it is given', async () => {
    const environment = createFakeModelEnvironment();
    const model = await createModel(environment);

    await model.summarizeFile({
      path: 'order.bpmn',
      previousPath: null,
      status: 'modified',
      beforeRef: 'abc',
      afterRef: 'def',
    });

    expect(environment.executeCommand).toHaveBeenCalledWith('bpmn.diff.getChangeDigest', [
      'order.bpmn@abc',
      'order.bpmn@def',
    ]);
  });

  it('keeps a commit collapsed when it was collapsed while its files were read', async () => {
    const entry = { hash: 'h1', parents: [], subject: 'S', author: 'A', date: '2026-01-01T00:00:00Z', refs: [] };
    const environment = createFakeModelEnvironment({ historyEntries: [entry] });
    const model = await createModel(environment);
    let finishReading: (files: any[]) => void = () => undefined;
    environment.sourceControl.getChangedFilesBetween.mockReturnValue(
      new Promise((resolve) => {
        finishReading = resolve;
      }),
    );

    const expanding = model.toggleCommit('h1');
    expect(model.getExpandedCommit('h1')).toBe('loading');
    await model.toggleCommit('h1');
    expect(model.getExpandedCommit('h1')).toBeNull();

    finishReading([{ path: 'a.txt', previousPath: null, status: 'modified' }]);
    await expanding;
    expect(model.getExpandedCommit('h1')).toBeNull();
  });

  describe('history search', () => {
    const commit = (hash: string, subject: string) => ({
      hash,
      parents: [],
      subject,
      author: 'A',
      date: '2026-01-01T00:00:00Z',
      refs: [],
    });

    it('reloads the first page with the trimmed text and ignores an unchanged text', async () => {
      const environment = createFakeModelEnvironment({ historyEntries: [commit('abc', 'Add order')] });
      const model = await createModel(environment, { mode: 'history' });
      environment.store.getHistory.mockClear();

      await model.setHistorySearchText('  order ');
      expect(environment.store.getHistory).toHaveBeenCalledWith(repositoryRoot, 0, 'order');
      expect(model.getHistorySearchText()).toBe('order');

      environment.store.getHistory.mockClear();
      await model.setHistorySearchText('order');
      expect(environment.store.getHistory).not.toHaveBeenCalled();
    });

    it('passes the text on when older commits are loaded and when the list is refreshed', async () => {
      const environment = createFakeModelEnvironment();
      environment.store.getHistory.mockResolvedValue({ entries: [commit('abc', 'Add order')], hasMore: true });
      const model = await createModel(environment, { mode: 'history' });
      await model.setHistorySearchText('order');
      environment.store.getHistory.mockClear();

      await model.loadMoreHistory();
      expect(environment.store.getHistory).toHaveBeenCalledWith(repositoryRoot, 1, 'order');

      environment.store.getHistory.mockClear();
      await model.refresh();
      expect(environment.store.getHistory.mock.calls.every((call) => call[2] === 'order')).toBe(true);
    });

    it('forgets the text when another repository is selected', async () => {
      const environment = createFakeModelEnvironment();
      const model = await createModel(environment, { mode: 'history' });
      await model.setHistorySearchText('order');

      const otherState = { ...environment.store.getAllRepoStates()[0], repositoryRoot: '/work/other' };
      environment.store.getAllRepoStates = () => [otherState];
      await model.refresh();

      expect(model.getHistorySearchText()).toBe('');
    });

    it('drops commits that are no longer listed from the expanded ones', async () => {
      const environment = createFakeModelEnvironment({
        historyEntries: [commit('abc', 'Add order')],
        changedFilesBetween: [{ path: 'notes.txt', previousPath: null, status: 'added' }],
      });
      const model = await createModel(environment, { mode: 'history' });
      await model.toggleCommit('abc');
      expect(model.getExpandedCommit('abc')).not.toBeNull();

      environment.store.getHistory.mockResolvedValue({ entries: [], hasMore: false });
      await model.setHistorySearchText('nothing');

      expect(model.getHistory()).toHaveLength(0);
      expect(model.getExpandedCommit('abc')).toBeNull();
    });

    it('ignores the result of a search that was replaced while it was running', async () => {
      const environment = createFakeModelEnvironment();
      const model = await createModel(environment, { mode: 'history' });

      const pending = new Map<string, (page: { entries: any[]; hasMore: boolean }) => void>();
      environment.store.getHistory.mockImplementation(
        (_root: string, _skip: number, searchText: string) =>
          new Promise((resolve) => pending.set(searchText, resolve)) as any,
      );

      const firstSearch = model.setHistorySearchText('first');
      const secondSearch = model.setHistorySearchText('second');
      pending.get('second')?.({ entries: [commit('two', 'Second')], hasMore: false });
      await secondSearch;
      pending.get('first')?.({ entries: [commit('one', 'First')], hasMore: false });
      await firstSearch;

      expect(model.getHistory().map((entry) => entry.hash)).toEqual(['two']);
    });

    it('loads one older page at a time', async () => {
      const environment = createFakeModelEnvironment();
      environment.store.getHistory.mockResolvedValue({ entries: [commit('abc', 'Add order')], hasMore: true });
      const model = await createModel(environment, { mode: 'history' });

      let releasePage: (page: { entries: any[]; hasMore: boolean }) => void = () => undefined;
      environment.store.getHistory.mockClear();
      environment.store.getHistory.mockImplementation(() => new Promise((resolve) => (releasePage = resolve)) as any);

      const first = model.loadMoreHistory();
      const second = model.loadMoreHistory();
      releasePage({ entries: [commit('def', 'Older')], hasMore: false });
      await Promise.all([first, second]);

      expect(environment.store.getHistory).toHaveBeenCalledTimes(1);
      expect(model.getHistory().map((entry) => entry.hash)).toEqual(['abc', 'def']);
    });
  });
});
