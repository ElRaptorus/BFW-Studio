import type { Bifrost } from '#bifrost/Bifrost';

import type { TriggerOptions } from '@elraptorus/bfw_engine_sdk';

import type { EngineConnectionManager } from '../EngineConnectionManager';

export default function registerEventCommands(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  bifrost.commands.register(
    'engine.triggerMessage',
    async (engineId: string, messageName: string, payload: Record<string, unknown>, options?: TriggerOptions) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      return connection.client.events.triggerMessage(messageName, payload, options);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.triggerSignal',
    async (engineId: string, signalName: string) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      return connection.client.events.triggerSignal(signalName);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.triggerEscalation',
    async (engineId: string, escalationCode: string) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      return connection.client.events.triggerEscalation(escalationCode);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );

  bifrost.commands.register(
    'engine.triggerTimerEvent',
    async (engineId: string, flowNodeInstanceId: string) => {
      const connection = connectionManager.getConnection(engineId);
      if (!connection) {
        throw new Error(`Engine ${engineId} not connected`);
      }

      return connection.client.events.triggerTimer(flowNodeInstanceId);
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );
}
