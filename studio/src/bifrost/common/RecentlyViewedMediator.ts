import type { EditorDocument } from '#bifrost/contracts/EditorTypes';

import { RecentlyViewedManager } from './RecentlyViewedManager';

const EDITOR_DOCUMENT_TYPE = 'editor_document';

export class RecentlyViewedMediator {
  private recentlyViewedManager: RecentlyViewedManager;
  private currentlyNavigating: boolean;

  constructor() {
    this.recentlyViewedManager = new RecentlyViewedManager();
    this.recentlyViewedManager.setRecentlyViewedItemsLimit(EDITOR_DOCUMENT_TYPE, 100);
    this.currentlyNavigating = false;
  }

  async lockForNavigation(callbackFn: () => Promise<void>): Promise<void> {
    this.currentlyNavigating = true;

    try {
      await callbackFn();
    } catch (error) {
      console.error(error);
    }

    this.currentlyNavigating = false;
  }

  addItem(type: string, item: any): void {
    this.recentlyViewedManager.addItem(type, item);
  }

  addEditorDocument(focusedEditorDocument: EditorDocument, blurredEditorDocument: EditorDocument | null): void {
    if (blurredEditorDocument != null) {
      const { uri, label, metadata } = blurredEditorDocument;
      this.recentlyViewedManager.updateCurrentItem(EDITOR_DOCUMENT_TYPE, { uri, label, metadata });
    }

    const { uri, label, metadata } = focusedEditorDocument;
    this.recentlyViewedManager.addItem(EDITOR_DOCUMENT_TYPE, { uri, label, metadata });
  }

  filterHistory(filterFn: (item: any) => boolean): void {
    this.recentlyViewedManager.filterHistory(EDITOR_DOCUMENT_TYPE, filterFn);
  }

  gotoPreviousEditorDocument(): any {
    return this.recentlyViewedManager.gotoPreviousItem(EDITOR_DOCUMENT_TYPE);
  }

  gotoNextEditorDocument(): any {
    return this.recentlyViewedManager.gotoNextItem(EDITOR_DOCUMENT_TYPE);
  }

  hasNextEditorDocument(): boolean {
    return this.hasNextItem(EDITOR_DOCUMENT_TYPE);
  }

  hasNextItem(type: string): boolean {
    return this.currentlyNavigating === false && this.recentlyViewedManager.hasNextItem(type);
  }

  hasPreviousEditorDocument(): boolean {
    return this.hasPreviousItem(EDITOR_DOCUMENT_TYPE);
  }

  hasPreviousItem(type: string): boolean {
    return this.currentlyNavigating === false && this.recentlyViewedManager.hasPreviousItem(type);
  }

  /**
   * Returns all recently viewed items of the given `type`.
   */
  getRecentlyViewedItems(type: string): any[] {
    return this.recentlyViewedManager.getListByType(type);
  }

  /**
   * Returns all recently viewed items for editor documents.
   */
  getRecentlyViewedEditorDocumentItems(): any[] {
    return this.recentlyViewedManager.getListByType(EDITOR_DOCUMENT_TYPE);
  }
}
