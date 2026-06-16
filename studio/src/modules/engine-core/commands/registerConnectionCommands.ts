import type { Bifrost } from '#bifrost/Bifrost';

import type { EngineConnectionManager } from '../EngineConnectionManager';

export default function registerConnectionCommands(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  bifrost.commands.register('engine.connect', async (url: string, displayName?: string) => {
    const connection = await connectionManager.connect({ url, displayName });
    connectionManager.setActiveEngine(connection.engineId);
    return connection;
  });

  bifrost.commands.register('engine.connectWithDialog', async () => {
    const result = await bifrost.dialog.open({
      title: 'Connect to Engine',
      content: [
        {
          type: 'text_input',
          id: 'engineUrl',
          label: 'Engine URL',
          value: 'http://localhost:4000',
          focus: true,
        },
        {
          type: 'text_input',
          id: 'displayName',
          label: 'Display Name (optional)',
          value: '',
        },
      ],
      actions: [
        { response: 'cancel', label: 'Cancel', cancel: true },
        { response: 'connect', label: 'Connect', default: true },
      ],
    });

    if (result.wasCancelled || result.response === 'cancel') {
      return;
    }

    const url = result.formData?.engineUrl?.trim();
    if (!url) {
      return;
    }

    await bifrost.commands.executeCommand('engine.connect', [url, result.formData?.displayName || undefined]);
  });

  bifrost.commands.register('engine.disconnect', (engineId: string) => {
    connectionManager.disconnect(engineId);
  });

  bifrost.commands.register('engine.removeFromHistory', (url: string) => {
    connectionManager.removeFromHistory(url);
  });
}
