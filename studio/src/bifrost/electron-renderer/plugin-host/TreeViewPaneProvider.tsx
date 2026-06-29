import React, { useCallback, useEffect, useState } from 'react';

import type { PaneComponentProps, PaneProvider, PaneProviderModule, TreeBadge, TreeItem } from '@evil/bifrost_fw_sdk';
import { Icon, Pane, PaneHeader, Tree } from '@evil/bifrost_fw_sdk';

interface PluginTreeItem {
  id: string;
  type: 'directory' | 'file' | 'section' | 'property';
  label: string;
  sublabel?: string;
  icon?: string;
  expanded?: boolean;
  children?: PluginTreeItem[];
  command?: string;
  badges?: (
    { type: 'character'; character: string } | { type: 'icon'; icon: string } | { type: 'number'; number: number }
  )[];
  contextMenuId?: string;
  metadata?: unknown;
}

export interface TreeViewPaneProviderContext {
  pluginName: string;
  paneId: string;
  title: string;
  getTreeData: () => PluginTreeItem[];
  onTreeDataChanged: (listener: () => void) => () => void;
  onItemClick: (command: string | undefined, metadata: unknown) => void;
  getVisibility?: () => boolean | undefined;
}

function mapBadge(badge: PluginTreeItem['badges'] extends (infer B)[] | undefined ? B : never): TreeBadge {
  switch (badge.type) {
    case 'character':
      return { type: 'character', character: badge.character };
    case 'icon':
      return { type: 'icon', icon: badge.icon };
    case 'number':
      return { type: 'number', number: badge.number };
  }
}

function mapPluginTreeItems(items: PluginTreeItem[]): TreeItem[] {
  return items.map((item): TreeItem => {
    const children = item.children != null ? mapPluginTreeItems(item.children) : undefined;

    const base = {
      pathId: item.id,
      label: item.label,
      sublabel: item.sublabel,
      labelIcon: item.icon,
      expanded: item.expanded,
      entries: children,
      metadata: { pluginItemId: item.id, command: item.command, userMetadata: item.metadata },
      menuId: item.contextMenuId,
      badges: item.badges?.map(mapBadge),
    };

    if (item.type === 'property') {
      return { ...base, type: 'property' as const, subtype: 'string' as const, value: item.sublabel ?? '' };
    }

    return { ...base, type: item.type as 'directory' | 'file' | 'section' };
  });
}

export function createTreeViewPaneProvider(context: TreeViewPaneProviderContext): PaneProviderModule {
  const viewMediatorId = `plugin-tree/${context.paneId}`;

  function TreeViewPaneContent(props: PaneComponentProps): React.JSX.Element {
    const [entries, setEntries] = useState<TreeItem[]>(() => mapPluginTreeItems(context.getTreeData()));

    useEffect(() => {
      return context.onTreeDataChanged(() => {
        setEntries(mapPluginTreeItems(context.getTreeData()));
      });
    }, []);

    const handleClick = useCallback(
      (itemMetadata: { pluginItemId: string; command?: string; userMetadata: unknown }) => {
        context.onItemClick(itemMetadata.command, itemMetadata.userMetadata);
      },
      [],
    );

    return (
      <div className="pane__content pane__content--treeview pane__content--scroll-vertically">
        <Tree
          studio={props.studio}
          viewMediatorId={viewMediatorId}
          entries={entries}
          onClick={handleClick}
          iconComponent={Icon}
        />
      </div>
    );
  }

  function TreeViewPane(props: PaneComponentProps): React.JSX.Element {
    return (
      <Pane classNames="app-layout__full-height-pane">
        <PaneHeader studio={props.studio} title={context.title} paneId={props.paneId} collapsed={props.collapsed} />
        {props.collapsed !== true && <TreeViewPaneContent {...props} />}
      </Pane>
    );
  }

  const paneProvider: PaneProvider = {
    getPaneTitle: () => context.title,
    shouldBeDisplayed: () => context.getVisibility?.() ?? true,
    Pane: TreeViewPane,
    PaneContent: TreeViewPaneContent,
  };

  return { paneProvider };
}
