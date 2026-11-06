import type { MenuBarItem, MenuBarItemMap } from '#bifrost/contracts/MenuBarTypes';
import type { EngineConnection, EngineConnectionState } from '#modules/engine-core';

/** The Engine cluster is only meaningful on pages that talk to an engine. */
export const ENGINE_HEADER_PAGES: string[] = ['design/*', 'deploy/*', 'debug/*'];

/** The Deploy page has its own Deploy button; the header button only deploys the focused file. */
export const ENGINE_HEADER_DEPLOY_PAGES: string[] = ['design/*', 'debug/*'];

const STATE_LABELS: Record<EngineConnectionState, string> = {
  connected: 'Connected',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  error: 'Connection error',
  disconnected: 'Offline',
};

const STATE_ICONS: Record<EngineConnectionState, string> = {
  connected: 'ph-fill ph-circle',
  connecting: 'ph-bold ph-circle-notch ph-spin',
  reconnecting: 'ph-bold ph-circle-notch ph-spin',
  error: 'ph-fill ph-warning-circle',
  disconnected: 'ph ph-circle',
};

export type EngineHeaderState = {
  readonly activeEngineId: string | null;
  /** Connection state of the active engine; `disconnected` when there is none. */
  readonly state: EngineConnectionState;
  readonly engines: readonly Pick<EngineConnection, 'engineId' | 'url' | 'displayName' | 'state'>[];
  readonly deployEnabled: boolean;
  readonly isViewingModelViewer: boolean;
};

/**
 * Builds the Engine cluster, shown in the centered section of the page bar: engine select with a status icon per engine (or "No engine"),
 * connection menu, open dashboard, deploy and play.
 */
export function buildEngineHeaderItems(headerState: EngineHeaderState): MenuBarItem[] {
  const { activeEngineId, state, engines, deployEnabled, isViewingModelViewer } = headerState;
  const activeEngine = engines.find((engine) => engine.engineId === activeEngineId);

  const playTooltip = isViewingModelViewer
    ? 'Start Current Process in Debugger\n[Shift+Click] Configured Start'
    : 'Quick Deploy & Start in Debugger (F5)\n[Shift+Click] Configured Start';

  const engineSelectItem: MenuBarItem =
    engines.length > 0
      ? {
          type: 'select',
          id: 'engine-header/engine-select',
          command: 'engine.menubar.setActiveEngine',
          value: activeEngineId ?? '',
          entries: engines.map((engine) => ({
            label: engine.displayName ?? engine.url,
            value: engine.engineId,
            icon: `${STATE_ICONS[engine.state]} engine-header-status engine-header-status--${engine.state}`,
            iconLabel: STATE_LABELS[engine.state],
          })),
          tooltip: activeEngine == null ? 'Select an engine' : `${STATE_LABELS[state]} · ${activeEngine.url}`,
        }
      : {
          type: 'text',
          id: 'engine-header/engine-name',
          label: 'No engine',
          tooltip: 'Connect an engine to get started',
        };

  const items: MenuBarItem[] = [
    engineSelectItem,
    {
      type: 'menu',
      id: 'engine-header/connection',
      icon: 'ph-bold ph-caret-down',
      menu: 'engine/header/connection',
      tooltip: 'Connection',
    },
    {
      type: 'button',
      id: 'engine-header/open-engine',
      icon: 'ph-duotone ph-gauge',
      tooltip: 'Open Engine Dashboard',
      command: 'engine.workspace.openDashboard',
      commandArgs: activeEngineId ? [activeEngineId] : [],
      visible: state === 'connected',
    },
    {
      type: 'button',
      id: 'engine-header/deploy',
      icon: 'ph ph-paper-plane-tilt',
      tooltip: 'Deploy Current Process (F3)\n[Shift+Click] Deploy & Open',
      visible: deployEnabled,
      command: 'engine.menubar.deployButton',
    },
    {
      type: 'button',
      id: 'engine-header/play',
      icon: 'ph-fill ph-play',
      tooltip: playTooltip,
      command: 'engine.menubar.playButton',
    },
  ];

  return items.map((item) => ({
    ...item,
    pages: item.id === 'engine-header/deploy' ? ENGINE_HEADER_DEPLOY_PAGES : ENGINE_HEADER_PAGES,
  }));
}

/** The Engine cluster lives in the page bar's center section; the other areas stay untouched. */
export function addEngineHeaderItems(menuBarItems: MenuBarItemMap, engineHeaderItems: MenuBarItem[]): MenuBarItemMap {
  return { ...menuBarItems, pageBarCenter: [...menuBarItems.pageBarCenter, ...engineHeaderItems] };
}
