import type { Bifrost } from '#bifrost/Bifrost';

import type { RetryRequest, StartRequest } from '@elraptorus/bfw_engine_sdk';

import type { EngineConnectionManager } from '../EngineConnectionManager';

export default function registerProcessInstanceCommands(
  bifrost: Bifrost,
  connectionManager: EngineConnectionManager,
): void {
  bifrost.commands.register(
    'engine.startProcess',
    async (engineId: string, processModelId: string, options?: StartRequest) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      return connection.client.processes.start(processModelId, options);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.abortProcessInstance',
    async (engineId: string, processInstanceId: string) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      await connection.client.processInstances.abort(processInstanceId);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.retryProcessInstance',
    async (engineId: string, processInstanceId: string, options?: RetryRequest) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      await connection.client.processInstances.retry(processInstanceId, options);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.deleteProcessInstance',
    async (engineId: string, processInstanceId: string) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      await connection.client.processInstances.delete(processInstanceId);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );
}
