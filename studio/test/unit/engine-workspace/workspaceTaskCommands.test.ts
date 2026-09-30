import registerTaskCommands from '#modules/engine-core/commands/registerTaskCommands';
import initializeCommands from '#modules/engine-workspace/initializers/initializeCommands';
import type { TaskInboxDocumentModel } from '#modules/engine-workspace/models/TaskInboxDocumentModel';
import { describe, expect, it } from 'vitest';

import { FlowNodeType } from '@elraptorus/bfw_engine_sdk';

import { createRecordingBifrost, createRecordingConnectionManager } from '../support/recordingBifrost';

function setup(failures: Partial<Record<string, Error>> = {}) {
  const { bifrost, calls } = createRecordingBifrost();
  const connectionManager = createRecordingConnectionManager(calls, failures);
  registerTaskCommands(bifrost, connectionManager);
  initializeCommands(bifrost, connectionManager);
  const clientCalls = () =>
    calls.filter((call) => !call.method.startsWith('command:') && call.method !== 'notifications.open');
  const notifications = () =>
    calls.filter((call) => call.method === 'notifications.open').map((call) => call.arguments[0]);
  return { bifrost, calls, clientCalls, notifications };
}

describe('engine.workspace.completeTask', () => {
  it('confirms a Manual Task through engine.confirmManualTask', async () => {
    const { bifrost, calls, clientCalls } = setup();

    await bifrost.commands.executeCommand('engine.workspace.completeTask', [
      'engine-1',
      { id: 'manual-1', flowNodeType: FlowNodeType.ManualTask },
    ]);

    expect(calls.map((call) => call.method)).toContain('command:engine.confirmManualTask');
    expect(clientCalls()).toEqual([{ method: 'manualTasks.confirm', arguments: ['manual-1'] }]);
  });

  it('finishes a User Task through engine.finishUserTask with no body', async () => {
    const { bifrost, calls, clientCalls } = setup();

    await bifrost.commands.executeCommand('engine.workspace.completeTask', [
      'engine-1',
      { id: 'user-1', flowNodeType: FlowNodeType.UserTask },
    ]);

    expect(calls.map((call) => call.method)).toContain('command:engine.finishUserTask');
    expect(clientCalls()).toEqual([{ method: 'userTasks.finish', arguments: ['user-1', undefined] }]);
  });

  it('rejects any other flow node type without an Engine call', async () => {
    const { bifrost, clientCalls } = setup();

    await expect(
      bifrost.commands.executeCommand('engine.workspace.completeTask', [
        'engine-1',
        { id: 'task-1', flowNodeType: FlowNodeType.Task },
      ]),
    ).rejects.toThrow('Task task-1 of type task cannot be completed from the inbox.');
    expect(clientCalls()).toEqual([]);
  });
});

describe('engine.workspace.taskInbox wrappers', () => {
  it('completeSingle completes the task and reports it', async () => {
    const { bifrost, clientCalls, notifications } = setup();

    await bifrost.commands.executeCommand('engine.workspace.taskInbox.completeSingle', [
      'engine-1',
      { id: 'manual-1', flowNodeType: FlowNodeType.ManualTask },
    ]);

    expect(clientCalls()).toEqual([{ method: 'manualTasks.confirm', arguments: ['manual-1'] }]);
    expect(notifications()).toEqual([{ type: 'info', content: 'Task completed.', source: 'Engine' }]);
  });

  it('completeSelected completes every task, reports once and clears the selection', async () => {
    const { bifrost, clientCalls, notifications } = setup({ 'userTasks.finish': new Error('contract violation') });
    const selectionChanges: string[][] = [];
    let refreshCount = 0;
    const model = {
      getEngineId: () => 'engine-1',
      getSelectedTasks: () => [
        { id: 'manual-1', flowNodeType: FlowNodeType.ManualTask },
        { id: 'user-1', flowNodeType: FlowNodeType.UserTask },
      ],
      setSelectedTaskIds: (taskIds: string[]) => selectionChanges.push(taskIds),
      refresh: async () => {
        refreshCount++;
      },
    } as unknown as TaskInboxDocumentModel;

    await bifrost.commands.executeCommand('engine.workspace.taskInbox.completeSelected', [model]);

    expect(clientCalls().map((call) => call.method)).toEqual(['manualTasks.confirm', 'userTasks.finish']);
    expect(notifications()).toEqual([
      { type: 'warning', content: '1 of 2 tasks completed, 1 failed.', source: 'Engine' },
    ]);
    expect(selectionChanges).toEqual([[]]);
    expect(refreshCount).toBe(1);
  });
});
