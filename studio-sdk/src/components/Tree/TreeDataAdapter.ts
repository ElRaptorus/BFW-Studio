import type { TreeItem } from '../../contracts/TreeTypes';

export type TreeItemData = TreeItem & {
  /** The stable ID used by Headless Tree to identify this node. */
  readonly htId: string;
};

const VIRTUAL_ROOT_ID = '__ht_root__';

/**
 * Converts nested TreeItem[] hierarchies into the flat id-based data model
 * that Headless Tree's syncDataLoaderFeature expects.
 *
 * Each item is assigned a stable ID derived from its `pathId` when available,
 * falling back to a positional path like `root/0/2/1`.
 */
export class TreeDataAdapter {
  private itemMap = new Map<string, TreeItemData>();
  private childrenMap = new Map<string, string[]>();
  private parentMap = new Map<string, string>();

  constructor(entries: TreeItem[]) {
    this.buildIndex(entries);
  }

  get rootItemId(): string {
    return VIRTUAL_ROOT_ID;
  }

  getDataLoader() {
    return {
      getItem: (id: string): TreeItemData => {
        return this.itemMap.get(id)!;
      },
      getChildren: (id: string): string[] => {
        return this.childrenMap.get(id) ?? [];
      },
    };
  }

  getItemById(id: string): TreeItemData | undefined {
    return this.itemMap.get(id);
  }

  getMetadataForIds(ids: string[]): any[] {
    return ids.map((id) => this.itemMap.get(id)?.metadata).filter((meta) => meta != null);
  }

  getSelectedItemsForIds(ids: string[]): TreeItemData[] {
    return ids.map((id) => this.itemMap.get(id)).filter((item): item is TreeItemData => item != null);
  }

  findIdsByMetadataFilter(filterFn: (metadata: any) => boolean): string[] {
    const result: string[] = [];
    for (const [id, item] of this.itemMap) {
      if (id === VIRTUAL_ROOT_ID) {
        continue;
      }
      if (filterFn(item.metadata)) {
        result.push(id);
      }
    }
    return result;
  }

  /**
   * Returns the chain of parent IDs from the root down to (but not including) the given item.
   */
  getParentChain(itemId: string): string[] {
    const parents: string[] = [];
    let currentId = itemId;
    while (this.parentMap.has(currentId)) {
      const parentId = this.parentMap.get(currentId)!;
      if (parentId === VIRTUAL_ROOT_ID) {
        break;
      }
      parents.unshift(parentId);
      currentId = parentId;
    }
    return parents;
  }

  /**
   * Returns all item IDs that are present in the adapter.
   */
  getAllIds(): string[] {
    return Array.from(this.itemMap.keys()).filter((id) => id !== VIRTUAL_ROOT_ID);
  }

  /**
   * Computes the set of initially expanded item IDs based on the `expanded` property
   * of the input TreeItems.
   */
  getInitialExpandedIds(): string[] {
    const expanded: string[] = [];
    for (const [id, item] of this.itemMap) {
      if (id === VIRTUAL_ROOT_ID) {
        continue;
      }
      if (item.expanded && Array.isArray(item.entries)) {
        expanded.push(id);
      }
    }
    return expanded;
  }

  /**
   * Computes the set of initially selected item IDs based on the `selected` property.
   */
  getInitialSelectedIds(): string[] {
    const selected: string[] = [];
    for (const [id, item] of this.itemMap) {
      if (id === VIRTUAL_ROOT_ID) {
        continue;
      }
      if (item.selected) {
        selected.push(id);
      }
    }
    return selected;
  }

  private buildIndex(entries: TreeItem[]): void {
    this.itemMap.clear();
    this.childrenMap.clear();
    this.parentMap.clear();

    const rootData: TreeItemData = {
      htId: VIRTUAL_ROOT_ID,
      type: 'section',
      label: '',
      entries,
    };
    this.itemMap.set(VIRTUAL_ROOT_ID, rootData);

    const rootChildIds = this.indexChildren(entries, VIRTUAL_ROOT_ID);
    this.childrenMap.set(VIRTUAL_ROOT_ID, rootChildIds);
  }

  private indexChildren(entries: TreeItem[] | undefined, parentPath: string): string[] {
    if (!entries) {
      return [];
    }

    const childIds: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const id = entry.pathId ?? `${parentPath}/${i}`;

      const itemData: TreeItemData = {
        ...entry,
        htId: id,
      };
      this.itemMap.set(id, itemData);
      this.parentMap.set(id, parentPath);
      childIds.push(id);

      if (Array.isArray(entry.entries)) {
        const grandChildIds = this.indexChildren(entry.entries, id);
        this.childrenMap.set(id, grandChildIds);
      }
    }

    return childIds;
  }
}
