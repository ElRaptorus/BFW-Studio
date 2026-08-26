import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';

import { EVENT_RECENTLY_CLOSED_CHANGED } from '../contracts/RecentTypes';
import type { LocalStorageItem } from './LocalStorageItem';
import { RecentlyClosedManager } from './RecentlyClosedManager';

export class RecentlyClosedMediator extends AbstractEmitter {
  private recentlyClosedManager: RecentlyClosedManager;
  private recentlyClosedStorage: LocalStorageItem;

  constructor(localStorage: LocalStorageItem) {
    super();

    this.recentlyClosedManager = new RecentlyClosedManager();
    this.recentlyClosedStorage = localStorage;

    this.recentlyClosedManager.on(EVENT_RECENTLY_CLOSED_CHANGED, () => {
      const recentlyClosedData = this.recentlyClosedManager.serialize();
      this.recentlyClosedStorage.save(recentlyClosedData);

      this.emit(EVENT_RECENTLY_CLOSED_CHANGED);
    });

    const recentlyClosedData = this.recentlyClosedStorage.load();
    this.recentlyClosedManager.deserialize(recentlyClosedData);

    this.recentlyClosedManager.setRecentlyClosedItemsLimit('editor_document', 30);
  }

  addItem(type: string, item: any): void {
    this.recentlyClosedManager.addItem(type, item);
  }

  /**
   * Returns all recently closed items of the given `type`.
   */
  getRecentlyClosedItems(type: string): any[] {
    return this.recentlyClosedManager.getListByType(type);
  }

  /**
   * Returns all recently closed items for editor documents.
   */
  getRecentlyClosedEditorDocumentItems(): any[] {
    return this.recentlyClosedManager.getListByType('editor_document');
  }

  hasMostRecentByType(wantedType: string): boolean {
    return this.recentlyClosedManager.hasMostRecentByType(wantedType);
  }

  shiftMostRecentByType(wantedType: string): any | null {
    return this.recentlyClosedManager.shiftMostRecentByType(wantedType);
  }

  setRecentlyClosedItemsLimit(type: string, limit: number): void {
    return this.recentlyClosedManager.setRecentlyClosedItemsLimit(type, limit);
  }

  clearInstance(): void {
    this.recentlyClosedStorage.clear();
  }
}
