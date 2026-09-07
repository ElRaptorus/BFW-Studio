import type { Bifrost } from '#bifrost/Bifrost';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import type { TreeBadge, TreeItem } from '#bifrost/contracts/TreeTypes';
import { Icon } from '#components/Icon';
import { Tree } from '#components/Tree/Tree';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import { PaneHeaderIcon } from '#components/panes/PaneHeaderIcon';
import type { EngineConnection, EngineConnectionManager } from '#modules/engine-core';
import { ENGINE_COMMANDS } from '#modules/engine-core';

import React, { useEffect, useState } from 'react';

import { TASK_INBOX_PENDING_COUNTS_KEY } from '../constants/sharedResourceKeys';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  shouldBeDisplayed: shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Engines';
}

function shouldBeDisplayed(): boolean {
  return true;
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed}>
        {props.collapsed !== true && (
          <PaneHeaderIcon
            studio={props.studio}
            icon="ph ph-plus"
            command={ENGINE_COMMANDS.connectWithDialog}
            tooltip="Connect Engine"
          />
        )}
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost: Bifrost = props.studio;
  const connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');

  const computeRecentUrls = React.useCallback((): string[] => {
    const connectedUrls = new Set(connectionManager.getAllEngines().map((engine) => engine.url));
    return connectionManager.getUrlHistory().filter((url) => !connectedUrls.has(url));
  }, [connectionManager]);

  const [engines, setEngines] = useState<EngineConnection[]>(() => connectionManager.getAllEngines());
  const [recentUrls, setRecentUrls] = useState<string[]>(() => computeRecentUrls());
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const refreshAll = (): void => {
      setEngines(connectionManager.getAllEngines());
      setRecentUrls(computeRecentUrls());
    };
    const listSubscription = connectionManager.on('engine:list-changed', refreshAll);
    const stateSubscription = connectionManager.on('engine:state-changed', refreshAll);
    const disconnectSubscription = connectionManager.on('engine:disconnected', refreshAll);
    return () => {
      listSubscription.dispose();
      stateSubscription.dispose();
      disconnectSubscription.dispose();
    };
  }, [connectionManager, computeRecentUrls]);

  useEffect(() => {
    const refreshCounts = (): void => {
      try {
        setPendingCounts(bifrost.getSharedRessource<Record<string, number>>(TASK_INBOX_PENDING_COUNTS_KEY) ?? {});
      } catch (sharedResourceError) {
        console.warn('[EngineSidebar] Failed to read pending counts:', sharedResourceError);
        setPendingCounts({});
      }
    };
    refreshCounts();
    const intervalId = setInterval(refreshCounts, 5_000);
    return () => clearInterval(intervalId);
  }, [bifrost]);

  const treeItems: TreeItem[] = [];

  if (engines.length > 0) {
    for (const engine of engines) {
      treeItems.push(buildEngineTreeItem(engine, pendingCounts[engine.engineId] ?? 0));
    }
  }

  if (recentUrls.length > 0) {
    treeItems.push({
      type: 'section',
      label: 'Recent',
      pathId: 'section:recent',
      expanded: true,
      entries: recentUrls.map((url) => buildRecentEngineTreeItem(url, connectionManager)),
    });
  }

  if (treeItems.length === 0) {
    treeItems.push({
      type: 'file',
      label: 'No engines connected',
      pathId: 'empty-placeholder',
      styles: { labelColor: 'var(--theme-fg-muted)' },
    });
  }

  const handleClick = (metadata: EngineTreeMetadata, event?: MouseEvent) => {
    if (!metadata?.action) {
      return;
    }

    if (metadata.action === 'connect') {
      bifrost.commands.executeCommand(ENGINE_COMMANDS.connect, [metadata.engineUrl]);
      return;
    }

    const resolved = resolvePageUri(metadata.action as EnginePageAction, metadata.engineId);
    if (!resolved) {
      return;
    }

    if (event?.shiftKey) {
      bifrost.commands.executeCommand('std.editor.openDocumentToTheSide', [resolved.uri, resolved.title]);
    } else {
      bifrost.commands.executeCommand(resolved.command, [metadata.engineId]);
    }
  };

  return (
    <div className="engine-sidebar-pane">
      <Tree
        studio={bifrost}
        viewMediatorId="engine-workspace/sidebar-tree"
        entries={treeItems}
        onClick={handleClick}
        iconComponent={Icon}
      />
    </div>
  );
}

type EnginePageAction =
  'open-dashboard' | 'open-processes' | 'open-decisions' | 'open-task-inbox' | 'open-instances' | 'open-timers';

type EngineTreeAction = 'connect' | EnginePageAction;

interface EngineTreeMetadata {
  action?: EngineTreeAction;
  engineId: string;
  engineUrl: string;
}

const PAGE_ACTION_MAP: Record<
  EnginePageAction,
  { command: string; uriFactory: (id: string) => string; title: string }
> = {
  'open-dashboard': {
    command: 'engine.workspace.openDashboard',
    uriFactory: (id) => `engine://dashboard/${id}`,
    title: 'Dashboard',
  },
  'open-processes': {
    command: 'engine.workspace.openProcessExplorer',
    uriFactory: (id) => `engine://processes/${id}`,
    title: 'Deployed BPMNs',
  },
  'open-decisions': {
    command: 'engine.workspace.openDecisionCatalog',
    uriFactory: (id) => `engine://decisions/${id}`,
    title: 'Deployed DMNs',
  },
  'open-task-inbox': {
    command: 'engine.workspace.openTaskInbox',
    uriFactory: (id) => `engine-task-inbox://${id}`,
    title: 'Task Inbox',
  },
  'open-instances': {
    command: 'engine.workspace.openInstanceSearch',
    uriFactory: (id) => `engine://instances/${id}`,
    title: 'Process Instances',
  },
  'open-timers': {
    command: 'engine.workspace.openTimerSchedules',
    uriFactory: (id) => `engine://timers/${id}`,
    title: 'Timer Schedules',
  },
};

function resolvePageUri(
  action: EnginePageAction,
  engineId: string,
): { uri: string; title: string; command: string } | null {
  const entry = PAGE_ACTION_MAP[action];
  if (!entry) {
    return null;
  }
  return { uri: entry.uriFactory(engineId), title: entry.title, command: entry.command };
}

function buildEngineTreeItem(engine: EngineConnection, pendingTaskCount: number): TreeItem {
  const isOnline = engine.state === 'connected';
  const engineIcon = isOnline ? 'ph-duotone ph-plugs-connected' : 'ph-duotone ph-engine';
  const statusBadge = resolveEngineStatusBadge(engine.state);

  const engineMeta: EngineTreeMetadata = { engineId: engine.engineId, engineUrl: engine.url };

  if (!isOnline) {
    return {
      type: 'directory',
      label: engine.displayName,
      sublabel: engine.url,
      pathId: `engine/${engine.engineId}`,
      labelIcon: engineIcon,
      expanded: false,
      styles: { labelColor: resolveEngineStateColor(engine.state) },
      badges: statusBadge ? [statusBadge] : [],
      menuId: 'engine-workspace/sidebar/engine',
      metadata: engineMeta,
      entries: [],
    };
  }

  const taskInboxBadges: TreeBadge[] = [];
  if (pendingTaskCount > 0) {
    taskInboxBadges.push({ type: 'character', character: String(pendingTaskCount) });
  }

  const pageMenuId = 'engine-workspace/sidebar/page';

  return {
    type: 'directory',
    label: engine.displayName,
    sublabel: engine.url,
    pathId: `engine/${engine.engineId}`,
    labelIcon: engineIcon,
    expanded: true,
    styles: { labelColor: resolveEngineStateColor(engine.state) },
    badges: statusBadge ? [statusBadge] : [],
    menuId: 'engine-workspace/sidebar/engine',
    metadata: engineMeta,
    entries: [
      {
        type: 'file',
        label: 'Dashboard',
        pathId: `engine/${engine.engineId}/dashboard`,
        labelIcon: 'ph ph-gauge',
        menuId: pageMenuId,
        metadata: { action: 'open-dashboard', ...engineMeta } satisfies EngineTreeMetadata,
      },
      {
        type: 'file',
        label: 'Processes',
        pathId: `engine/${engine.engineId}/processes`,
        labelIcon: 'ph ph-tree-structure',
        menuId: pageMenuId,
        metadata: { action: 'open-processes', ...engineMeta } satisfies EngineTreeMetadata,
      },
      {
        type: 'file',
        label: 'Decisions',
        pathId: `engine/${engine.engineId}/decisions`,
        labelIcon: 'ph ph-scales',
        menuId: pageMenuId,
        metadata: { action: 'open-decisions', ...engineMeta } satisfies EngineTreeMetadata,
      },
      {
        type: 'file',
        label: 'Task Inbox',
        pathId: `engine/${engine.engineId}/task-inbox`,
        labelIcon: 'ph ph-tray',
        badges: taskInboxBadges,
        menuId: pageMenuId,
        metadata: { action: 'open-task-inbox', ...engineMeta } satisfies EngineTreeMetadata,
      },
      {
        type: 'file',
        label: 'Instances',
        pathId: `engine/${engine.engineId}/instances`,
        labelIcon: 'ph ph-magnifying-glass',
        menuId: pageMenuId,
        metadata: { action: 'open-instances', ...engineMeta } satisfies EngineTreeMetadata,
      },
      {
        type: 'file',
        label: 'Timers',
        pathId: `engine/${engine.engineId}/timers`,
        labelIcon: 'ph ph-timer',
        menuId: pageMenuId,
        metadata: { action: 'open-timers', ...engineMeta } satisfies EngineTreeMetadata,
      },
    ],
  };
}

function buildRecentEngineTreeItem(url: string, connectionManager: EngineConnectionManager): TreeItem {
  const cachedInfo = connectionManager.getCachedInfo(url);
  const displayName = cachedInfo?.engineName ?? url;

  return {
    type: 'file',
    label: displayName,
    sublabel: displayName !== url ? url : undefined,
    pathId: `recent/${url}`,
    labelIcon: 'ph-duotone ph-engine',
    menuId: 'engine-workspace/sidebar/recent',
    styles: { labelColor: 'var(--theme-fg-muted)' },
    metadata: { action: 'connect', engineId: '', engineUrl: url } satisfies EngineTreeMetadata,
  };
}

function resolveEngineStatusBadge(state: string): TreeBadge | null {
  if (state === 'connected') {
    return null;
  }
  if (state === 'error') {
    return { type: 'icon', icon: 'ph ph-warning-circle' };
  }
  if (state === 'reconnecting') {
    return { type: 'character', character: 'OFF' };
  }
  return { type: 'character', character: state.charAt(0).toUpperCase() };
}

function resolveEngineStateColor(state: string): string {
  if (state === 'connected') {
    return 'var(--theme-icon-green)';
  }
  if (state === 'error' || state === 'reconnecting') {
    return 'var(--theme-icon-red)';
  }
  return 'var(--theme-fg-muted)';
}
