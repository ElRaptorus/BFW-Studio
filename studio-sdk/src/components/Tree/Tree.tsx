import {
  expandAllFeature,
  hotkeysCoreFeature,
  propMemoizationFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from '@headless-tree/core';
import { useTree } from '@headless-tree/react';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Studio } from '../../../types/Studio';
import { TreeViewMediator } from '../../browser/internal/TreeViewMediator';
import type { IconComponent } from '../../contracts/IconTypes';
import type {
  TreeDecorationSource,
  TreeItem,
  TreeItemClickCallbackFn,
  TreeItemDropCallbackFn,
} from '../../contracts/TreeTypes';
import { showContextMenu } from '../ContextMenuFunctions';
import { DecorationContext } from './DecorationContext';
import type { ExternalFileDropCallbackFn } from './HeadlessTreeItem';
import { HeadlessTreeItem } from './HeadlessTreeItem';
import type { TreeItemData } from './TreeDataAdapter';
import { TreeDataAdapter } from './TreeDataAdapter';
import type { StudioTreeCallbacks } from './studioTreePlugin';
import { studioTreePlugin } from './studioTreePlugin';

export type TreeProps = {
  studio: Studio;
  className?: string;
  entries: TreeItem[];
  iconComponent: IconComponent;
  onClick: TreeItemClickCallbackFn;
  onDoubleClick?: TreeItemClickCallbackFn;
  onActionIconClick?: (...args: any[]) => any;
  onDragAndDropItem?: TreeItemDropCallbackFn;
  onExternalFileDrop?: ExternalFileDropCallbackFn;
  viewMediatorId: string;
  multiSelectionMenuId?: string;
  decorationSource?: TreeDecorationSource;
};

function areHeadlessTreePropsEqual(prev: TreeProps, next: TreeProps): boolean {
  return (
    prev.studio === next.studio &&
    prev.entries === next.entries &&
    prev.iconComponent === next.iconComponent &&
    prev.viewMediatorId === next.viewMediatorId &&
    prev.className === next.className &&
    prev.multiSelectionMenuId === next.multiSelectionMenuId &&
    prev.onDragAndDropItem === next.onDragAndDropItem &&
    prev.onExternalFileDrop === next.onExternalFileDrop &&
    prev.decorationSource === next.decorationSource
  );
}

export const Tree = React.memo(function Tree(props: TreeProps): React.JSX.Element {
  const { studio, viewMediatorId, entries, iconComponent } = props;

  const onClickRef = useRef(props.onClick);
  const onDoubleClickRef = useRef(props.onDoubleClick);
  const onActionIconClickRef = useRef(props.onActionIconClick);

  useEffect(() => {
    onClickRef.current = props.onClick;
    onDoubleClickRef.current = props.onDoubleClick;
    onActionIconClickRef.current = props.onActionIconClick;
  });

  const dataAdapter = useMemo(() => new TreeDataAdapter(entries), [entries]);

  const [expandedItems, setExpandedItemsRaw] = useState<string[]>(() => dataAdapter.getInitialExpandedIds());
  const [selectedItems, setSelectedItemsRaw] = useState<string[]>(() => dataAdapter.getInitialSelectedIds());

  const [prevDataAdapter, setPrevDataAdapter] = useState(dataAdapter);
  const [dataAdapterChanged, setDataAdapterChanged] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  if (prevDataAdapter !== dataAdapter) {
    setPrevDataAdapter(dataAdapter);
    setDataAdapterChanged(true);
    setDataVersion((prev) => prev + 1);
    const allIds = new Set(dataAdapter.getAllIds());
    const newExpanded = dataAdapter.getInitialExpandedIds();

    setExpandedItemsRaw((prev) => {
      const preserved = prev.filter((id) => allIds.has(id));
      const newlyExpanded = newExpanded.filter((id) => !prev.includes(id));
      return [...new Set([...preserved, ...newlyExpanded])];
    });
    setSelectedItemsRaw((prev) => prev.filter((id) => allIds.has(id)));
  }

  const [mediator] = useState<TreeViewMediator>(() => {
    const existing = studio.views.isRegistered(viewMediatorId);
    if (existing) {
      return studio.views.getById<TreeViewMediator>(viewMediatorId);
    }
    const med = new TreeViewMediator(studio);
    studio.views.getOrRegisterById(viewMediatorId, () => med);
    return med;
  });

  const studioCallbacks: StudioTreeCallbacks = useMemo(
    () => ({
      onClickItem: (metadata: any, event?: MouseEvent) => onClickRef.current(metadata, event),
      onDoubleClickItem: (metadata: any, event?: MouseEvent) => onDoubleClickRef.current?.(metadata, event),
    }),
    [],
  );

  const stableOnActionIconClick = useCallback(
    (data: any, event: any) => onActionIconClickRef.current?.(data, event),
    [],
  );

  const tree = useTree<TreeItemData>({
    rootItemId: dataAdapter.rootItemId,
    getItemName: (item) => item.getItemData()?.label ?? '',
    isItemFolder: (item) => {
      const data = item.getItemData();
      return data != null && Array.isArray(data.entries);
    },
    dataLoader: dataAdapter.getDataLoader(),
    indent: 16,
    state: {
      expandedItems,
      selectedItems,
    },
    setExpandedItems: setExpandedItemsRaw,
    setSelectedItems: setSelectedItemsRaw,
    studioCallbacks,
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      expandAllFeature,
      propMemoizationFeature,
      studioTreePlugin,
    ],
  });

  if (dataAdapterChanged) {
    setDataAdapterChanged(false);
    tree.rebuildTree();
  }

  useEffect(() => {
    mediator.setTreeInstance(tree);
    mediator.setDataAdapter(dataAdapter);
  });

  useEffect(() => {
    mediator.notifyEntriesChanged();
  }, [expandedItems, selectedItems, mediator]);

  const handleContextMenu = useCallback(
    (itemData: TreeItemData, event: MouseEvent) => {
      if (itemData.menuId == null) {
        return;
      }

      const selectedMeta = mediator.getSelectedMetadata();
      const isItemSelected = selectedMeta.some(
        (meta: any) => meta === itemData.metadata || meta?.uri === itemData.metadata?.uri,
      );

      if (!isItemSelected) {
        tree.setSelectedItems([itemData.htId]);
        const itemInstance = tree.getItemInstance(itemData.htId);
        itemInstance?.setFocused();
      }

      if (props.multiSelectionMenuId && selectedMeta.length > 1) {
        showContextMenu(event, props.multiSelectionMenuId, [selectedMeta, itemData.metadata, studio]);
      } else {
        showContextMenu(event, itemData.menuId, [itemData.metadata, studio]);
      }
    },
    [mediator, tree, studio, props.multiSelectionMenuId],
  );

  const containerProps = tree.getContainerProps(viewMediatorId);
  const items = tree.getItems();

  const outerClassName = ['kbm-treeview', mediator.domClassName, 'treeview', props.className || '']
    .filter(Boolean)
    .join(' ');

  return (
    <DecorationContext.Provider value={props.decorationSource ?? null}>
      <div
        {...containerProps}
        className={outerClassName}
        data-view-mediator-id={viewMediatorId}
        data-test--tree={viewMediatorId}
        tabIndex={0}
      >
        {items.map((item) => (
          <HeadlessTreeItem
            key={item.getKey()}
            item={item}
            dataVersion={dataVersion}
            isExpanded={item.isExpanded()}
            isSelected={item.isSelected()}
            selectedCount={selectedItems.length}
            studio={studio}
            iconComponent={iconComponent}
            onContextMenu={handleContextMenu}
            onActionIconClick={props.onActionIconClick != null ? stableOnActionIconClick : undefined}
            onDragAndDropItem={props.onDragAndDropItem}
            onExternalFileDrop={props.onExternalFileDrop}
          />
        ))}
      </div>
    </DecorationContext.Provider>
  );
}, areHeadlessTreePropsEqual);
