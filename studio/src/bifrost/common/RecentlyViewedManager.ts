import { AbstractEmitter, assertNotNull } from '@evil/bifrost_fw_sdk';

import type { ISerializable, SerializedData } from '../contracts/SerializableTypes';

type RecentlyViewedItemMap = {
  [type: string]: {
    activeIndex: number;
    items: object[];
  };
};

export const EVENT_RECENTLY_VIEWED_CHANGED = 'EVENT_RECENTLY_VIEWED_CHANGED';

export class RecentlyViewedManager extends AbstractEmitter implements ISerializable {
  private recentlyViewed: RecentlyViewedItemMap = {};
  private maxStoredItems: any = {};

  addItem(type: string, item: any): void {
    const existingHistory = this.recentlyViewed[type] ?? { activeIndex: 0, items: [] };
    const lastItemAsString = JSON.stringify(existingHistory.items[existingHistory.activeIndex]);
    const newItemAsString = JSON.stringify(item);
    const newItem: any = JSON.parse(newItemAsString);

    if (lastItemAsString === newItemAsString) {
      return;
    }

    existingHistory.items.splice(existingHistory.activeIndex + 1);

    existingHistory.items.push(newItem);
    existingHistory.activeIndex = existingHistory.items.length - 1;

    this.recentlyViewed[type] = existingHistory;

    this.enforceItemLimits(type);

    this.emit(EVENT_RECENTLY_VIEWED_CHANGED);
  }

  filterHistory(type: string, filterFn: (item: any) => boolean): void {
    const existingHistory = this.recentlyViewed[type];

    if (existingHistory != null) {
      const filterDuplicates = (item: any, index: number, array: any[]): boolean => {
        const previousItem = index > 0 ? array[index - 1] : null;
        const shouldKeepItem = JSON.stringify(previousItem) !== JSON.stringify(item);
        return shouldKeepItem;
      };
      const lengthBefore = existingHistory.items.length;

      const filteredHistoryItems = existingHistory.items.filter(filterFn);
      const filteredHistoryItemsWithoutDuplicates = filteredHistoryItems.filter(filterDuplicates);
      const countOfItemsRemoved = lengthBefore - filteredHistoryItemsWithoutDuplicates.length;

      existingHistory.activeIndex = existingHistory.activeIndex - countOfItemsRemoved;
      existingHistory.items = filteredHistoryItemsWithoutDuplicates;
    }
  }

  updateCurrentItem(type: string, item: any): void {
    const existingHistory = this.recentlyViewed[type];
    assertNotNull(existingHistory, 'existingHistory');

    const newItemAsString = JSON.stringify(item);
    const newItem: any = JSON.parse(newItemAsString);

    existingHistory.items[existingHistory.activeIndex] = newItem;
  }

  hasNextItem(type: string): boolean {
    const history = this.recentlyViewed[type];
    if (history == null) {
      return false;
    }

    return history.activeIndex < history.items.length - 1;
  }

  hasPreviousItem(type: string): boolean {
    const history = this.recentlyViewed[type];
    if (history == null) {
      return false;
    }

    return history.activeIndex > 0;
  }

  gotoNextItem(type: string): any {
    const history = this.recentlyViewed[type];
    if (history == null) {
      return [];
    }

    history.activeIndex++;
    if (history.activeIndex >= history.items.length) {
      history.activeIndex = history.items.length - 1;
      return null;
    }

    return history.items[history.activeIndex];
  }

  gotoPreviousItem(type: string): any {
    const history = this.recentlyViewed[type];
    if (history == null) {
      return [];
    }

    history.activeIndex--;
    if (history.activeIndex < 0) {
      history.activeIndex = 0;
      return null;
    }

    return history.items[history.activeIndex];
  }

  getListByType(wantedType: string): any[] {
    const history = this.recentlyViewed[wantedType];
    if (history == null) {
      return [];
    }

    return history.items;
  }

  setRecentlyViewedItemsLimit(type: string, limit: number): void {
    this.maxStoredItems[type] = limit;
  }

  deserialize(dump: SerializedData): void {
    if (!dump) {
      return;
    }
    // const deepCopy = JSON.parse(JSON.stringify(dump));

    // this.recentlyViewed = deepCopy.recentlyViewed;
  }

  serialize(): SerializedData {
    return { recentlyViewed: this.recentlyViewed };
  }

  private enforceItemLimits(type: string): void {
    const maxLength = this.maxStoredItems[type];
    const history = this.recentlyViewed[type];

    history.items = history.items.filter((item) => item != null);
    if (maxLength != null && history != null && history.items.length > maxLength) {
      const length = history.items.length;
      const excessItemCount = length - maxLength;

      history.items = history.items.slice(excessItemCount, length);
    }
  }
}
