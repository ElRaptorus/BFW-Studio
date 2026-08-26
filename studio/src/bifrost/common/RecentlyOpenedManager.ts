import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import equal from 'fast-deep-equal';

import { EVENT_RECENTLY_OPENED_CHANGED } from '../contracts/RecentTypes';
import type { ISerializable, SerializedData } from '../contracts/SerializableTypes';

export type RecentlyOpenedByType = { [type: string]: any[] };

export class RecentlyOpenedManager extends AbstractEmitter implements ISerializable {
  private recentlyOpened: RecentlyOpenedByType = {
    files: [],
    solution: [],
    editor_document: [],
    command: [],
    search_term: [],
  };

  private maxStoredItems: any = {};

  addItem(type: string, item: any): void {
    if (this.recentlyOpened[type] == null) {
      this.recentlyOpened[type] = [];
    }
    this.removeExistingItem(type, item);
    this.recentlyOpened[type].unshift(item);
    this.enforceItemLimits(type);

    this.emit(EVENT_RECENTLY_OPENED_CHANGED);
  }

  updateItem(type: string, findItemFn: (item: any) => boolean, partialNewItem: any): boolean {
    if (this.recentlyOpened[type] == null) {
      this.recentlyOpened[type] = [];
    }

    const recentlyOpenedItemIndex = this.recentlyOpened[type].findIndex((item) => findItemFn(item));
    if (recentlyOpenedItemIndex == -1) {
      return true;
    }

    const existingItem = this.recentlyOpened[type][recentlyOpenedItemIndex];
    const newItem = {
      ...existingItem,
      ...partialNewItem,
    };

    this.recentlyOpened[type].splice(recentlyOpenedItemIndex, 1, newItem);

    this.emit(EVENT_RECENTLY_OPENED_CHANGED);

    return true;
  }

  getListByType(wantedType: string): any[] {
    if (Array.isArray(this.recentlyOpened[wantedType])) {
      return [...this.recentlyOpened[wantedType]];
    }

    return [];
  }

  hasRecentlyOpenedSolutionsOrEditorDocumentItems(): boolean {
    return this.recentlyOpened.solution.length > 0 || this.recentlyOpened.editor_document.length > 0;
  }

  hasRecentlyOpenedSolutionsOrFiles(): boolean {
    return this.recentlyOpened.solution.length > 0 || this.recentlyOpened.files.length > 0;
  }

  resetByTypes(wantedTypes: string[]): void {
    for (const type of wantedTypes) {
      this.recentlyOpened[type] = [];
    }

    this.emit(EVENT_RECENTLY_OPENED_CHANGED);
  }

  setRecentlyOpenedItemsLimit(type: string, limit: number): void {
    this.maxStoredItems[type] = limit;
  }

  removeItem(type: string, item: any): void {
    this.removeExistingItem(type, item);
    this.emit(EVENT_RECENTLY_OPENED_CHANGED);
  }

  filterHistory(type: string, filterFn: (item: any) => boolean): void {
    if (this.recentlyOpened[type] != null) {
      const filterDuplicates = (item: any, index: number, array: any[]): boolean => {
        const previousItem = index > 0 ? array[index - 1] : null;
        const shouldKeepItem = JSON.stringify(previousItem) !== JSON.stringify(item);
        return shouldKeepItem;
      };
      const lengthBefore = this.recentlyOpened[type].length;

      const filteredItems = this.recentlyOpened[type].filter(filterFn);
      const filteredItemsWithoutDuplicates = filteredItems.filter(filterDuplicates);

      this.recentlyOpened[type] = filteredItemsWithoutDuplicates;

      if (this.recentlyOpened[type].length !== lengthBefore) {
        this.emit(EVENT_RECENTLY_OPENED_CHANGED);
      }
    }
  }

  deserialize(dump: SerializedData): void {
    if (!dump) {
      return;
    }
    const deepCopy = JSON.parse(JSON.stringify(dump));

    this.recentlyOpened = deepCopy.recentlyOpened;
  }

  serialize(): SerializedData {
    return { recentlyOpened: this.recentlyOpened };
  }

  private enforceItemLimits(type: string): void {
    if (this.maxStoredItems[type] != null && this.recentlyOpened[type] != null) {
      this.recentlyOpened[type] = this.recentlyOpened[type].slice(0, this.maxStoredItems[type]);
    }
  }

  private removeExistingItem(type: string, item: any): void {
    if (this.recentlyOpened[type] == null) {
      return;
    }

    const foundIndex = this.recentlyOpened[type].findIndex((recentItem: any) => equal(recentItem.uri, item.uri));
    if (foundIndex !== -1) {
      this.recentlyOpened[type].splice(foundIndex, 1);
    }
  }
}
