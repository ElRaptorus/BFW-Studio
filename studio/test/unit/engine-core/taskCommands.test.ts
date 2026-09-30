import { ENGINE_COMMANDS } from '#modules/engine-core/commands/CommandContract';
import registerTaskCommands from '#modules/engine-core/commands/registerTaskCommands';
import { describe, expect, it } from 'vitest';

import { createRecordingBifrost, createRecordingConnectionManager } from '../support/recordingBifrost';

function setup() {
  const { bifrost, calls } = createRecordingBifrost();
  registerTaskCommands(bifrost, createRecordingConnectionManager(calls));
  return { bifrost, clientCalls: () => calls.filter((call) => !call.method.startsWith('command:')) };
}

describe('engine-core task commands', () => {
  it('finishUserTask forwards the finish request', async () => {
    const { bifrost, clientCalls } = setup();

    await bifrost.commands.executeCommand(ENGINE_COMMANDS.finishUserTask, [
      'engine-1',
      'task-1',
      { actionId: 'approve', values: { approved: true } },
    ]);

    expect(clientCalls()).toEqual([
      { method: 'userTasks.finish', arguments: ['task-1', { actionId: 'approve', values: { approved: true } }] },
    ]);
  });

  it('finishUserTask without a request sends no body', async () => {
    const { bifrost, clientCalls } = setup();

    await bifrost.commands.executeCommand(ENGINE_COMMANDS.finishUserTask, ['engine-1', 'task-1']);

    expect(clientCalls()).toEqual([{ method: 'userTasks.finish', arguments: ['task-1', undefined] }]);
  });

  it('cancelUserTask forwards the reason', async () => {
    const { bifrost, clientCalls } = setup();

    await bifrost.commands.executeCommand(ENGINE_COMMANDS.cancelUserTask, ['engine-1', 'task-1', 'abort']);
    await bifrost.commands.executeCommand(ENGINE_COMMANDS.cancelUserTask, ['engine-1', 'task-2']);

    expect(clientCalls()).toEqual([
      { method: 'userTasks.cancel', arguments: ['task-1', { reason: 'abort' }] },
      { method: 'userTasks.cancel', arguments: ['task-2', undefined] },
    ]);
  });

  it('confirmManualTask confirms by id', async () => {
    const { bifrost, clientCalls } = setup();

    await bifrost.commands.executeCommand(ENGINE_COMMANDS.confirmManualTask, ['engine-1', 'manual-1']);

    expect(clientCalls()).toEqual([{ method: 'manualTasks.confirm', arguments: ['manual-1'] }]);
  });

  it('rejects an engine that is not connected', async () => {
    const { bifrost, clientCalls } = setup();

    await expect(
      bifrost.commands.executeCommand(ENGINE_COMMANDS.confirmManualTask, ['engine-unknown', 'manual-1']),
    ).rejects.toThrow('Engine engine-unknown not connected');
    expect(clientCalls()).toEqual([]);
  });
});
