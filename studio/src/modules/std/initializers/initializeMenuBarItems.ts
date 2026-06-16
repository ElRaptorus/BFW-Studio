import type { Bifrost } from '#bifrost/Bifrost';
import type { MenuBarItem, MenuBarItemMap } from '#bifrost/contracts/MenuBarTypes';

export function initializeMenuBarItems(bifrost: Bifrost): void {
  bifrost.menuBar.registerMenuBarItem('left', () => {
    const items: MenuBarItem[] = [
      {
        type: 'pane_content_toggle',
        id: 'pane/left/explorer',
        tooltip: 'Explorer',
        icon: 'std/left-pane-item/files',
        paneAreaId: 'left',
        paneId: 'pane/left/explorer',
      },
      {
        type: 'pane_content_toggle',
        id: 'pane/left/search',
        tooltip: 'Search',
        icon: 'std/left-pane-item/search',
        paneAreaId: 'left',
        paneId: 'pane/left/search',
      },
      { type: 'divider' },
      {
        type: 'menu',
        id: 'left-overflow',
        icon: 'ph-bold ph-caret-down',
        menu: 'std/menubar/left-overflow',
        tooltip: 'More...',
      },
    ];

    return items;
  });

  bifrost.menuBar.registerMenuBarItemModifier((menuBarItems: MenuBarItemMap) => {
    return bifrost.menuBar.insertBeforeMenuBarItem(menuBarItems, 'pane/left/explorer', () => {
      if (!bifrost.env.isWeb) {
        return [];
      }

      return [
        {
          type: 'menu',
          icon: 'std/menubar/hamburger',
          menu: 'std/application/main',
        },
        {
          type: 'divider',
        },
      ];
    });
  });

  bifrost.menuBar.registerMenuBarItem('center', () => {
    return [];
  });

  bifrost.menuBar.registerMenuBarItem('right', () => {
    return [
      {
        type: 'menu',
        id: 'menu-bar-menu-layout',
        icon: 'ph ph-split-vertical',
        menu: 'menu-bar/layout',
        menuArgs: [],
        tooltip: 'Layout',
      },
    ];
  });
}
