import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type { PaneAreaName } from '#bifrost/contracts/PaneTypes';
import type { WorkbenchCategoryDefinition, WorkbenchPageDefinition } from '#bifrost/contracts/WorkbenchTypes';
import {
  EVENT_WORKBENCH_CATEGORIES_UPDATED,
  EVENT_WORKBENCH_PAGE_ACTIVATED,
  EVENT_WORKBENCH_PAGE_UNREGISTERED,
} from '#bifrost/contracts/internal/WorkbenchEvents';

import { CategoryManager } from './CategoryManager';
import type { LocalStorageItem } from './LocalStorageItem';

/**
 * Connects the `CategoryManager` with its session storage and forwards its events.
 * Exposed as `bifrost.categories`.
 */
export class CategoryMediator extends AbstractEmitter {
  private readonly categoryManager = new CategoryManager();
  private readonly categoryStorage: LocalStorageItem;
  private restored = false;

  constructor(categoryStorage: LocalStorageItem) {
    super();
    this.categoryStorage = categoryStorage;

    this.categoryManager.on(EVENT_WORKBENCH_PAGE_ACTIVATED, (pageId, previousPageId) =>
      this.emit(EVENT_WORKBENCH_PAGE_ACTIVATED, [pageId, previousPageId]),
    );
    this.categoryManager.on(EVENT_WORKBENCH_PAGE_UNREGISTERED, (pageId: string) =>
      this.emit(EVENT_WORKBENCH_PAGE_UNREGISTERED, [pageId]),
    );
    this.categoryManager.on(EVENT_WORKBENCH_CATEGORIES_UPDATED, () => {
      if (this.restored) {
        this.categoryStorage.save(this.categoryManager.serialize());
      }
      this.emit(EVENT_WORKBENCH_CATEGORIES_UPDATED);
    });
  }

  /** Must run before panes and editors are restored, so that they restore into the right page. */
  restoreFromLastSession(): void {
    this.categoryManager.deserialize(this.categoryStorage.load());
    this.restored = true;
  }

  registerCategory(definition: WorkbenchCategoryDefinition): void {
    this.categoryManager.registerCategory(definition);
  }

  registerPage(definition: WorkbenchPageDefinition): void {
    this.categoryManager.registerPage(definition);
  }

  unregisterPage(pageId: string): void {
    this.categoryManager.unregisterPage(pageId);
    // Removing the only page of a category hides it; do not leave the workbench on its placeholder.
    this.categoryManager.ensureActivePage('design/workspace');
  }

  getCategory(categoryId: string): WorkbenchCategoryDefinition | undefined {
    return this.categoryManager.getCategory(categoryId);
  }

  getPage(pageId: string): WorkbenchPageDefinition | undefined {
    return this.categoryManager.getPage(pageId);
  }

  hasPage(pageId: string): boolean {
    return this.categoryManager.hasPage(pageId);
  }

  getPagesOfCategory(categoryId: string): WorkbenchPageDefinition[] {
    return this.categoryManager.getPagesOfCategory(categoryId);
  }

  getVisibleCategories(): WorkbenchCategoryDefinition[] {
    return this.categoryManager.getVisibleCategories();
  }

  isCategoryVisible(categoryId: string): boolean {
    return this.categoryManager.isCategoryVisible(categoryId);
  }

  setShowEmptyCategories(showEmpty: boolean): void {
    this.categoryManager.setShowEmptyCategories(showEmpty);
    this.categoryManager.ensureActivePage('design/workspace');
  }

  getActiveCategoryId(): string | null {
    return this.categoryManager.getActiveCategoryId();
  }

  getActivePageId(): string | null {
    return this.categoryManager.getActivePageId();
  }

  getActivePage(): WorkbenchPageDefinition | undefined {
    return this.categoryManager.getActivePage();
  }

  getPaneAreasOfPage(pageId: string | null): readonly PaneAreaName[] {
    return this.categoryManager.getPaneAreasOfPage(pageId);
  }

  activateCategory(categoryId: string): void {
    this.categoryManager.activateCategory(categoryId);
  }

  activatePage(pageId: string): void {
    this.categoryManager.activatePage(pageId);
  }

  ensureActivePage(fallbackPageId: string): void {
    this.categoryManager.ensureActivePage(fallbackPageId);
  }

  clearInstance(): void {
    this.categoryStorage.clear();
  }
}
