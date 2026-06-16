import type { Bifrost } from '#bifrost/Bifrost';

import * as PluginHostConsolePaneModule from '../PluginHostConsolePaneRenderer';
import * as PluginInfoPropertyPaneModule from '../PluginInfoPropertyPane';
import * as PluginsPaneModule from '../PluginsPaneRenderer';

export function initializePanes(bifrost: Bifrost): void {
  bifrost.panes.registerPaneGroup('left', 'plugins', [
    bifrost.panes.getPaneViaPaneProvider('pane/left/plugins', 'plugins/pane-providers/PluginsPane', PluginsPaneModule),
  ]);

  bifrost.panes.prependToPaneGroup('right', 'property', [
    bifrost.panes.getPaneViaPaneProvider(
      'plugins/panes/PluginInfo',
      'plugins/pane-providers/PluginInfo',
      PluginInfoPropertyPaneModule,
    ),
  ]);

  bifrost.panes.appendToPaneGroup('bottom', 'console', [
    bifrost.panes.getPaneViaPaneProvider(
      'pane/bottom/plugin-host-console',
      'plugins/pane-providers/PluginHostConsole',
      PluginHostConsolePaneModule,
    ),
  ]);

  bifrost.menuBar.registerMenuBarItemModifier((menuBarItems) => {
    return bifrost.menuBar.insertAfterMenuBarItem(menuBarItems, 'pane/left/engines', () => [
      {
        type: 'pane_content_toggle',
        id: 'pane/left/plugins',
        tooltip: 'Plugins',
        icon: 'plugins/left-pane-icon',
        paneAreaId: 'left',
        paneId: 'pane/left/plugins',
      },
    ]);
  });

  bifrost.menus.registerMenuModifier('std/application/main', async (mainMenu) => {
    const menu = await mainMenu;
    const viewItem = menu.find((item) => item.id === 'view');
    if (viewItem != null && viewItem.type === 'menu') {
      bifrost.menus.appendToSubmenu(viewItem.submenu, 'view/debug-console', [
        {
          type: 'command',
          label: 'Plugins',
          id: 'view/debug-console/plugins',
          command: 'std.workbench.focusPluginsConsole',
        },
      ]);
    }
    return menu;
  });
}
