import { describe, expect, it, vi } from 'vitest';

import { initializeCommands } from '../../../src/modules/git-cruiser/initializers/initializeCommands';

const repositoryRoot = '/work/repository';

/** Everything the registrations do not need answers with a no-op. */
function createNoopProxy(overrides: Record<string, unknown> = {}): any {
  return new Proxy(overrides, {
    get: (target, property: string) => (property in target ? target[property] : vi.fn()),
  });
}

function stagedFile(path: string, indexStatus = 'modified') {
  return { path, previousPath: null, indexStatus, workingTreeStatus: null };
}

function digest(overrides: Record<string, unknown> = {}) {
  return {
    fileChange: 'modified',
    modelName: null,
    addedElementNames: [],
    removedElementNames: [],
    modifiedElementNames: [],
    layoutChangedCount: 0,
    fileDetailsChanged: false,
    ...overrides,
  };
}

async function suggest(files: any[], digests: Record<string, any> = {}) {
  const handlers = new Map<string, (...commandArguments: any[]) => unknown>();
  const notifications = { open: vi.fn() };
  const bifrost = createNoopProxy({
    commands: {
      register: (name: string, handler: (...commandArguments: any[]) => unknown) => handlers.set(name, handler),
      isRegistered: (name: string) => handlers.has(name),
      executeCommand: (name: string, commandArguments: any[] = []) => handlers.get(name)?.(...commandArguments),
    },
    notifications,
    sourceControl: { getFileContentAtRevision: async (_root: string, _ref: string, path: string) => `head:${path}` },
    files: { load: async (uri: string) => `disk:${uri}` },
  });
  const repositoryStore = createNoopProxy({ getRepoState: () => ({ files }) });
  initializeCommands(bifrost, repositoryStore);

  for (const command of ['bpmn.diff.getChangeDigest', 'dmn.diff.getChangeDigest']) {
    handlers.set(command, async (before: string | null, after: string | null) => {
      const match = Object.keys(digests).find((path) => (after ?? before)?.endsWith(path));
      if (match == null) {
        throw new Error('unparsable');
      }
      return digests[match];
    });
  }

  const title = await handlers.get('git.suggestCommitTitle')?.(repositoryRoot);
  return { title, notifications };
}

describe('git.suggestCommitTitle', () => {
  it('asks to stage a model when none is staged', async () => {
    const { title, notifications } = await suggest([stagedFile('notes.txt')]);
    expect(title).toBeNull();
    expect(notifications.open).toHaveBeenCalledWith('Stage a BPMN or DMN file first.');
  });

  it('names a new and a deleted model', async () => {
    expect(
      (
        await suggest([stagedFile('order.bpmn', 'added')], {
          'order.bpmn': digest({ fileChange: 'added', modelName: 'Order' }),
        })
      ).title,
    ).toBe('Order: add model');
    expect(
      (await suggest([stagedFile('order.bpmn', 'deleted')], { 'order.bpmn': digest({ fileChange: 'deleted' }) })).title,
    ).toBe('order.bpmn: remove model');
  });

  it('lists the first element of each kind and counts the rest', async () => {
    const { title } = await suggest([stagedFile('order.bpmn')], {
      'order.bpmn': digest({
        modelName: 'Order',
        addedElementNames: ['Approve', 'Notify', 'Archive'],
        modifiedElementNames: ['Check stock'],
        removedElementNames: ['Legacy step', 'Old gateway'],
      }),
    });
    expect(title).toBe("Order: add 'Approve' +2, change 'Check stock', remove 'Legacy step' +1");
  });

  it('describes a layout-only change and a change without content', async () => {
    expect(
      (
        await suggest([stagedFile('order.bpmn')], {
          'order.bpmn': digest({ modelName: 'Order', layoutChangedCount: 4 }),
        })
      ).title,
    ).toBe('Order: adjust layout');
    expect(
      (
        await suggest([stagedFile('order.bpmn')], {
          'order.bpmn': digest({ modelName: 'Order', fileDetailsChanged: true }),
        })
      ).title,
    ).toBe('Order: update');
  });

  it('names a model that could not be summarized', async () => {
    expect((await suggest([stagedFile('broken.bpmn')])).title).toBe('broken.bpmn: update');
    expect(
      (
        await suggest([stagedFile('a.bpmn'), stagedFile('broken.dmn')], {
          'a.bpmn': digest({ modelName: 'A' }),
        })
      ).title,
    ).toBe('Update A, broken.dmn');
  });

  it('summarizes several models by name', async () => {
    const digests = { 'a.bpmn': digest({ modelName: 'A' }), 'b.dmn': digest() };
    expect((await suggest([stagedFile('a.bpmn'), stagedFile('b.dmn')], digests)).title).toBe('Update A, b.dmn');

    const files = ['a.bpmn', 'b.bpmn', 'c.dmn', 'd.dmn'].map((path) => stagedFile(path));
    const manyDigests = Object.fromEntries(files.map((file) => [file.path, digest()]));
    expect((await suggest(files, manyDigests)).title).toBe('Update a.bpmn, b.bpmn and 2 more');
  });

  it('cuts a long title at 72 characters with an ellipsis', async () => {
    const { title } = await suggest([stagedFile('order.bpmn')], {
      'order.bpmn': digest({
        modelName: 'Order',
        addedElementNames: ['An element with a very long display name that goes on and on and on and on'],
      }),
    });
    expect(title).toHaveLength(72);
    expect(title?.endsWith('…')).toBe(true);
  });
});
