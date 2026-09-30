import type { DialogResult } from '#bifrost/contracts/DialogTypes';
import registerTaskCommands from '#modules/engine-core/commands/registerTaskCommands';
import initializeCommands from '#modules/engine-debugger/initializers/initializeCommands';
import { describe, expect, it } from 'vitest';

import { FlowNodeInstanceState, FniNotWaitingError } from '@elraptorus/bfw_engine_sdk';

import { createRecordingBifrost, createRecordingConnectionManager, recordedMethods } from '../support/recordingBifrost';

const CANCEL_COMMAND = 'engine.debugger.taskView.cancelUserTask';

function setup(dialogResult: DialogResult, failures: Partial<Record<string, Error>> = {}) {
  const { bifrost, calls } = createRecordingBifrost({ dialogResult });
  const connectionManager = createRecordingConnectionManager(calls, failures);
  registerTaskCommands(bifrost, connectionManager);
  initializeCommands(bifrost, connectionManager);
  return { bifrost, calls };
}

describe('engine.debugger.taskView.cancelUserTask', () => {
  it('cancels the task with the action id only for the cancel-user-task response', async () => {
    const { bifrost, calls } = setup({ wasCancelled: false, response: 'cancel-user-task' });

    const cancelled = await bifrost.commands.executeCommand(CANCEL_COMMAND, ['engine-1', 'task-1', 'abort']);

    expect(cancelled).toBe(true);
    expect(calls.find((call) => call.method === 'userTasks.cancel')?.arguments).toEqual([
      'task-1',
      { reason: 'abort' },
    ]);
  });

  it('keeps the task when the user keeps it or closes the dialog', async () => {
    for (const dialogResult of [{ wasCancelled: false, response: 'keep' }, { wasCancelled: true }]) {
      const { bifrost, calls } = setup(dialogResult);

      const cancelled = await bifrost.commands.executeCommand(CANCEL_COMMAND, ['engine-1', 'task-1', 'abort']);

      expect(cancelled).toBe(false);
      expect(recordedMethods(calls)).not.toContain('userTasks.cancel');
    }
  });

  it('reports a task that is no longer waiting', async () => {
    const { bifrost, calls } = setup(
      { wasCancelled: false, response: 'cancel-user-task' },
      { 'userTasks.cancel': new FniNotWaitingError('not waiting', FlowNodeInstanceState.Finished) },
    );

    const cancelled = await bifrost.commands.executeCommand(CANCEL_COMMAND, ['engine-1', 'task-1', 'abort']);

    expect(cancelled).toBe(false);
    expect(calls.find((call) => call.method === 'notifications.open')?.arguments[0]).toMatchObject({
      type: 'error',
      content: 'This User Task is no longer waiting and cannot be cancelled.',
    });
  });
});
