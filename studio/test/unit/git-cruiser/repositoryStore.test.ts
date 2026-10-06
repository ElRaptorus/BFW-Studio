import { describe, expect, it, vi } from 'vitest';

import { RepositoryStore } from '../../../src/modules/git-cruiser/RepositoryStore';

async function createStore(repositoryRootByProjectPath: Record<string, string>) {
  const bifrost = {
    settings: { get: (key: string) => (key === 'gitCruiser.general.enabled' ? true : undefined) },
    events: { emitInternalBifrostEvent: vi.fn(), emit: vi.fn() },
    solution: {
      getSolution: () => ({
        projects: Object.keys(repositoryRootByProjectPath).map((projectPath) => ({ baseUri: `file://${projectPath}` })),
      }),
    },
    sourceControl: {
      isAvailable: async () => true,
      findRepositoryRoot: async (projectPath: string) => repositoryRootByProjectPath[projectPath] ?? null,
      getRepositoryState: async (repositoryRoot: string) => ({ repositoryRoot, files: [] }),
    },
  } as any;
  const store = new RepositoryStore(bifrost);
  await store.initialize();
  return { store, bifrost };
}

describe('RepositoryStore', () => {
  it('finds the repository that contains a file, respecting path boundaries', async () => {
    const { store } = await createStore({
      '/x/BFW-Studio/studio/test': '/x/BFW-Studio',
      '/x/BFW-Studio-old': '/x/BFW-Studio-old',
    });

    expect(store.getRepoRootForUri('file:///x/BFW-Studio/a/file.bpmn')).toBe('/x/BFW-Studio');
    expect(store.getRepoRootForUri('file:///x/BFW-Studio-old/file.bpmn')).toBe('/x/BFW-Studio-old');
    expect(store.getRepoRootForUri('file:///x/BFW-Studio')).toBe('/x/BFW-Studio');
    expect(store.getRepoRootForUri('file:///x/BFW-Studio-other/file.bpmn')).toBeNull();
    expect(store.getRepoRootForUri('file:///elsewhere/file.bpmn')).toBeNull();
  });

  it('prefers the innermost repository for nested repositories', async () => {
    const { store } = await createStore({
      '/x/outer': '/x/outer',
      '/x/outer/inner': '/x/outer/inner',
    });

    expect(store.getRepoRootForUri('file:///x/outer/inner/file.bpmn')).toBe('/x/outer/inner');
    expect(store.getRepoRootForUri('file:///x/outer/file.bpmn')).toBe('/x/outer');
  });
});
