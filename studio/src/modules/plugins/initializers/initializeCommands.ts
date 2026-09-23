import type { Bifrost } from '#bifrost/Bifrost';
import { IPC_INVOKE_INSTALL_PLUGIN } from '#bifrost/contracts/IpcEvents';
import * as fs from 'fs/promises';

export function initializeCommands(bifrost: Bifrost): void {
  bifrost.commands.register('plugins.focusPluginsPane', () => {
    bifrost.panes.setVisibilityOfPaneAreaByPaneId('pane/left/plugins', true);
  });

  bifrost.commands.register('plugins.refreshPluginList', async () => {
    await bifrost.plugins.refreshFromHost();
  });

  bifrost.commands.register('plugins.showConsole', () => {
    bifrost.panes.setActiveGroupInArea('bottom', 'console');
    bifrost.panes.showPaneArea('bottom');
  });

  bifrost.commands.register(
    'plugins.installPlugin',
    async () => {
      const dialogResult = await bifrost.dialog.open({
        title: 'Install Plugin',
        content: [
          {
            type: 'response_link',
            label: 'Link a development folder',
            sublabel: 'The Studio uses that folder in place. Uninstall removes the link.',
            icon: 'ph ph-link',
            response: 'link',
          },
          {
            type: 'response_link',
            label: 'Copy a plugin folder',
            sublabel: 'A copy is placed in the plugins folder. Uninstall moves that copy to the trash.',
            icon: 'ph ph-copy',
            response: 'copy',
          },
        ],
        actions: [{ label: 'Cancel', response: 'cancel', cancel: true }],
      });

      if (dialogResult.wasCancelled || (dialogResult.response !== 'link' && dialogResult.response !== 'copy')) {
        return;
      }
      const mode = dialogResult.response;

      const selectedPaths = await bifrost.dialog.showOpenDirectory();
      const sourcePath = selectedPaths?.[0];
      if (sourcePath == null || sourcePath === '') {
        return;
      }

      try {
        const { ipcRenderer } = await import('electron');
        const installed = (await ipcRenderer.invoke(IPC_INVOKE_INSTALL_PLUGIN, { sourcePath, mode })) as {
          packageName: string;
        };
        await bifrost.plugins.refreshFromHost();
        bifrost.notifications.open({
          type: 'info',
          content: `Installed '${installed.packageName}'.`,
          source: 'Plugins',
        });
      } catch (error) {
        bifrost.notifications.open({
          type: 'error',
          content: error instanceof Error ? error.message : String(error),
          source: 'Plugins',
        });
      }
    },
    {
      visibleInSearch: true,
      description: 'Plugins: Install Plugin',
      enabledWhen: () => bifrost.env.isElectron && bifrost.plugins.getPluginsDirectory() !== '',
    },
  );

  bifrost.commands.register(
    'plugins.openPluginFolder',
    async () => {
      const dir = bifrost.plugins.getPluginsDirectory();
      if (dir === '') {
        return;
      }

      await fs.mkdir(dir, { recursive: true });
      const uri = bifrost.files.getUriForFilename(dir);
      bifrost.commands.executeCommand('std.shell.showDocumentInFileManager', [uri]);
    },
    { enabledWhen: () => bifrost.env.isElectron && bifrost.plugins.getPluginsDirectory() !== '' },
  );

  bifrost.commands.register(
    'std.workbench.focusPluginsConsole',
    () => {
      bifrost.panes.setVisibilityOfPaneAreaByPaneId('pane/bottom/plugin-host-console', true);
    },
    { visibleInSearch: true },
  );
}
