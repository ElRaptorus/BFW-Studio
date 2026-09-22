import type { Bifrost } from '#bifrost/Bifrost';
import type { MenuBarItem, MenuBarItemMap, MenuBarItem_Button } from '#bifrost/contracts/MenuBarTypes';

function createPaneAreaToggleButton(options: {
  id: string;
  command: string;
  areaVisible: boolean;
  hideDirection: 'left' | 'right';
  hideTooltip: string;
  showTooltip: string;
}): MenuBarItem_Button {
  const hideIcon = options.hideDirection === 'right' ? 'ph ph-caret-double-right' : 'ph ph-caret-double-left';
  const showIcon = options.hideDirection === 'right' ? 'ph ph-caret-double-left' : 'ph ph-caret-double-right';

  return {
    type: 'button',
    id: options.id,
    command: options.command,
    icon: options.areaVisible ? hideIcon : showIcon,
    tooltip: options.areaVisible ? options.hideTooltip : options.showTooltip,
  };
}

export function initializeMenuBarItems(bifrost: Bifrost): void {
  bifrost.menuBar.registerMenuBarItem('left', () => {
    const items: MenuBarItem[] = [
      createPaneAreaToggleButton({
        id: 'menu-bar-toggle-sidebar',
        command: 'std.workbench.toggleSidebar',
        areaVisible: bifrost.panes.getPaneAreaVisibility('left'),
        hideDirection: 'left',
        hideTooltip: 'Hide Sidebar',
        showTooltip: 'Show Sidebar',
      }),
      { type: 'divider', visible: bifrost.panes.getPaneAreaVisibility('left') },
      {
        type: 'pane_content_toggle',
        id: 'pane/left/explorer',
        tooltip: 'Explorer',
        icon: 'std/left-pane-item/files',
        visible: bifrost.panes.getPaneAreaVisibility('left'),
        paneAreaId: 'left',
        paneId: 'pane/left/explorer',
      },
      {
        type: 'pane_content_toggle',
        id: 'pane/left/search',
        tooltip: 'Search',
        icon: 'std/left-pane-item/search',
        visible: bifrost.panes.getPaneAreaVisibility('left'),
        paneAreaId: 'left',
        paneId: 'pane/left/search',
      },
      { type: 'divider', visible: bifrost.panes.getPaneAreaVisibility('left') },
      {
        type: 'menu',
        id: 'left-overflow',
        icon: 'ph-bold ph-caret-down',
        visible: bifrost.panes.getPaneAreaVisibility('left'),
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
      createPaneAreaToggleButton({
        id: 'menu-bar-menu-layout',
        command: 'std.workbench.togglePropertyPanel',
        areaVisible: bifrost.panes.getPaneAreaVisibility('right'),
        hideDirection: 'right',
        hideTooltip: 'Hide Property Panel',
        showTooltip: 'Show Property Panel',
      }),
    ];
  });
}
