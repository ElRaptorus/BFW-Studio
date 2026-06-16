import type { Bifrost } from '#bifrost/Bifrost';

import type { EngineConnectionManager } from '../EngineConnectionManager';

export default function registerAuthCommands(bifrost: Bifrost, connectionManager: EngineConnectionManager): void {
  bifrost.commands.register('engine.setAuthToken', async (engineUrl: string) => {
    const currentToken = connectionManager.identity.getToken(engineUrl) ?? '';

    const result = await bifrost.dialog.open({
      title: 'Set Auth Token',
      content: [
        {
          type: 'text_input',
          id: 'authToken',
          label: 'JWT Token',
          value: currentToken,
          multiline: true,
          focus: true,
        },
      ],
      actions: [
        { response: 'cancel', label: 'Cancel', cancel: true },
        { response: 'reset', label: 'Clear Token' },
        { response: 'save', label: 'Save', default: true },
      ],
    });

    if (result.wasCancelled || result.response === 'cancel') {
      return;
    }

    if (result.response === 'reset') {
      connectionManager.setAuthToken(engineUrl, undefined);
      return;
    }

    const token = result.formData?.authToken?.trim();
    connectionManager.setAuthToken(engineUrl, token || undefined);
  });
}
