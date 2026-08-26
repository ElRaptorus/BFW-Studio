import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import equal from 'fast-deep-equal';

import { EVENT_RECENTLY_CLOSED_CHANGED } from '../contracts/RecentTypes';
import type { ISerializable, SerializedData } from '../contracts/SerializableTypes';

export type RecentlyClosedItem = {
  type: string;
  item: any;
};

export class RecentlyClosedManager extends AbstractEmitter implements ISerializable {
  private recentlyClosed: RecentlyClosedItem[] = [];
  private maxStoredItems: any = {};

  addItem(type: string, item: any): void {
    const newItem: RecentlyClosedItem = { type, item };

    this.removeExistingItem(newItem);
    this.recentlyClosed.unshift(newItem);
    this.enforceItemLimits(type);

    this.emit(EVENT_RECENTLY_CLOSED_CHANGED);
  }

  getListByType(wantedType: string): any[] {
    return this.recentlyClosed.filter(({ type }) => type === wantedType).map(({ item }) => item);
  }

  hasMostRecentByType(wantedType: string): boolean {
    const index = this.recentlyClosed.findIndex(({ type }) => type === wantedType);

    return index !== -1;
  }

  shiftMostRecentByType(wantedType: string): any | null {
    const index = this.recentlyClosed.findIndex(({ type }) => type === wantedType);
    if (index === -1) {
      return null;
    }

    const foundItems = this.recentlyClosed.splice(index, 1);

    return foundItems[0].item;
  }

  resetByTypes(wantedTypes: string[]): void {
    this.recentlyClosed = this.recentlyClosed.filter(({ type }) => !wantedTypes.includes(type));

    this.emit(EVENT_RECENTLY_CLOSED_CHANGED);
  }

  setRecentlyClosedItemsLimit(type: string, limit: number): void {
    this.maxStoredItems[type] = limit;
  }

  deserialize(dump: SerializedData): void {
    if (!dump) {
      return;
    }
    const deepCopy = JSON.parse(JSON.stringify(dump));

    this.recentlyClosed = deepCopy.recentlyClosed;
  }

  serialize(): SerializedData {
    return { recentlyClosed: this.recentlyClosed };
  }

  private enforceItemLimits(type: string): void {
    if (this.maxStoredItems[type] != null) {
      this.recentlyClosed = this.recentlyClosed.slice(0, this.maxStoredItems[type]);
    }
  }

  private removeExistingItem(recentlyClosedItem: RecentlyClosedItem): void {
    const foundIndex = this.recentlyClosed.findIndex((recentItem: any) => equal(recentItem, recentlyClosedItem));

    if (foundIndex !== -1) {
      this.recentlyClosed.splice(foundIndex, 1);
    }
  }
}
