import type { FileHandlingService } from '#bifrost/common/FileHandlingService';
import { LocalStorageItem } from '#bifrost/common/LocalStorageItem';
import { SettingsMediator } from '#bifrost/common/SettingsMediator';
import {
  SolutionFileUnreadableError,
  readSolutionFile,
  readSolutionSettings,
  readSolutionSettingsText,
  repairSolutionFile,
  updateSolutionSettings,
  writeSolutionFolders,
} from '#bifrost/common/SolutionFile';
import { SolutionMediator } from '#bifrost/common/SolutionMediator';
import type { Solution } from '#bifrost/contracts/SolutionTypes';
import assert from 'node:assert';
import { describe, it } from 'vitest';

function solution(): Solution {
  return {
    type: 'solution',
    id: 'solution-id',
    name: 'Demo',
    baseUri: 'file:///tmp/Demo.bfwsln',
    showHiddenFiles: false,
    solutionFileUri: 'file:///tmp/Demo.bfwsln',
    projects: [
      {
        type: 'project',
        id: 'project-id',
        name: 'app',
        baseUri: 'file:///tmp/app',
        files: { included: [], excluded: [] },
      },
    ],
  };
}

type MemoryFiles = FileHandlingService & {
  files: Map<string, string>;
  saves: string[];
  failingSaveUri: string | null;
  existsThrows: boolean;
};

function memoryFiles(): MemoryFiles {
  const files = new Map<string, string>();
  const fake = {
    files,
    saves: [] as string[],
    failingSaveUri: null as string | null,
    existsThrows: false,
    load: async (uri: string) => {
      const content = files.get(uri);
      if (content == null) {
        throw new Error('not found');
      }
      return content;
    },
    save: async (uri: string, content: string) => {
      if (uri === fake.failingSaveUri) {
        return false;
      }
      files.set(uri, String(content));
      fake.saves.push(uri);
      return true;
    },
    getFilename: (uri: string) => uri.split('/').pop() ?? uri,
    getUriForFilename: (filename: string) => `file://${filename}`,
    getLocalFilenameForUri: (uri: string) => uri.replace(/^file:\/\//, ''),
    watchFile: () => ({ dispose: () => undefined }),
    doesFileOrDirectoryExist: async (localFilename: string) => {
      if (fake.existsThrows) {
        throw new Error('doesFileOrDirectoryExist not implemented');
      }
      return files.has(`file://${localFilename}`);
    },
  };
  return fake as unknown as MemoryFiles;
}

const solutionFileUri = 'file:///tmp/Demo.bfwsln';

describe('writeSolutionFolders', () => {
  it('preserves the existing settings block', async () => {
    const files = memoryFiles();
    files.files.set(
      solutionFileUri,
      JSON.stringify({ folders: [{ path: '/tmp/app' }], settings: { 'bpmn.editor.showGrid': false } }),
    );

    await writeSolutionFolders(solutionFileUri, solution(), files);

    const written = JSON.parse(files.files.get(solutionFileUri) ?? '{}');
    assert.deepStrictEqual(written.settings, { 'bpmn.editor.showGrid': false });
    assert.deepStrictEqual(written.folders, [{ path: '/tmp/app' }]);
  });

  it('keeps comments outside folders and stays readable after a folder rename', async () => {
    const files = memoryFiles();
    files.files.set(
      solutionFileUri,
      [
        '{',
        '  "folders": [{ "path": "/tmp/app" }],',
        '  // shared editor defaults',
        '  "settings": {',
        '    // grid for everyone',
        '    "bpmn.editor.showGrid": true',
        '  }',
        '}',
      ].join('\n'),
    );
    const renamed = solution();
    renamed.projects[0].name = 'Application';

    await writeSolutionFolders(solutionFileUri, renamed, files);

    const saved = files.files.get(solutionFileUri) ?? '';
    assert.match(saved, /\/\/ shared editor defaults/);
    assert.match(saved, /\/\/ grid for everyone/);
    const reread = await readSolutionFile(solutionFileUri, files);
    assert.deepStrictEqual(reread.folders, [{ path: '/tmp/app', name: 'Application' }]);
    assert.strictEqual(reread.settings['bpmn.editor.showGrid'], true);
  });

  it('creates a missing file and refuses a settings update of a missing file', async () => {
    const files = memoryFiles();
    await writeSolutionFolders(solutionFileUri, solution(), files);
    assert.deepStrictEqual(JSON.parse(files.files.get(solutionFileUri) ?? '{}').folders, [{ path: '/tmp/app' }]);

    files.files.delete(solutionFileUri);
    await assert.rejects(
      () =>
        updateSolutionSettings(solutionFileUri, files, (settings) => {
          settings['bpmn.editor.showGrid'] = true;
        }),
      SolutionFileUnreadableError,
    );
    assert.strictEqual(files.files.has(solutionFileUri), false);
  });
});

describe('unreadable solution files', () => {
  it('never saves over unreadable content', async () => {
    const cases = ['{', '[]', 'present'];
    for (const content of cases) {
      const files = memoryFiles();
      if (content === 'present') {
        files.files.set(solutionFileUri, '{');
        files.load = async () => {
          throw new Error('permission denied');
        };
      } else {
        files.files.set(solutionFileUri, content);
      }

      await assert.rejects(() => writeSolutionFolders(solutionFileUri, solution(), files), SolutionFileUnreadableError);
      assert.deepStrictEqual(files.saves, []);
    }
  });
});

describe('solution file writes', () => {
  it('applies concurrent updates in order', async () => {
    const files = memoryFiles();
    files.files.set(solutionFileUri, JSON.stringify({ folders: [], settings: {} }));

    await Promise.all([
      updateSolutionSettings(solutionFileUri, files, (settings) => {
        settings.grid = true;
      }),
      updateSolutionSettings(solutionFileUri, files, (settings) => {
        settings.marker = true;
      }),
    ]);

    const written = JSON.parse(files.files.get(solutionFileUri) ?? '{}');
    assert.strictEqual(written.settings.grid, true);
    assert.strictEqual(written.settings.marker, true);
  });

  it('repairs only after the backup is written and picks the next free name', async () => {
    const files = memoryFiles();
    files.files.set(solutionFileUri, '{ broken');
    files.files.set(`${solutionFileUri}.broken`, 'older backup');

    const backupUri = await repairSolutionFile(solutionFileUri, solution(), files);

    assert.strictEqual(backupUri, `${solutionFileUri}.broken.1`);
    assert.strictEqual(files.files.get(`${solutionFileUri}.broken.1`), '{ broken');
    assert.deepStrictEqual(files.saves[0], `${solutionFileUri}.broken.1`);
    const repaired = JSON.parse(files.files.get(solutionFileUri) ?? '{}');
    assert.deepStrictEqual(repaired.folders, [{ path: '/tmp/app' }]);
    assert.deepStrictEqual(repaired.settings, {});
  });

  it('does not rewrite an existing file whose content cannot be backed up', async () => {
    const files = memoryFiles();
    files.files.set(solutionFileUri, '{ broken');
    files.load = async () => {
      throw new Error('permission denied');
    };

    await assert.rejects(() => repairSolutionFile(solutionFileUri, solution(), files), /not repaired/);
    assert.deepStrictEqual(files.saves, []);
  });

  it('reports a failed save instead of treating it as written', async () => {
    const files = memoryFiles();
    files.files.set(solutionFileUri, JSON.stringify({ folders: [], settings: {} }));
    files.failingSaveUri = solutionFileUri;

    await assert.rejects(() => writeSolutionFolders(solutionFileUri, solution(), files), /Could not save/);
  });

  it('reads settings from a file without folders', async () => {
    const files = memoryFiles();
    files.files.set(solutionFileUri, JSON.stringify({ settings: { grid: true } }));
    assert.deepStrictEqual(await readSolutionSettings(solutionFileUri, files), { grid: true });
  });

  it('aborts the repair when the backup cannot be saved', async () => {
    const files = memoryFiles();
    files.files.set(solutionFileUri, '{ broken');
    files.failingSaveUri = `${solutionFileUri}.broken`;

    await assert.rejects(() => repairSolutionFile(solutionFileUri, solution(), files), /backup/);
    assert.strictEqual(files.files.get(solutionFileUri), '{ broken');
  });

  it('keeps a renamed solution dirty when the repair is declined', async () => {
    const files = memoryFiles();
    files.files.set(solutionFileUri, JSON.stringify({ folders: [{ path: '/tmp/app' }], settings: {} }));
    const items = new Map<string, string>();
    const storage = new LocalStorageItem(
      {
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => items.set(key, value),
        removeItem: (key) => items.delete(key),
      },
      'Settings',
    );
    const solutionMediator = new SolutionMediator(
      files,
      { mark: () => undefined, measure: () => undefined } as never,
      { addRecentlyOpenedSolutionItem: () => undefined } as never,
      new SettingsMediator(storage),
      { on: () => ({ dispose: () => undefined }), traverse: () => undefined } as never,
      storage,
      async () => false,
    );
    await solutionMediator.openSolutionFile(solutionFileUri);
    files.files.set(solutionFileUri, '{');

    const projectId = solutionMediator.getSolution()?.projects[0]?.id as string;
    await solutionMediator.renameProjectInSolution(projectId, 'Renamed');

    assert.strictEqual(await solutionMediator.saveSolutionFile(solutionFileUri), false);
    assert.strictEqual(solutionMediator.isSolutionDirty(), true);
    assert.strictEqual(files.files.get(solutionFileUri), '{');
  });

  it('declares view folders relative to the solution file and keeps them across writes and repairs', async () => {
    const files = memoryFiles();
    files.files.set(
      solutionFileUri,
      '{\n  "folders": [{ "path": "/tmp/app" }],\n  // views\n  "views": { "other": { "path": "../shared/other", "note": 1 }, "blank": { "path": " " } },\n  "settings": {}\n}\n',
    );
    const watched: string[] = [];
    files.watchDirectory = ((uri: string) => {
      watched.push(uri);
      return { dispose: () => undefined };
    }) as never;
    const storage = new LocalStorageItem(
      { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
      'Settings',
    );
    const solutionMediator = new SolutionMediator(
      files,
      { mark: () => undefined, measure: () => undefined } as never,
      { addRecentlyOpenedSolutionItem: () => undefined } as never,
      new SettingsMediator(storage),
      { on: () => ({ dispose: () => undefined }), traverse: () => undefined } as never,
      storage,
      async () => false,
    );

    await solutionMediator.openSolutionFile(solutionFileUri);
    assert.strictEqual(solutionMediator.getViewFolderUri('other'), 'file:///shared/other');
    assert.strictEqual(solutionMediator.getViewFolderUri('blank'), null);
    assert.deepStrictEqual(watched, ['file:///tmp/app', 'file:///shared/other']);

    assert.strictEqual(await solutionMediator.setViewFolder('landscapes', 'file:///tmp/landscapes'), true);
    assert.strictEqual(solutionMediator.getViewFolderUri('landscapes'), 'file:///tmp/landscapes');
    let saved = files.files.get(solutionFileUri) ?? '';
    assert.match(saved, /\/\/ views/);
    assert.deepStrictEqual(JSON.parse(saved.replace(/\/\/ views\n/, '')).views, {
      other: { path: '../shared/other', note: 1 },
      blank: { path: ' ' },
      landscapes: { path: 'landscapes' },
    });

    assert.strictEqual(await solutionMediator.setViewFolder('other', null), true);
    assert.strictEqual(await solutionMediator.setViewFolder('blank', null), true);
    assert.strictEqual(solutionMediator.getViewFolderUri('other'), null);

    const opened = solutionMediator.getSolution() as Solution;
    await writeSolutionFolders('file:///elsewhere/Copy.bfwsln', opened, files);
    assert.deepStrictEqual(JSON.parse(files.files.get('file:///elsewhere/Copy.bfwsln') ?? '{}').views, {
      landscapes: { path: '../tmp/landscapes' },
    });

    files.files.set(solutionFileUri, '{ broken');
    await repairSolutionFile(solutionFileUri, opened, files);
    saved = files.files.get(solutionFileUri) ?? '';
    assert.deepStrictEqual(JSON.parse(saved).views, { landscapes: { path: 'landscapes' } });
    assert.deepStrictEqual((await readSolutionFile(solutionFileUri, files)).views, {
      landscapes: 'file:///tmp/landscapes',
    });
  });

  it('refuses view folders without a saved solution file and when the file cannot be read', async () => {
    const files = memoryFiles();
    const storage = new LocalStorageItem(
      { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
      'Settings',
    );
    let repairOffers = 0;
    const solutionMediator = new SolutionMediator(
      files,
      { mark: () => undefined, measure: () => undefined } as never,
      { addRecentlyOpenedSolutionItem: () => undefined } as never,
      new SettingsMediator(storage),
      { on: () => ({ dispose: () => undefined }), traverse: () => undefined } as never,
      storage,
      async () => {
        repairOffers++;
        return false;
      },
    );
    files.watchDirectory = (() => ({ dispose: () => undefined })) as never;

    solutionMediator.openDirectoryAsSolution('file:///tmp/app');
    assert.strictEqual(solutionMediator.getViewFolderUri('landscapes'), null);
    await assert.rejects(
      () => solutionMediator.setViewFolder('landscapes', 'file:///tmp/app/maps'),
      /Save the solution/,
    );

    files.files.set(solutionFileUri, JSON.stringify({ folders: [{ path: '/tmp/app' }] }));
    await solutionMediator.openSolutionFile(solutionFileUri);
    files.files.set(solutionFileUri, '{');
    assert.strictEqual(await solutionMediator.setViewFolder('landscapes', 'file:///tmp/app/maps'), false);
    assert.strictEqual(repairOffers, 1);
    assert.strictEqual(solutionMediator.getViewFolderUri('landscapes'), null);
  });

  it('returns the settings text with comments', async () => {
    const files = memoryFiles();
    files.files.set(solutionFileUri, '{\n  "folders": [],\n  "settings": {\n    // note\n    "grid": true\n  }\n}\n');
    const text = await readSolutionSettingsText(solutionFileUri, files);
    assert.match(text, /\/\/ note/);
  });
});
