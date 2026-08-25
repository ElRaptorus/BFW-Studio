import type { MenuBarItem } from '#bifrost/contracts/MenuBarTypes';

export function menuBarItemKey(item: MenuBarItem): string {
  if (item.id != null && item.id !== '') {
    return item.id;
  }

  switch (item.type) {
    case 'button':
      return `button:${item.command}:${item.icon}:${item.tooltip}`;
    case 'icon':
      return `icon:${item.icon}:${item.tooltip}`;
    case 'menu':
      return `menu:${item.icon}:${item.menu}:${item.tooltip ?? ''}`;
    case 'select':
      return `select:${item.command}:${item.tooltip ?? ''}`;
    case 'text':
      return `text:${item.label}:${item.tooltip ?? ''}`;
    case 'pane_content_toggle':
      return `toggle:${item.paneId}:${item.icon}`;
    case 'divider':
      return 'divider:plain';
    default:
      return 'unknown';
  }
}
