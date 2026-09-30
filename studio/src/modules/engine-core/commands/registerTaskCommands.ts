import type { Bifrost } from '#bifrost/Bifrost';

import type { BfwEngineClient } from '@elraptorus/bfw_engine_client';
import type { FinishUserTaskRequest } from '@elraptorus/bfw_engine_sdk';

import type { EngineConnectionManager } from '../EngineConnectionManager';
import { ENGINE_COMMANDS } from './CommandContract';

export default function registerTaskCommands(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  function requireClient(engineId: string): BfwEngineClient {
    const connection = connectionManager.getConnection(engineId);
    if (!connection) {
      throw new Error(`Engine ${engineId} not connected`);
    }
    return connection.client;
  }

  bifrost.commands.register(
    ENGINE_COMMANDS.finishUserTask,
    async (engineId: string, flowNodeInstanceId: string, request?: FinishUserTaskRequest) => {
      await requireClient(engineId).userTasks.finish(flowNodeInstanceId, request);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    ENGINE_COMMANDS.cancelUserTask,
    async (engineId: string, flowNodeInstanceId: string, reason?: string) => {
      await requireClient(engineId).userTasks.cancel(flowNodeInstanceId, reason == null ? undefined : { reason });
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    ENGINE_COMMANDS.confirmManualTask,
    async (engineId: string, flowNodeInstanceId: string) => {
      await requireClient(engineId).manualTasks.confirm(flowNodeInstanceId);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );
}
