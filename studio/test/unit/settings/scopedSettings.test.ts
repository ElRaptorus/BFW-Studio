import type { FileHandlingService } from '#bifrost/common/FileHandlingService';
import { LocalStorageItem } from '#bifrost/common/LocalStorageItem';
import { SettingsLayerManager } from '#bifrost/common/SettingsLayerManager';
import { SettingsMediator } from '#bifrost/common/SettingsMediator';
import { readSolutionFile } from '#bifrost/common/SolutionFile';
import { EVENT_SOLUTION_CHANGED } from '#bifrost/common/SolutionManager';
import type { Solution } from '#bifrost/contracts/SolutionTypes';
import { EVENT_SETTINGS_CHANGED } from '#bifrost/contracts/internal/SettingsEvents';
import assert from 'node:assert';
import { describe, it } from 'vitest';

import type { SettingDescriptor } from '@elraptorus/bfw_studio_sdk';

const showGrid: SettingDescriptor = {
  type: 'boolean',
  label: 'Show Grid',
  description: 'Grid',
  default: false,
  scope: 'project',
};

const showMarker: SettingDescriptor = {
  type: 'boolean',
  label: 'Show Marker',
  description: 'Marker',
  default: false,
  scope: 'project',
};

const applicationOnly: SettingDescriptor = {
  type: 'boolean',
  label: 'Theme flag',
  description: 'Theme',
  default: false,
};

function memoryStorage(): LocalStorageItem {
  const items = new Map<string, string>();
  return new LocalStorageItem(
    {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => {
        items.set(key, value);
      },
      removeItem: (key) => {
        items.delete(key);
      },
    },
    'Settings',
  );
}

type RecordedWatch = {
  uri: string;
  depth: number | undefined;
  disposed: boolean;
  callback: (eventType: string, filePath: string) => void;
};

type MemoryFiles = FileHandlingService & {
  files: Map<string, string>;
  directories: Set<string>;
  watches: RecordedWatch[];
  loadCount: number;
  failingSaveUri: string | null;
};

function memoryFiles(watchThrows = false): MemoryFiles {
  const files = new Map<string, string>();
  const directories = new Set<string>();
  const watches: RecordedWatch[] = [];
  const localPath = (uri: string) => uri.replace(/^file:\/\//, '');
  const fake = {
    files,
    directories,
    watches,
    loadCount: 0,
    failingSaveUri: null as string | null,
    load: async (uri: string) => {
      fake.loadCount += 1;
      const content = files.get(uri);
      if (content == null) {
        throw new Error('missing');
      }
      return content;
    },
    save: async (uri: string, content: string) => {
      if (uri === fake.failingSaveUri) {
        throw new Error('read-only file system');
      }
      files.set(uri, String(content));
      directories.add(localPath(uri).replace(/\/[^/]+$/, ''));
      return true;
    },
    createDirectory: async (uri: string) => {
      directories.add(localPath(uri));
      return true;
    },
    getLocalFilenameForUri: localPath,
    doesFileOrDirectoryExist: async (localFilename: string) =>
      directories.has(localFilename) ||
      [...files.keys()].some(
        (uri) => localPath(uri) === localFilename || localPath(uri).startsWith(`${localFilename}/`),
      ),
    watchFile: (uri: string, callback: RecordedWatch['callback'], options?: { depth?: number }) => {
      if (watchThrows) {
        throw new Error('watchFile not implemented');
      }
      const watch: RecordedWatch = { uri, depth: options?.depth, disposed: false, callback };
      watches.push(watch);
      return {
        dispose: () => {
          watch.disposed = true;
        },
      };
    },
  };
  return fake as unknown as MemoryFiles;
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function openSolution(): Solution {
  return {
    type: 'solution',
    id: 'solution',
    name: 'Demo',
    baseUri: 'file:///tmp/Demo.bfwsln',
    showHiddenFiles: false,
    solutionFileUri: 'file:///tmp/Demo.bfwsln',
    projects: [
      {
        type: 'project',
        id: 'a',
        name: 'A',
        baseUri: 'file:///tmp/a',
        files: { included: [], excluded: [] },
      },
      {
        type: 'project',
        id: 'b',
        name: 'B',
        baseUri: 'file:///tmp/b',
        files: { included: [], excluded: [] },
      },
    ],
  };
}

describe('SettingsLayerManager', () => {
  it('reconciles only when the project set or the solution file changes', async () => {
    const files = memoryFiles();
    files.files.set('file:///tmp/Demo.bfwsln', JSON.stringify({ folders: [], settings: {} }));
    files.files.set('file:///tmp/a/.bifrostfw/settings.json', '{}');
    files.files.set('file:///tmp/b/.bifrostfw/settings.json', '{}');

    const solution = openSolution();
    const events = { on: () => ({ dispose: () => undefined }) };
    const store = new SettingsLayerManager(files, () => solution);
    await store.attachTo(events as any);
    const loadsAfterOpen = files.loadCount;

    await store.reconcile();
    assert.strictEqual(files.loadCount, loadsAfterOpen);
  });

  it('keeps going when watchFile is unavailable', async () => {
    const files = memoryFiles(true);
    files.files.set(
      'file:///tmp/Demo.bfwsln',
      JSON.stringify({ folders: [], settings: { 'bpmn.editor.showGrid': true } }),
    );
    const solution = openSolution();
    solution.projects = solution.projects.slice(0, 1);
    const store = new SettingsLayerManager(files, () => solution);
    await store.reconcile();

    assert.deepStrictEqual(store.getSolutionLayer(), { 'bpmn.editor.showGrid': true });
  });

  it('keeps unknown keys on read-modify-write', async () => {
    const files = memoryFiles();
    files.files.set(
      'file:///tmp/Demo.bfwsln',
      JSON.stringify({
        folders: [{ path: '/tmp/a' }],
        settings: { 'bpmn.editor.showGrid': true, 'custom.unknown': 1 },
      }),
    );
    files.files.set(
      'file:///tmp/a/.bifrostfw/settings.json',
      JSON.stringify({ 'bpmn.editor.showGrid': false, 'custom.unknown': 2 }),
    );
    const solution = openSolution();
    const store = new SettingsLayerManager(files, () => solution);
    await store.reconcile();

    await store.writeSetting({ scope: 'solution' }, 'bpmn.editor.showMarker', true);
    await store.writeSetting({ scope: 'project', projectBaseUri: 'file:///tmp/a' }, 'bpmn.editor.showMarker', false);

    const solutionDocument = JSON.parse(files.files.get('file:///tmp/Demo.bfwsln') ?? '{}');
    assert.deepStrictEqual(solutionDocument.folders, [{ path: '/tmp/a' }]);
    assert.strictEqual(solutionDocument.settings['custom.unknown'], 1);
    assert.strictEqual(solutionDocument.settings['bpmn.editor.showMarker'], true);

    const projectDocument = JSON.parse(files.files.get('file:///tmp/a/.bifrostfw/settings.json') ?? '{}');
    assert.strictEqual(projectDocument['custom.unknown'], 2);
    assert.strictEqual(projectDocument['bpmn.editor.showMarker'], false);
  });
});

function solutionEvents() {
  const listeners = new Map<string, (() => void)[]>();
  return {
    on(eventName: string, listener: () => void) {
      const registered = listeners.get(eventName) ?? [];
      registered.push(listener);
      listeners.set(eventName, registered);
      return { dispose: () => undefined };
    },
    emit(eventName: string) {
      for (const listener of listeners.get(eventName) ?? []) {
        listener();
      }
    },
  };
}

describe('SettingsMediator scoped reads', () => {
  it('resolves a resource, the focused document, and an explicit user read', async () => {
    const files = memoryFiles();
    files.files.set('file:///tmp/Demo.bfwsln', JSON.stringify({ folders: [], settings: {} }));
    files.files.set('file:///tmp/a/.bifrostfw/settings.json', JSON.stringify({ 'bpmn.editor.showGrid': true }));
    files.files.set('file:///tmp/b/.bifrostfw/settings.json', JSON.stringify({ 'bpmn.editor.showGrid': false }));

    const settings = new SettingsMediator(memoryStorage());
    settings.register({
      'bpmn.editor.showGrid': showGrid,
      'bpmn.editor.showMarker': showMarker,
    });
    await settings.set('bpmn.editor.showMarker', true);

    let focusedUri = 'file:///tmp/a/diagram.bpmn';
    await settings.attachWorkspace({
      fileHandling: files,
      readSolution: () => openSolution(),
      solutionEvents: solutionEvents(),
      offerSolutionFileRepair: async () => false,
      readFocusedEditorDocument: () => ({ documentType: 'bpmn', uri: focusedUri }),
      reportError: () => undefined,
    });

    assert.strictEqual(settings.get('bpmn.editor.showGrid', 'file:///tmp/a/diagram.bpmn'), true);
    assert.strictEqual(settings.get('bpmn.editor.showGrid', 'file:///tmp/b/diagram.bpmn'), false);
    assert.strictEqual(settings.get('bpmn.editor.showGrid'), true);
    assert.strictEqual(settings.get('bpmn.editor.showGrid', null), false);

    focusedUri = 'file:///tmp/b/diagram.bpmn';
    assert.strictEqual(settings.get('bpmn.editor.showGrid'), false);

    const changed: string[] = [];
    settings.onDidChange(
      (key) => changed.push(key),
      () => focusedUri,
    );
    settings.resourceMoved('file:///tmp/a/diagram.bpmn', 'file:///tmp/b/diagram.bpmn');

    assert.deepStrictEqual(changed, ['bpmn.editor.showGrid']);
  });

  it('stays on the user layer before a workspace is attached and rejects ineligible scope writes', async () => {
    const settings = new SettingsMediator(memoryStorage());
    settings.register({
      'bpmn.editor.showGrid': showGrid,
      'workbench.flag': applicationOnly,
    });
    assert.deepStrictEqual(await settings.set('bpmn.editor.showGrid', true), { scope: 'user' });
    assert.strictEqual(settings.get('bpmn.editor.showGrid', 'file:///tmp/a/diagram.bpmn'), true);

    const reported: string[] = [];
    await settings.attachWorkspace({
      fileHandling: memoryFiles(),
      readSolution: () => openSolution(),
      solutionEvents: solutionEvents(),
      offerSolutionFileRepair: async () => false,
      readFocusedEditorDocument: () => null,
      reportError: (message) => reported.push(message),
    });

    const written = await settings.setInScope(
      { scope: 'project', projectBaseUri: 'file:///tmp/a' },
      'workbench.flag',
      true,
    );
    assert.strictEqual(written, false);
    assert.strictEqual(reported.length, 1);
    assert.match(reported[0], /not eligible/);
  });

  it('reports a failed layer write once and resolves to null', async () => {
    const files = memoryFiles();
    files.files.set('file:///tmp/Demo.bfwsln', JSON.stringify({ folders: [], settings: {} }));
    files.files.set('file:///tmp/a/.bifrostfw/settings.json', JSON.stringify({ 'bpmn.editor.showGrid': true }));
    files.failingSaveUri = 'file:///tmp/a/.bifrostfw/settings.json';

    const settings = new SettingsMediator(memoryStorage());
    settings.register({ 'bpmn.editor.showGrid': showGrid });
    const reported: string[] = [];
    await settings.attachWorkspace({
      fileHandling: files,
      readSolution: () => openSolution(),
      solutionEvents: solutionEvents(),
      offerSolutionFileRepair: async () => false,
      readFocusedEditorDocument: () => null,
      reportError: (message) => reported.push(message),
    });

    const result = await settings.set('bpmn.editor.showGrid', false, 'file:///tmp/a/diagram.bpmn');

    assert.strictEqual(result, null);
    assert.strictEqual(reported.length, 1);
    assert.match(reported[0], /read-only file system/);
  });

  it('notifies a removed project for its keys', async () => {
    const files = memoryFiles();
    files.files.set(
      'file:///tmp/Demo.bfwsln',
      JSON.stringify({ folders: [], settings: { 'bpmn.editor.showMarker': true } }),
    );
    files.files.set('file:///tmp/a/.bifrostfw/settings.json', JSON.stringify({ 'bpmn.editor.showGrid': true }));

    const settings = new SettingsMediator(memoryStorage());
    settings.register({ 'bpmn.editor.showGrid': showGrid, 'bpmn.editor.showMarker': showMarker });
    const solution = openSolution();
    const events = solutionEvents();
    await settings.attachWorkspace({
      fileHandling: files,
      readSolution: () => solution,
      solutionEvents: events,
      offerSolutionFileRepair: async () => false,
      readFocusedEditorDocument: () => null,
      reportError: () => undefined,
    });

    const changed: string[] = [];
    settings.onDidChange((key) => changed.push(key), 'file:///tmp/a/diagram.bpmn');

    solution.projects = solution.projects.filter((project) => project.id !== 'a');
    events.emit(EVENT_SOLUTION_CHANGED);
    await flushPromises();
    await flushPromises();

    assert.deepStrictEqual([...changed].sort(), ['bpmn.editor.showGrid', 'bpmn.editor.showMarker']);
  });

  it('ignores unregistered and application keys in layer files', async () => {
    const files = memoryFiles();
    files.files.set(
      'file:///tmp/Demo.bfwsln',
      JSON.stringify({ folders: [], settings: { 'custom.unknown': 1, 'workbench.flag': true } }),
    );
    files.files.set('file:///tmp/a/.bifrostfw/settings.json', JSON.stringify({ 'custom.unknown': 2 }));
    files.files.set('file:///tmp/b/.bifrostfw/settings.json', JSON.stringify({ 'bpmn.editor.showGrid': true }));

    const settings = new SettingsMediator(memoryStorage());
    settings.register({ 'bpmn.editor.showGrid': showGrid, 'workbench.flag': applicationOnly });
    const changedKeys: string[] = [];
    settings.on(EVENT_SETTINGS_CHANGED, (key: string) => changedKeys.push(key));

    await settings.attachWorkspace({
      fileHandling: files,
      readSolution: () => openSolution(),
      solutionEvents: solutionEvents(),
      offerSolutionFileRepair: async () => false,
      readFocusedEditorDocument: () => null,
      reportError: () => undefined,
    });

    assert.deepStrictEqual(changedKeys, ['bpmn.editor.showGrid']);
    assert.strictEqual(settings.get('bpmn.editor.showGrid', 'file:///tmp/b/diagram.bpmn'), true);
    assert.ok(files.watches.some((watch) => watch.uri === 'file:///tmp/b/.bifrostfw/settings.json'));

    await settings.writeScopeText({ scope: 'solution' }, '{ "custom.other": 3, "bpmn.editor.showGrid": false }');
    assert.strictEqual(settings.get('bpmn.editor.showGrid', 'file:///tmp/a/diagram.bpmn'), false);
  });

  it('notifies a resource only for layers that affect it', async () => {
    const files = memoryFiles();
    files.files.set('file:///tmp/Demo.bfwsln', JSON.stringify({ folders: [], settings: {} }));
    files.files.set('file:///tmp/a/.bifrostfw/settings.json', '{}');
    files.files.set('file:///tmp/b/.bifrostfw/settings.json', '{}');

    const settings = new SettingsMediator(memoryStorage());
    settings.register({ 'bpmn.editor.showGrid': showGrid });
    await settings.attachWorkspace({
      fileHandling: files,
      readSolution: () => openSolution(),
      solutionEvents: solutionEvents(),
      offerSolutionFileRepair: async () => false,
      readFocusedEditorDocument: () => null,
      reportError: () => undefined,
    });

    const changedInA: string[] = [];
    settings.onDidChange((key) => changedInA.push(key), 'file:///tmp/a/diagram.bpmn');

    await settings.setInScope({ scope: 'project', projectBaseUri: 'file:///tmp/b' }, 'bpmn.editor.showGrid', true);
    assert.deepStrictEqual(changedInA, []);

    await settings.setInScope({ scope: 'solution' }, 'bpmn.editor.showGrid', true);
    await settings.set('bpmn.editor.showGrid', true, null);
    assert.deepStrictEqual(changedInA, ['bpmn.editor.showGrid', 'bpmn.editor.showGrid']);
  });

  it('retries a solution settings write after repair and reports nothing when declined', async () => {
    const files = memoryFiles();
    files.files.set(
      'file:///tmp/Demo.bfwsln',
      JSON.stringify({ folders: [], settings: { 'bpmn.editor.showGrid': true } }),
    );
    const settings = new SettingsMediator(memoryStorage());
    settings.register({ 'bpmn.editor.showGrid': showGrid });

    const declined: string[] = [];
    let allowRepair = false;
    await settings.attachWorkspace({
      fileHandling: files,
      readSolution: () => openSolution(),
      solutionEvents: solutionEvents(),
      offerSolutionFileRepair: async () => {
        if (!allowRepair) {
          return false;
        }
        files.files.set('file:///tmp/Demo.bfwsln', JSON.stringify({ folders: [], settings: {} }));
        return true;
      },
      readFocusedEditorDocument: () => null,
      reportError: (message) => declined.push(message),
    });
    files.files.set('file:///tmp/Demo.bfwsln', '{');
    assert.strictEqual(await settings.set('bpmn.editor.showGrid', false, 'file:///tmp/a/diagram.bpmn'), null);
    assert.deepStrictEqual(declined, []);

    allowRepair = true;
    assert.deepStrictEqual(await settings.set('bpmn.editor.showGrid', false, 'file:///tmp/a/diagram.bpmn'), {
      scope: 'solution',
    });
    assert.strictEqual(
      JSON.parse(files.files.get('file:///tmp/Demo.bfwsln') ?? '{}').settings['bpmn.editor.showGrid'],
      false,
    );
  });

  it('emits layer changes with a scope target', async () => {
    const files = memoryFiles();
    files.files.set('file:///tmp/Demo.bfwsln', JSON.stringify({ folders: [], settings: {} }));
    files.files.set('file:///tmp/a/.bifrostfw/settings.json', JSON.stringify({ 'bpmn.editor.showGrid': true }));

    const settings = new SettingsMediator(memoryStorage());
    settings.register({ 'bpmn.editor.showGrid': showGrid });
    await settings.attachWorkspace({
      fileHandling: files,
      readSolution: () => openSolution(),
      solutionEvents: solutionEvents(),
      offerSolutionFileRepair: async () => false,
      readFocusedEditorDocument: () => ({ documentType: 'bpmn', uri: 'file:///tmp/a/diagram.bpmn' }),
      reportError: () => undefined,
    });

    const scopeTargets: unknown[] = [];
    settings.on(EVENT_SETTINGS_CHANGED, (_key: string, _value: unknown, _added: unknown, scopeTarget?: unknown) => {
      scopeTargets.push(scopeTarget);
    });
    await settings.set('bpmn.editor.showGrid', false, 'file:///tmp/a/diagram.bpmn');

    assert.deepStrictEqual(scopeTargets, [{ scope: 'project', projectBaseUri: 'file:///tmp/a' }]);
  });
});

describe('SettingsLayerManager watchers', () => {
  it('watches the project root until .bifrostfw exists, then the settings file', async () => {
    const files = memoryFiles();
    files.files.set('file:///tmp/Demo.bfwsln', JSON.stringify({ folders: [], settings: {} }));
    const store = new SettingsLayerManager(files, () => openSolution());
    await store.reconcile();

    const rootWatchA = files.watches.find((watch) => watch.uri === 'file:///tmp/a');
    assert.ok(rootWatchA != null);
    assert.strictEqual(rootWatchA.depth, 0);

    await store.writeSetting({ scope: 'project', projectBaseUri: 'file:///tmp/a' }, 'bpmn.editor.showGrid', true);
    assert.strictEqual(rootWatchA.disposed, true);
    const fileWatchA = files.watches.find((watch) => watch.uri === 'file:///tmp/a/.bifrostfw/settings.json');
    assert.ok(fileWatchA != null && !fileWatchA.disposed);

    const rootWatchB = files.watches.find((watch) => watch.uri === 'file:///tmp/b');
    assert.ok(rootWatchB != null);
    files.directories.add('/tmp/b/.bifrostfw');
    rootWatchB.callback('addDir', '/tmp/b/.bifrostfw');
    await flushPromises();
    await flushPromises();

    assert.strictEqual(rootWatchB.disposed, true);
    assert.ok(files.watches.some((watch) => watch.uri === 'file:///tmp/b/.bifrostfw/settings.json' && !watch.disposed));
  });
});

describe('solution JSONC', () => {
  it('keeps comments written through the Solution JSON editor readable', async () => {
    const files = memoryFiles();
    files.files.set('file:///tmp/Demo.bfwsln', JSON.stringify({ folders: [{ path: '/tmp/a' }], settings: {} }));
    const store = new SettingsLayerManager(files, () => openSolution());
    await store.reconcile();

    await store.writeRawText({ scope: 'solution' }, '{\n  // note\n  "bpmn.editor.showGrid": true\n}\n');

    const content = await readSolutionFile('file:///tmp/Demo.bfwsln', files);
    assert.strictEqual(content.settings['bpmn.editor.showGrid'], true);
    assert.deepStrictEqual(content.folders, [{ path: '/tmp/a', name: undefined }]);
    assert.match(await store.readRawText({ scope: 'solution' }), /\/\/ note/);
  });
});

type LayerFixture = {
  user?: Record<string, unknown>;
  solution?: Record<string, unknown> | null;
  projects?: Record<string, Record<string, unknown>>;
};

async function mediatorWithLayers(fixture: LayerFixture): Promise<SettingsMediator> {
  const files = memoryFiles();
  const projectBaseUris = Object.keys(fixture.projects ?? { 'file:///tmp/a': {} });
  for (const [baseUri, layer] of Object.entries(fixture.projects ?? {})) {
    files.files.set(`${baseUri}/.bifrostfw/settings.json`, JSON.stringify(layer));
  }
  const hasSolutionFile = fixture.solution !== null;
  if (hasSolutionFile) {
    files.files.set('file:///tmp/Demo.bfwsln', JSON.stringify({ folders: [], settings: fixture.solution ?? {} }));
  }
  const solution: Solution = {
    ...openSolution(),
    solutionFileUri: hasSolutionFile ? 'file:///tmp/Demo.bfwsln' : undefined,
    projects: projectBaseUris.map((baseUri) => ({
      type: 'project',
      id: baseUri,
      name: baseUri,
      baseUri,
      files: { included: [], excluded: [] },
    })),
  };

  const settings = new SettingsMediator(memoryStorage());
  settings.register({ 'bpmn.editor.showGrid': showGrid, 'workbench.flag': applicationOnly });
  for (const [key, value] of Object.entries(fixture.user ?? {})) {
    await settings.set(key, value, null);
  }
  await settings.attachWorkspace({
    fileHandling: files,
    readSolution: () => solution,
    solutionEvents: solutionEvents(),
    offerSolutionFileRepair: async () => false,
    readFocusedEditorDocument: () => null,
    reportError: () => undefined,
  });
  return settings;
}

describe('SettingsMediator scope resolution', () => {
  const diagramInA = 'file:///tmp/a/diagram.bpmn';

  it('resolves project over solution over user over default', async () => {
    const settings = await mediatorWithLayers({
      user: { 'bpmn.editor.showGrid': true },
      solution: { 'bpmn.editor.showGrid': false },
      projects: { 'file:///tmp/a': { 'bpmn.editor.showGrid': true } },
    });

    assert.deepStrictEqual(settings.inspect('bpmn.editor.showGrid', diagramInA), { value: true, definedIn: 'project' });
  });

  it('falls through to solution, then user, then the descriptor default', async () => {
    const solutionOnly = await mediatorWithLayers({
      user: { 'bpmn.editor.showGrid': false },
      solution: { 'bpmn.editor.showGrid': true },
    });
    assert.deepStrictEqual(solutionOnly.inspect('bpmn.editor.showGrid', diagramInA), {
      value: true,
      definedIn: 'solution',
    });

    const userOnly = await mediatorWithLayers({ user: { 'bpmn.editor.showGrid': true } });
    assert.deepStrictEqual(userOnly.inspect('bpmn.editor.showGrid', diagramInA), { value: true, definedIn: 'user' });

    const fallback = await mediatorWithLayers({});
    assert.deepStrictEqual(fallback.inspect('bpmn.editor.showGrid', diagramInA), {
      value: false,
      definedIn: 'default',
    });
  });

  it('ignores layer values for a key that is not eligible for that layer', async () => {
    const settings = await mediatorWithLayers({
      user: { 'workbench.flag': true },
      solution: { 'workbench.flag': false },
      projects: { 'file:///tmp/a': { 'workbench.flag': false } },
    });

    assert.deepStrictEqual(settings.inspect('workbench.flag', diagramInA), { value: true, definedIn: 'user' });
    assert.strictEqual(settings.isEligibleForScope('workbench.flag', 'project'), false);
    assert.strictEqual(settings.isEligibleForScope('bpmn.editor.showGrid', 'solution'), true);
  });

  it('falls through when a layer value fails validation', async () => {
    const settings = await mediatorWithLayers({
      user: { 'bpmn.editor.showGrid': true },
      solution: { 'bpmn.editor.showGrid': false },
      projects: { 'file:///tmp/a': { 'bpmn.editor.showGrid': 'nope' } },
    });

    assert.deepStrictEqual(settings.inspect('bpmn.editor.showGrid', diagramInA), {
      value: false,
      definedIn: 'solution',
    });
  });

  it('matches a project only on a slash boundary', async () => {
    const settings = await mediatorWithLayers({
      projects: { 'file:///tmp/proj': {}, 'file:///tmp/project2': {} },
    });

    assert.strictEqual(
      settings.getProjectBaseUriForResource('file:///tmp/project2/diagram.bpmn'),
      'file:///tmp/project2',
    );
    assert.strictEqual(settings.getProjectBaseUriForResource('file:///tmp/proj/diagram.bpmn'), 'file:///tmp/proj');
    assert.strictEqual(settings.getProjectBaseUriForResource('file:///tmp/proj2/diagram.bpmn'), null);
  });

  it('matches percent-encoded resources to unencoded project base URIs', async () => {
    const settings = await mediatorWithLayers({ projects: { 'file:///tmp/my project': {} } });

    assert.strictEqual(
      settings.getProjectBaseUriForResource('file:///tmp/my%20project/diagram.bpmn'),
      'file:///tmp/my project',
    );
    assert.strictEqual(settings.getProjectBaseUriForResource('file:///tmp/my%20project2/diagram.bpmn'), null);
  });

  it('resolves buffer URIs against the user layer only', async () => {
    const settings = await mediatorWithLayers({
      user: { 'bpmn.editor.showGrid': true },
      solution: { 'bpmn.editor.showGrid': false },
      projects: { 'file:///tmp/a': { 'bpmn.editor.showGrid': false } },
    });

    assert.deepStrictEqual(settings.inspect('bpmn.editor.showGrid', 'buffer:unsaved.bpmn'), {
      value: true,
      definedIn: 'user',
    });
  });

  it('writes to the most specific layer that defines the key, otherwise the user layer', async () => {
    const projectDefines = await mediatorWithLayers({
      solution: { 'bpmn.editor.showGrid': false },
      projects: { 'file:///tmp/a': { 'bpmn.editor.showGrid': true } },
    });
    assert.deepStrictEqual(await projectDefines.set('bpmn.editor.showGrid', false, diagramInA), {
      scope: 'project',
      projectBaseUri: 'file:///tmp/a',
    });

    const solutionDefines = await mediatorWithLayers({ solution: { 'bpmn.editor.showGrid': true } });
    assert.deepStrictEqual(await solutionDefines.set('bpmn.editor.showGrid', false, diagramInA), { scope: 'solution' });

    const nothingDefines = await mediatorWithLayers({});
    assert.deepStrictEqual(await nothingDefines.set('bpmn.editor.showGrid', true, diagramInA), { scope: 'user' });
  });

  it('does not consult a solution layer when there is no solution file', async () => {
    const settings = await mediatorWithLayers({ user: { 'bpmn.editor.showGrid': true }, solution: null });

    assert.deepStrictEqual(settings.inspect('bpmn.editor.showGrid', diagramInA), { value: true, definedIn: 'user' });
    assert.deepStrictEqual(await settings.set('bpmn.editor.showGrid', false, diagramInA), { scope: 'user' });
  });
});
