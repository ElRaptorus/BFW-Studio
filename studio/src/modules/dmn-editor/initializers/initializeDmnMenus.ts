import type { Bifrost } from '#bifrost/Bifrost';

import type { Menu, MenuItem } from '@elraptorus/bfw_studio_sdk';

export function initializeDmnMenus(bifrost: Bifrost): void {
  bifrost.menus.registerMenuModifier(
    'std/application/main',
    async (mainMenu: Promise<Menu>, bifrost: Bifrost): Promise<Menu> => {
      const newMenuItems: MenuItem[] = [
        {
          type: 'divider',
        },
        {
          type: 'menu',
          label: 'DMN Editor',
          id: 'view/dmn-editor',
          submenu: [
            {
              type: 'command',
              label: 'Show Grid',
              checked: bifrost.settings.get('dmn.editor.showGrid') === true,
              id: 'view/dmn-editor/show-grid',
              command: 'dmn.editor.toggleShowGrid',
            },
            {
              type: 'command',
              label: 'Show Minimap',
              checked: bifrost.settings.get('dmn.editor.showMinimap') === true,
              id: 'view/dmn-editor/show-minimap',
              command: 'dmn.editor.toggleShowMinimap',
            },
          ],
        },
      ];

      const menu = await mainMenu;
      return bifrost.menus.insertAfterMenuItem(menu, 'view/editor-tabs', newMenuItems);
    },
  );

  bifrost.menus.registerMenu('dmn/element', async (_elementId: string): Promise<Menu> => {
    return [
      {
        type: 'command',
        label: 'Select All',
        id: 'dmn/element/select-all',
        command: 'dmn.editor.selectAllElements',
      },
      {
        type: 'command',
        label: 'Delete',
        id: 'dmn/element/delete-selected-elements',
        command: 'dmn.editor.deleteSelectedElements',
      },
      {
        type: 'divider',
        id: 'dmn/element/divider-navigation',
      },
      {
        type: 'command',
        label: 'Zoom to Element',
        id: 'dmn/element/zoom-to-element',
        command: 'dmn.editor.zoomToSelectedElement',
      },
      {
        type: 'command',
        label: 'Open in Text Editor',
        id: 'dmn/element/open-element-in-text-editor',
        command: 'dmn.editor.openElementInTextEditor',
      },
    ];
  });
}
