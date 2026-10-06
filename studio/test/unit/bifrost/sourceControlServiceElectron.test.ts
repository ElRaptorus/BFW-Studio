import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ ipcRenderer: { on: vi.fn(), removeListener: vi.fn(), invoke, send: vi.fn() } }));

const { SourceControlServiceElectron } =
  await import('../../../src/bifrost/electron-renderer/SourceControlServiceElectron');

describe('SourceControlServiceElectron.pull', () => {
  const service = new SourceControlServiceElectron();

  beforeEach(() => {
    invoke.mockReset();
  });

  it('reports success when the main process resolves', async () => {
    invoke.mockResolvedValue(undefined);

    await expect(service.pull('/repository', { rebase: true })).resolves.toEqual({ success: true });
    expect(invoke).toHaveBeenCalledWith('IPC_INVOKE_GIT_PULL', '/repository', { rebase: true });
  });

  it.each([
    ['CONFLICT (content): Merge conflict in process.bpmn', 'merge-conflicts'],
    ['Automatic merge failed; fix conflicts and then commit the result.', 'merge-conflicts'],
    ['hint: You have divergent branches ... fatal: Need to specify how to reconcile diverged branches', 'rebase'],
    ['error: Your local changes to the following files would be overwritten by merge', 'rebase'],
    ['error: cannot pull with rebase: You have uncommitted changes.', 'stash-and-retry'],
    ['error: Pulling is not possible because you have unmerged files.', 'stash-and-retry'],
    ["Error invoking remote method 'IPC_INVOKE_GIT_PULL': Error: Could not resolve host: example.com", null],
  ])('classifies the failure %j', async (message, recoverable) => {
    invoke.mockRejectedValue(new Error(message));

    await expect(service.pull('/repository')).resolves.toEqual({ success: false, error: message, recoverable });
  });
});
