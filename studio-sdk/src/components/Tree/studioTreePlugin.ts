import type { FeatureImplementation, SelectionDataRef } from '@headless-tree/core';

import type { TreeItemData } from './TreeDataAdapter';

export type StudioTreeCallbacks = {
  onClickItem?: (metadata: any, event?: MouseEvent) => void;
  onDoubleClickItem?: (metadata: any, event?: MouseEvent) => void;
};

declare module '@headless-tree/core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TreeConfig<T> {
    studioCallbacks?: StudioTreeCallbacks;
  }
}

/**
 * Custom Headless Tree FeatureImplementation that adapts tree behavior
 * to match the Studio's expected UX:
 *
 * - Single click on a folder: select it AND toggle expand/collapse
 * - Single click on a leaf: select it and fire onClickItem callback
 * - Double click: fire onDoubleClickItem callback
 * - Ctrl+click: toggle item selection
 * - Shift+click: range-select from anchor to clicked item
 *
 * Callbacks are read from `tree.getConfig().studioCallbacks` so each tree
 * instance carries its own callbacks (no shared mutable state).
 */
export const studioTreePlugin: FeatureImplementation<TreeItemData> = {
  key: 'studioTreePlugin',
  overwrites: ['selection'],

  itemInstance: {
    getProps: ({ tree, item, prev }) => {
      const baseProps = prev?.() ?? {};
      return {
        ...baseProps,
        onClick: (e: MouseEvent) => {
          const isCtrlOrMeta = e.ctrlKey || e.metaKey;
          const isShift = e.shiftKey;

          if (isShift) {
            item.selectUpTo(isCtrlOrMeta);
          } else if (isCtrlOrMeta) {
            item.toggleSelect();
          } else {
            tree.setSelectedItems([item.getItemMeta().itemId]);

            if (item.isFolder()) {
              if (item.isExpanded()) {
                item.collapse();
              } else {
                item.expand();
              }
            }
          }

          if (!isShift) {
            tree.getDataRef<SelectionDataRef>().current.selectUpToAnchorId = item.getItemMeta().itemId;
          }

          item.setFocused();

          const callbacks = tree.getConfig().studioCallbacks;
          const data = item.getItemData();
          if (data?.metadata && callbacks?.onClickItem) {
            callbacks.onClickItem(data.metadata, e);
          }
        },
        onDoubleClick: (e: MouseEvent) => {
          const callbacks = tree.getConfig().studioCallbacks;
          const data = item.getItemData();
          if (data?.metadata && callbacks?.onDoubleClickItem) {
            callbacks.onDoubleClickItem(data.metadata, e);
          }
        },
      };
    },
  },
};
