import { ExplorerMediator } from '#bifrost/common/ExplorerMediator';
import { FilePatternMatcher, computeRelativeUri } from '#bifrost/common/FilePatternMatcher';
import {
  DESIGNER_EXPLORER_ID,
  EXPLORER_PANE_PROVIDER_ID,
  type ExplorerDefinition,
} from '#bifrost/contracts/ExplorerTypes';
import type { FileOrDirectory } from '#bifrost/contracts/FileSystemTypes';
import type { Project, Solution } from '#bifrost/contracts/SolutionTypes';
import type { TreeDecorationProvider } from '#bifrost/contracts/TreeTypes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DiskEntry = { [name: string]: DiskEntry | 'file' };

const disk: DiskEntry = {
  app: {
    'order.bpmn': 'file',
    'notes.txt': 'file',
    empty: {},
    landscapes: { 'overview.bfwmap': 'file', archive: { 'old.bfwmap': 'file' }, drafts: {} },
  },
};

function entryAt(uri: string): DiskEntry | null {
  let current: DiskEntry | 'file' | undefined = disk;
  for (const segment of uri.replace('file:///', '').split('/').filter(Boolean)) {
    if (current == null || current === 'file') {
      return null;
    }
    current = current[segment];
  }
  return current == null || current === 'file' ? null : current;
}

async function walk(
  uri: string,
  callback: (item: FileOrDirectory) => Promise<any>,
  isVisible: (item: FileOrDirectory) => boolean,
): Promise<any[]> {
  const directory = entryAt(uri);
  if (directory == null) {
    throw new Error(`missing ${uri}`);
  }
  const result: any[] = [];
  for (const [name, child] of Object.entries(directory)) {
    const item: FileOrDirectory =
      child === 'file'
        ? { type: 'file', file: name, uri: `${uri}/${name}` }
        : { type: 'directory', file: name, uri: `${uri}/${name}`, entries: [] };
    if (!isVisible(item)) {
      continue;
    }
    const transformed = await callback(item);
    if (transformed == null) {
      continue;
    }
    result.push(transformed);
    if (item.type === 'directory' && transformed.entries != null) {
      transformed.entries.push(...(await walk(item.uri, callback, isVisible)));
    }
  }
  return result;
}

const fileHandling = {
  traverseDirectory: vi.fn((uri: string, callback: (item: FileOrDirectory) => Promise<any>) =>
    walk(uri, callback, () => true),
  ),
  traverseProject: vi.fn((project: Project, callback: (item: FileOrDirectory) => Promise<any>) => {
    const matcher = new FilePatternMatcher(project.files.included, project.files.excluded);
    return walk(project.baseUri, callback, (item) =>
      matcher.isVisible(computeRelativeUri(item.uri, project.baseUri), item.type),
    );
  }),
  getLocalDirectory: async (uri: string) => uri.replace('file://', ''),
  getLocalFilenameForUri: (uri: string) => uri.replace('file://', ''),
  getFilename: (uri: string) => uri.split('/').pop() ?? uri,
};

const documentPages: Record<string, string> = { bpmn: 'design/workspace', bfwmap: 'discover/landscapes' };
let activePageId: string | null = 'design/workspace';

const bifrost: any = {
  categories: { getActivePageId: () => activePageId },
  editors: {
    hasDocumentTypeDefinitionForUri: (uri: string) => (uri.split('.').pop() ?? '') in documentPages,
    getDocumentTypeDefinitionByUri: (uri: string) => ({ page: documentPages[uri.split('.').pop() ?? ''], icon: 'x' }),
  },
  settings: { get: () => ['.*'] },
  solution: { getDefaultExcludedFiles: () => [] },
};

function createMediator(): ExplorerMediator {
  bifrost.explorers = new ExplorerMediator(bifrost, fileHandling as any);
  return bifrost.explorers;
}

const MAPS: ExplorerDefinition = {
  id: 'landscapes',
  paneId: 'discover/landscapes/maps',
  pages: ['discover/landscapes'],
  label: 'Maps',
  source: { kind: 'view', viewId: 'landscapes', includedFiles: ['**/*.bfwmap'] },
};

function solution(overrides: Partial<Solution> = {}): Solution {
  return {
    type: 'solution',
    id: 'solution-1',
    name: 'Demo',
    baseUri: 'file:///Demo.bfwsln',
    solutionFileUri: 'file:///Demo.bfwsln',
    isExplicitSolution: true,
    showHiddenFiles: false,
    views: { landscapes: { uri: 'file:///app/landscapes' } },
    projects: [
      {
        type: 'project',
        id: 'project-1',
        name: 'app',
        baseUri: 'file:///app',
        files: { included: ['**/*.bpmn', '**/*.bfwmap'], excluded: [] },
      },
    ],
    ...overrides,
  };
}

function collect(mediator: ExplorerMediator, explorerId: string): Map<string, any> {
  const nodes = new Map<string, any>();
  mediator.getView(explorerId).traverse((entry) => {
    if (entry.metadata?.uri != null && entry.type !== 'section') {
      nodes.set(entry.metadata.uri, entry);
    }
  });
  return nodes;
}

async function open(mediator: ExplorerMediator, openedSolution: Solution | null): Promise<void> {
  await mediator.setSolution(openedSolution);
  await vi.runAllTimersAsync();
}

beforeEach(() => {
  vi.useFakeTimers();
  activePageId = 'design/workspace';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ExplorerMediator registry', () => {
  it('has the Designer explorer built in and rejects duplicate explorers and panes', () => {
    const mediator = createMediator();

    expect(mediator.get(DESIGNER_EXPLORER_ID).structuralOperations).toBe(true);
    expect(mediator.register(MAPS)).toEqual({
      id: 'discover/landscapes/maps',
      providerId: EXPLORER_PANE_PROVIDER_ID,
      collapsed: false,
    });
    expect(mediator.getByPaneId('design/workspace/explorer')?.id).toBe(DESIGNER_EXPLORER_ID);
    expect(mediator.getExplorersOfPage('discover/landscapes').map((definition) => definition.id)).toEqual([
      'landscapes',
    ]);
    expect(() => mediator.register(MAPS)).toThrow(/already an explorer/);
    expect(() => mediator.register({ ...MAPS, id: 'other' })).toThrow(/already shows an explorer/);
    expect(() => mediator.get('missing')).toThrow(/no explorer/);
  });

  it('resolves the active explorer from the active page and falls back to the Designer', () => {
    const mediator = createMediator();
    mediator.register(MAPS);

    activePageId = 'discover/landscapes';
    expect(mediator.getActiveExplorer().id).toBe('landscapes');
    activePageId = 'deploy/plan';
    expect(mediator.getActiveExplorer().id).toBe(DESIGNER_EXPLORER_ID);
  });
});

describe('explorer projections', () => {
  it('shows empty folders in the Designer and marks the view folder protected', async () => {
    const mediator = createMediator();
    mediator.register(MAPS);
    await open(mediator, solution());

    const nodes = collect(mediator, DESIGNER_EXPLORER_ID);
    expect(nodes.has('file:///app/empty')).toBe(true);
    expect(nodes.has('file:///app/notes.txt')).toBe(false);
    expect(nodes.get('file:///app/order.bpmn').metadata).toMatchObject({ explorerId: 'design' });
    expect(nodes.get('file:///app/order.bpmn').metadata.protected).toBeUndefined();
    for (const uri of ['file:///app/landscapes', 'file:///app/landscapes/archive/old.bfwmap']) {
      expect(nodes.get(uri).metadata).toMatchObject({ protected: true, protectedViewId: 'landscapes' });
      expect(nodes.get(uri).styles.labelColor).toBe('gray');
    }
    expect(nodes.get('file:///app/landscapes').labelTooltip).toMatch(
      /landscapes folder of this solution; read-only here, managed in the Maps explorer/,
    );
  });

  it('shows only the view folder files in a view explorer and hides empty folders', async () => {
    const mediator = createMediator();
    mediator.register(MAPS);
    await open(mediator, solution());

    const view = mediator.getView('landscapes');
    const data = view.getViewData().solution;
    expect(data.label).toBe('Maps');
    expect(data.isExplicitSolution).toBe(false);
    expect(data.entries).toHaveLength(1);
    const nodes = collect(mediator, 'landscapes');
    expect([...nodes.keys()].filter((uri) => nodes.get(uri).type !== 'project').sort()).toEqual([
      'file:///app/landscapes/archive',
      'file:///app/landscapes/archive/old.bfwmap',
      'file:///app/landscapes/overview.bfwmap',
    ]);
    expect(nodes.get('file:///app/landscapes/overview.bfwmap').metadata).toMatchObject({
      explorerId: 'landscapes',
    });
    expect(nodes.get('file:///app/landscapes/overview.bfwmap').metadata.protected).toBeUndefined();
    expect(view.hasFiles()).toBe(true);
  });

  it('shows nothing without a saved solution, without the view entry, or with a missing folder', async () => {
    const mediator = createMediator();
    mediator.register(MAPS);

    for (const opened of [
      solution({ solutionFileUri: undefined }),
      solution({ views: {} }),
      solution({ views: { landscapes: { uri: 'file:///nowhere' } } }),
    ]) {
      await open(mediator, { ...opened, id: crypto.randomUUID() });
      expect(mediator.getView('landscapes').getViewData().solution.entries).toEqual([]);
      expect(mediator.getView('landscapes').hasFiles()).toBe(false);
    }
    await open(mediator, null);
    expect(mediator.getView('landscapes').getViewData().solution).toBeNull();
  });

  it('applies hidden files only to the Designer', async () => {
    const mediator = createMediator();
    mediator.register(MAPS);
    await open(mediator, solution({ showHiddenFiles: true }));

    expect(collect(mediator, DESIGNER_EXPLORER_ID).get('file:///app/notes.txt').styles.labelColor).toBe('gray');
    expect(mediator.getView('landscapes').getViewData().solution.showHiddenFiles).toBe(false);
    expect([...collect(mediator, 'landscapes').keys()].some((uri) => uri.endsWith('.txt'))).toBe(false);
  });

  it('reveals a document in the explorers on its page, else in every explorer showing it', async () => {
    const mediator = createMediator();
    mediator.register(MAPS);
    await open(mediator, solution());

    expect(mediator.getRevealTargets('file:///app/landscapes/overview.bfwmap')).toEqual(['landscapes']);
    expect(mediator.getRevealTargets('file:///app/order.bpmn')).toEqual([DESIGNER_EXPLORER_ID]);
    documentPages.bfwmap = 'deploy/plan';
    expect(mediator.getRevealTargets('file:///app/landscapes/overview.bfwmap')).toEqual([
      DESIGNER_EXPLORER_ID,
      'landscapes',
    ]);
    documentPages.bfwmap = 'discover/landscapes';
    expect(mediator.getRevealTargets('file:///app/notes.txt')).toEqual([]);
  });
});

describe('explorer decorations', () => {
  it('merges unscoped decorations everywhere and scoped ones only in their explorers', () => {
    const mediator = createMediator();
    let notify: (uris: string[]) => void = () => undefined;
    const provider = (badge: string, styles?: object): TreeDecorationProvider => ({
      provideDecoration: (uri) =>
        uri === 'file:///a' ? { badges: [{ type: 'character', character: badge }], styles } : null,
      onDidChange: (listener) => {
        notify = listener;
        return { dispose: () => undefined };
      },
    });
    mediator.registerDecorationProvider(provider('git', { labelColor: 'green' }));
    mediator.registerDecorationProvider(provider('missing', { labelColor: 'red' }), ['landscapes']);

    expect(mediator.getDecorationSource().getDecoration('file:///a')).toEqual({
      badges: [{ type: 'character', character: 'git' }],
      styles: { labelColor: 'green' },
    });
    expect(mediator.getDecorationSource('landscapes').getDecoration('file:///a')).toEqual({
      badges: [
        { type: 'character', character: 'git' },
        { type: 'character', character: 'missing' },
      ],
      styles: { labelColor: 'red' },
    });
    expect(mediator.getDecorationSource('landscapes')).toBe(mediator.getDecorationSource('landscapes'));
    expect(mediator.getDecorationSource().getDecoration('file:///b')).toBeNull();

    const changed: Set<string>[] = [];
    const subscription = mediator.getDecorationSource().subscribe((uris) => changed.push(uris));
    notify(['file:///a']);
    subscription.dispose();
    notify(['file:///a']);
    expect(changed).toEqual([new Set(['file:///a'])]);
  });
});
