import type { MenuBarItem } from '#bifrost/contracts/MenuBarTypes';
import type { PaneAreaName, PaneAreasViewData } from '#bifrost/contracts/PaneTypes';

type LayoutToggleDefinition = {
  readonly area: PaneAreaName;
  readonly command: string;
  readonly icon: string;
  readonly label: string;
  /** Extra CSS class on the icon, used to mirror the sidebar icon for the right area. */
  readonly iconClassName?: string;
};

const LAYOUT_TOGGLES: readonly LayoutToggleDefinition[] = [
  { area: 'left', command: 'std.workbench.toggleSidebar', icon: 'ph-sidebar-simple', label: 'Sidebar' },
  {
    area: 'bottom',
    command: 'std.workbench.toggleInspectorPanel',
    icon: 'ph-square-half-bottom',
    label: 'Bottom Panel',
  },
  {
    area: 'right',
    command: 'std.workbench.togglePropertyPanel',
    icon: 'ph-sidebar-simple',
    label: 'Property Panel',
    iconClassName: 'header-layout-toggle-icon--mirrored',
  },
];

/**
 * Builds one button per pane area that has groups on the active page. The icon is filled when the area is
 * visible. Pages without pane areas (`paneAreas: []`) get no toggles.
 */
export function buildLayoutToggleItems(paneAreas: PaneAreasViewData): MenuBarItem[] {
  return LAYOUT_TOGGLES.filter((toggle) => paneAreas[toggle.area].paneGroups.length > 0).map((toggle) => {
    const visible = paneAreas[toggle.area].visible;
    const iconClassNames = [visible ? 'ph-fill' : 'ph', toggle.icon];
    if (toggle.iconClassName != null) {
      iconClassNames.push(toggle.iconClassName);
    }
    return {
      type: 'button',
      id: `header-layout-toggle-${toggle.area}`,
      command: toggle.command,
      icon: iconClassNames.join(' '),
      tooltip: `${visible ? 'Hide' : 'Show'} ${toggle.label}`,
    };
  });
}
