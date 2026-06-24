import type { Bifrost } from '#bifrost/Bifrost';
import { ProcessInstanceNotTerminalError } from '@elraptorus/daemonengine_sdk';

import { StandardDialogResponse } from '@evil/bifrost_fw_sdk';

import type { EngineConnectionManager } from '../EngineConnectionManager';
import { ENGINE_COMMANDS } from './CommandContract';

export default function registerConfiguredDeleteCommands(
  bifrost: Bifrost,
  connectionManager: EngineConnectionManager,
): void {
  bifrost.commands.register(
    ENGINE_COMMANDS.configuredDeleteProcessInstance,
    async (engineId: string, processInstanceId: string): Promise<boolean> => {
      const dialogResult = await bifrost.dialog.open({
        title: 'Delete Process Instance',
        content: [
          {
            type: 'markdown',
            text: '**Caution:** This will permanently delete the process instance and all its data. This action cannot be undone.',
          },
        ],
        actions: [
          { label: 'Cancel', response: StandardDialogResponse.Cancel, cancel: true },
          { label: 'Delete', response: 'delete', dangerous: true, default: true },
        ],
      });

      if (dialogResult.wasCancelled || dialogResult.response !== 'delete') {
        return false;
      }

      try {
        await bifrost.commands.executeCommand(ENGINE_COMMANDS.deleteProcessInstance, [engineId, processInstanceId]);
      } catch (error: unknown) {
        if (error instanceof ProcessInstanceNotTerminalError) {
          bifrost.notifications.open({
            type: 'error',
            content: 'Only terminal process instances (finished, fatal, aborted, error) can be deleted.',
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
