import type { Bifrost } from '#bifrost/Bifrost';
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
