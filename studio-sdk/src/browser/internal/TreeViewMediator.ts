import type { ItemInstance, TreeInstance } from '@headless-tree/core';

import type { Studio } from '../../../types/Studio';
import { AbstractEmitter } from '../../common/AbstractEmitter';
import { waitForAcceptance } from '../../common/WaitingFunctions';
import type { TreeDataAdapter, TreeItemData } from '../../components/Tree/TreeDataAdapter';

export const EVENT_TREEVIEW_ENTRIES_CHANGED = 'EVENT_TREEVIEW_ENTRIES_CHANGED';

/**
 * Imperative bridge between the Tree React component and command/keybinding
 * code that runs outside the React render cycle.
 *
 * The Tree component updates `treeRef` and `dataAdapterRef` on every render
 * so that imperative callers always reach the current state.
 */
export class TreeViewMediator extends AbstractEmitter {
  public readonly domClassName: string;
  public readonly domSelector: string;

  private treeRef: TreeInstance<TreeItemData> | null = null;
  private dataAdapterRef: TreeDataAdapter | null = null;

  constructor(studio: Studio, domClassName?: string | null) {
    super();
    this.domClassName = domClassName || studio.getGuid(`TreeViewMediator-`);
    this.domSelector = `.${this.domClassName}`;
  }

  setTreeInstance(tree: TreeInstance<TreeItemData>): void {
    this.treeRef = tree;
  }

  setDataAdapter(adapter: TreeDataAdapter): void {
    this.dataAdapterRef = adapter;
  }

  notifyEntriesChanged(): void {
    this.emit(EVENT_TREEVIEW_ENTRIES_CHANGED);
  }

  collapseAll(): void {
    this.treeRef?.collapseAll();
  }

  expandAll(): void {
    this.treeRef?.expandAll();
  }

  getSelectedMetadata(): any[] {
    if (!this.treeRef || !this.dataAdapterRef) {
      return [];
    }
    const selectedItems = this.treeRef.getSelectedItems();
    return selectedItems
      .map((item: ItemInstance<TreeItemData>) => item.getItemData()?.metadata)
      .filter((meta: any) => meta != null);
  }

  async waitForAndSelectEntriesByMetadataFilter(
    metadataFilterFn: (itemMetadata: any) => boolean,
    expandParentItems: boolean = true,
  ): Promise<void> {
    if (!this.dataAdapterRef || !this.treeRef) {
      return;
    }

    const adapter = this.dataAdapterRef;
    const tree = this.treeRef;

    await waitForAcceptance(
      () => adapter.findIdsByMetadataFilter(metadataFilterFn).length > 0,
      'Awaited entries did not appear in TreeView.',
    );

    const matchingIds = adapter.findIdsByMetadataFilter(metadataFilterFn);

    if (expandParentItems) {
      for (const id of matchingIds) {
        const parentChain = adapter.getParentChain(id);
        const currentExpanded = tree.getState().expandedItems ?? [];
        const newExpanded = [...new Set([...currentExpanded, ...parentChain])];
        tree.applySubStateUpdate('expandedItems', newExpanded);
      }
      tree.rebuildTree();
    }

    tree.setSelectedItems(matchingIds);
    if (matchingIds.length > 0) {
      tree.getItemInstance(matchingIds[matchingIds.length - 1])?.setFocused();
    }
  }

  getViewData(): any {
    if (!this.dataAdapterRef || !this.treeRef) {
      return { items: [] };
    }
    const items = this.treeRef.getItems();
    return {
      items: items.map((item: ItemInstance<TreeItemData>) => ({
        id: item.getId(),
        data: item.getItemData(),
        isExpanded: item.isExpanded(),
        isSelected: item.isSelected(),
        isFocused: item.isFocused(),
      })),
    };
  }
}
