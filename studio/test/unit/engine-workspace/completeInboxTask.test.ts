import { describe, expect, it } from 'vitest';

import type { BfwEngineClient } from '@elraptorus/bfw_engine_client';
import { FlowNodeType } from '@elraptorus/bfw_engine_sdk';

import { completeInboxTask } from '../../../src/modules/engine-workspace/initializers/initializeCommands';

type InboxClient = Pick<BfwEngineClient, 'userTasks' | 'manualTasks'>;

function recordingClient() {
  const calls: { method: string; arguments: unknown[] }[] = [];
  const client = {
    userTasks: {
      finish: async (...callArguments: unknown[]) => {
        calls.push({ method: 'userTasks.finish', arguments: callArguments });
      },
    },
    manualTasks: {
      confirm: async (...callArguments: unknown[]) => {
        calls.push({ method: 'manualTasks.confirm', arguments: callArguments });
      },
    },
  };
  return { calls, client };
}

describe('completeInboxTask', () => {
  it('confirms a Manual Task by id and does not finish a User Task', async () => {
    const { calls, client } = recordingClient();

    await completeInboxTask(client as InboxClient, { id: 'manual-1', flowNodeType: FlowNodeType.ManualTask });

    expect(calls).toEqual([{ method: 'manualTasks.confirm', arguments: ['manual-1'] }]);
  });

  it('finishes a User Task by id with no body and does not confirm a Manual Task', async () => {
    const { calls, client } = recordingClient();

    await completeInboxTask(client as InboxClient, { id: 'user-1', flowNodeType: FlowNodeType.UserTask });

    expect(calls).toEqual([{ method: 'userTasks.finish', arguments: ['user-1'] }]);
  });

  it('rejects any other flow node type without calling the client', async () => {
    const { calls, client } = recordingClient();

    await expect(
      completeInboxTask(client as InboxClient, { id: 'task-1', flowNodeType: FlowNodeType.Task }),
    ).rejects.toThrow('Task task-1 of type task cannot be completed from the inbox.');
    expect(calls).toEqual([]);
  });
});
