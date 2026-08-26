import type { Bifrost } from '#bifrost/Bifrost';
import { StandardDialogResponse } from '#bifrost/contracts/DialogTypes';
import { ProcessInstanceAlreadyTerminalError } from '@elraptorus/daemonengine_sdk';

import type { EngineConnectionManager } from '../EngineConnectionManager';
import { ENGINE_COMMANDS } from './CommandContract';

export default function registerConfiguredAbortCommands(
  bifrost: Bifrost,
  connectionManager: EngineConnectionManager,
): void {
  bifrost.commands.register(
    ENGINE_COMMANDS.configuredAbortProcessInstance,
    async (engineId: string, processInstanceId: string): Promise<boolean> => {
      const dialogResult = await bifrost.dialog.open({
        title: 'Abort Process Instance',
        content: [
          {
            type: 'markdown',
            text: '**Caution:** This will abort the running process instance. This action cannot be undone.',
          },
        ],
        actions: [
          { label: 'Cancel', response: StandardDialogResponse.Cancel, cancel: true },
          { label: 'Abort', response: 'abort', dangerous: true, default: true },
        ],
      });

      if (dialogResult.wasCancelled || dialogResult.response !== 'abort') {
        return false;
      }

      try {
        await bifrost.commands.executeCommand(ENGINE_COMMANDS.abortProcessInstance, [engineId, processInstanceId]);
      } catch (error: unknown) {
        if (error instanceof ProcessInstanceAlreadyTerminalError) {
          bifrost.notifications.open({
            type: 'error',
            content: 'This process instance has already reached a terminal state and cannot be aborted.',
            source: 'Engine',
          });
          return false;
        }
        throw error;
      }

      return true;
    },
    { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
  );
}
