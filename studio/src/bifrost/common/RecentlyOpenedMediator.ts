import { AbstractEmitter } from '@evil/bifrost_fw_sdk';
import type {
  RecentlyOpenedEditorDocument,
  RecentlyOpenedFile,
  RecentlyOpenedSolutionItem,
} from '@evil/bifrost_fw_sdk/types/common';

import { EVENT_RECENTLY_OPENED_CHANGED } from '../contracts/RecentTypes';
import type { LocalStorageItem } from './LocalStorageItem';
import { RecentlyOpenedManager } from './RecentlyOpenedManager';

/**
 * The `RecentlyOpenedMediator` connects an instance of `RecentlyOpenedManager` and an instance for storing its
 * session state.
 *
 * This is done so that the `Manager`, which knows about holding, interpreting and discarding information,
 * does not need to know about storing information, which is the job of the `Storage` class.
 *
 * We gain more clarity about the jobs by separating the two (there are other benefits as well, such as being able to
 * independently test both classes).
 *
 * But since our app wants to manage *and* store information, we implement a `Mediator` class which brings the two
 * together and provides a fascade for those functions that should be exposed at the app-level.
 */
export class RecentlyOpenedMediator extends AbstractEmitter {
  private recentlyOpenedManager: RecentlyOpenedManager;
  private recentlyOpenedStorage: LocalStorageItem;

  constructor(localStorage: LocalStorageItem) {
    super();

    this.recentlyOpenedManager = new RecentlyOpenedManager();
    this.recentlyOpenedStorage = localStorage;

    this.recentlyOpenedManager.on(EVENT_RECENTLY_OPENED_CHANGED, () => {
      const recentlyOpenedDataToSave = this.recentlyOpenedManager.serialize();
      this.recentlyOpenedStorage.save(recentlyOpenedDataToSave);

      this.emit(EVENT_RECENTLY_OPENED_CHANGED);
    });

    const recentlyOpenedData = this.recentlyOpenedStorage.load();
    this.recentlyOpenedManager.deserialize(recentlyOpenedData);

    this.recentlyOpenedManager.setRecentlyOpenedItemsLimit('files', 30);
    this.recentlyOpenedManager.setRecentlyOpenedItemsLimit('solution', 30);
    this.recentlyOpenedManager.setRecentlyOpenedItemsLimit('editor_document', 30);
    this.recentlyOpenedManager.setRecentlyOpenedItemsLimit('command', 30);
    this.recentlyOpenedManager.setRecentlyOpenedItemsLimit('search_term', 30);
  }

  addItem(type: 'files' | 'solution' | 'editor_document' | 'command' | 'search_term', item: any): void {
    this.recentlyOpenedManager.addItem(type, item);
  }

  addRecentlyOpenedEditorDocumentItem(item: RecentlyOpenedEditorDocument): void {
    this.addItem('editor_document', item);

    const isFile = item.uri?.match(/^file:/) != null;
    if (isFile) {
      this.addItem('files', item);
    }
  }

  addRecentlyOpenedSolutionItem(item: RecentlyOpenedSolutionItem): void {
    this.addItem('solution', item);
  }

  addRecentlyOpenedCommandItem(item: any): void {
    this.addItem('command', item);
  }

  updateRecentlyOpenedEditorDocumentLabel(uri: string, label: string): boolean {
    const findItemFn = (item: any) => item.uri === uri;

    const isFile = uri.match(/^file:/) != null;
    if (isFile) {
      this.recentlyOpenedManager.updateItem('files', findItemFn, { label });
    }

    return this.recentlyOpenedManager.updateItem('editor_document', findItemFn, { label });
  }

  hasRecentlyOpenedSolutionsOrEditorDocumentItems(): boolean {
    return this.recentlyOpenedManager.hasRecentlyOpenedSolutionsOrEditorDocumentItems();
  }

  hasRecentlyOpenedSolutionsOrFiles(): boolean {
    return this.recentlyOpenedManager.hasRecentlyOpenedSolutionsOrFiles();
  }

  /**
   * Resets all recently opened items for solutions, files and editor documents.
   */
  resetRecentlyOpenedSolutionsAndEditorDocumentItems(): void {
    this.recentlyOpenedManager.resetByTypes(['editor_document', 'solution', 'files']);
  }

  /**
   * Returns all recently opened items of the given `type`.
   */
  getRecentlyOpenedItems(type: 'files' | 'solution' | 'editor_document' | 'command' | 'search_term'): any[] {
    return this.recentlyOpenedManager.getListByType(type);
  }

  /**
   * Returns all recently opened items for editor documents.
   */
  getRecentlyOpenedEditorDocumentItems(): RecentlyOpenedEditorDocument[] {
    return this.recentlyOpenedManager.getListByType('editor_document');
  }

  /**
   * Returns all recently opened files.
   */
  getRecentlyOpenedFiles(): RecentlyOpenedFile[] {
    return this.recentlyOpenedManager.getListByType('files');
  }

  /**
   * Returns all recently opened items for solutions.
   */
  getRecentlyOpenedSolutions(): RecentlyOpenedSolutionItem[] {
    return this.recentlyOpenedManager.getListByType('solution');
  }

  setRecentlyOpenedItemsLimit(
    type: 'files' | 'solution' | 'editor_document' | 'command' | 'search_term',
    limit: number,
  ): void {
    return this.recentlyOpenedManager.setRecentlyOpenedItemsLimit(type, limit);
  }

  removeRecentlyOpenedFileItem(item: any): void {
    this.recentlyOpenedManager.removeItem('files', item);
  }

  removeRecentlyOpenedEditorDocumentItem(item: any): void {
    this.recentlyOpenedManager.removeItem('editor_document', item);

    const isFile = item?.uri?.match(/^file:/) != null;
    if (isFile) {
      this.recentlyOpenedManager.removeItem('files', item);
    }
  }

  removeRecentlyOpenedSolutionItem(item: any): void {
    this.recentlyOpenedManager.removeItem('solution', item);
  }

  filterRecentlyOpenedHistory(filterFn: (item: any) => boolean): void {
    this.recentlyOpenedManager.filterHistory('editor_document', filterFn);
    this.recentlyOpenedManager.filterHistory('files', filterFn);
    this.recentlyOpenedManager.filterHistory('solution', filterFn);
  }

  /**
   * Internal: Used by RecentlyOpened event propagation across windows.
   */
  onRecentlyOpenedChangedInOtherInstance(): void {
    const recentlyOpenedData = this.recentlyOpenedStorage.load();
    this.recentlyOpenedManager.deserialize(recentlyOpenedData);
    this.emit(EVENT_RECENTLY_OPENED_CHANGED);
  }
}
