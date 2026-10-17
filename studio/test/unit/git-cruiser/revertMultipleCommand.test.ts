import { describe, expect, it, vi } from 'vitest';

import { initializeCommands } from '../../../src/modules/git-cruiser/initializers/initializeCommands';

/** Everything the registrations do not need answers with a no-op. */
function createNoopProxy(overrides: Record<string, unknown> = {}): any {
  return new Proxy(overrides, {
    get: (target, property: string) => (property in target ? target[property] : vi.fn()),
  });
}

const statuses: Record<string, { repositoryRoot: string; path: string; workingTreeStatus: string | null }> = {
  'file:///first/a.bpmn': { repositoryRoot: '/first', path: 'a.bpmn', workingTreeStatus: 'modified' },
  'file:///first/sub/b.dmn': { repositoryRoot: '/first', path: 'sub/b.dmn', workingTreeStatus: null },
  'file:///first/new.bpmn': { repositoryRoot: '/first', path: 'new.bpmn', workingTreeStatus: 'untracked' },
  'file:///second/c.bpmn': { repositoryRoot: '/second', path: 'c.bpmn', workingTreeStatus: 'deleted' },
};

async function revertMultiple(uris: string[], dialogResponse = 'revert') {
  const handlers = new Map<string, (...commandArguments: any[]) => unknown>();
  const dialog = { open: vi.fn(async () => ({ response: dialogResponse, formData: {} })) };
  const openDocument = { uri: 'file:///first/a.bpmn' };
  const editors = {
    getEditorDocumentByUri: (uri: string) => (uri === openDocument.uri ? openDocument : null),
    saveEditorDocument: vi.fn(async () => undefined),
  };
  const bifrost = createNoopProxy({
    commands: {
      register: (name: string, handler: (...commandArguments: any[]) => unknown) => handlers.set(name, handler),
    },
    settings: { get: () => undefined, set: vi.fn() },
    dialog,
    editors,
  });
  const revert = vi.fn(async () => undefined);
  const repositoryStore = createNoopProxy({
    getRepoRootForUri: (uri: string) => statuses[uri]?.repositoryRoot ?? null,
    getFileStatus: (uri: string) => {
      const status = statuses[uri];
      return status == null
        ? null
        : { path: status.path, indexStatus: null, workingTreeStatus: status.workingTreeStatus };
    },
    revert,
  });
  initializeCommands(bifrost, repositoryStore);

  await handlers.get('git.revertMultiple')?.(uris);
  return { dialog, revert, editors };
}

describe('git.revertMultiple', () => {
  it('asks once and reverts each repository in one call, skipping untracked and unknown files', async () => {
    const { dialog, revert, editors } = await revertMultiple(Object.keys(statuses).concat('file:///outside/x.bpmn'));

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(revert.mock.calls).toEqual([
      ['/first', ['a.bpmn', 'sub/b.dmn']],
      ['/second', ['c.bpmn']],
    ]);
    expect(editors.saveEditorDocument).toHaveBeenCalledWith({ uri: 'file:///first/a.bpmn' }, false);
  });

  it('reverts nothing when the user cancels', async () => {
    const { revert } = await revertMultiple(['file:///first/a.bpmn', 'file:///second/c.bpmn'], 'cancel');
    expect(revert).not.toHaveBeenCalled();
  });

  it('does not ask when no selected file can be reverted', async () => {
    const { dialog, revert } = await revertMultiple(['file:///first/new.bpmn']);
    expect(dialog.open).not.toHaveBeenCalled();
    expect(revert).not.toHaveBeenCalled();
  });
});
