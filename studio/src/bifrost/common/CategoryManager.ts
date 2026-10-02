import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type { PaneAreaName } from '#bifrost/contracts/PaneTypes';
import {
  ALL_PANE_AREA_NAMES_FOR_PAGES,
  type WorkbenchCategoriesSerialized,
  type WorkbenchCategoryDefinition,
  type WorkbenchPageDefinition,
} from '#bifrost/contracts/WorkbenchTypes';
import {
  EVENT_WORKBENCH_CATEGORIES_UPDATED,
  EVENT_WORKBENCH_PAGE_ACTIVATED,
} from '#bifrost/contracts/internal/WorkbenchEvents';

const CATEGORY_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const PAGE_ID_PATTERN = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;

const PAGE_PATTERN = /^[a-z][a-z0-9-]*\/([a-z][a-z0-9-]*|\*)$/;

/** True when `pattern` is a page id (`design/workspace`) or a category wildcard (`design/*`). */
export function isValidPagePattern(pattern: string): boolean {
  return PAGE_PATTERN.test(pattern);
}

/** True when `pageId` equals one of the patterns or lies in a category matched by a wildcard. */
export function matchesPage(patterns: readonly string[], pageId: string): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith('/*') ? pageId.startsWith(pattern.slice(0, -1)) : pattern === pageId,
  );
}

/**
 * Keeps the categories shown in the workbench header and the pages inside them, and which page is active.
 * Persistence is the job of `CategoryMediator`.
 */
export class CategoryManager extends AbstractEmitter {
  private readonly categories = new Map<string, WorkbenchCategoryDefinition>();
  private readonly pages = new Map<string, WorkbenchPageDefinition>();
  private activeCategoryId: string | null = null;
  private activePageId: string | null = null;
  private lastPageIdPerCategory: Record<string, string> = {};
  private showEmptyCategories = false;

  registerCategory(definition: WorkbenchCategoryDefinition): void {
    if (!CATEGORY_ID_PATTERN.test(definition.id)) {
      throw new Error(`Invalid category id '${definition.id}'. Expected lowercase letters, digits and dashes.`);
    }
    if (this.categories.has(definition.id)) {
      throw new Error(`Category '${definition.id}' is already registered.`);
    }

    this.categories.set(definition.id, definition);
    this.emit(EVENT_WORKBENCH_CATEGORIES_UPDATED);
  }

  registerPage(definition: WorkbenchPageDefinition): void {
    if (!PAGE_ID_PATTERN.test(definition.id)) {
      throw new Error(`Invalid page id '${definition.id}'. Expected '<categoryId>/<name>'.`);
    }
    if (!this.categories.has(definition.categoryId)) {
      throw new Error(`Page '${definition.id}' refers to the unknown category '${definition.categoryId}'.`);
    }
    if (!definition.id.startsWith(`${definition.categoryId}/`)) {
      throw new Error(`Page '${definition.id}' does not belong to the category '${definition.categoryId}'.`);
    }
    if (this.pages.has(definition.id)) {
      throw new Error(`Page '${definition.id}' is already registered.`);
    }

    this.pages.set(definition.id, definition);
    this.emit(EVENT_WORKBENCH_CATEGORIES_UPDATED);
  }

  unregisterPage(pageId: string): void {
    const page = this.pages.get(pageId);
    if (page == null) {
      return;
    }
    this.pages.delete(pageId);
    if (this.lastPageIdPerCategory[page.categoryId] === pageId) {
      delete this.lastPageIdPerCategory[page.categoryId];
    }
    if (this.activePageId === pageId) {
      // Falls back to another page of the same category, or to the empty-category state.
      this.activateCategory(page.categoryId);
      if (this.activePageId === pageId) {
        this.activePageId = null;
        this.emit(EVENT_WORKBENCH_PAGE_ACTIVATED, [null, pageId]);
      }
    }
    this.emit(EVENT_WORKBENCH_CATEGORIES_UPDATED);
  }

  getCategory(categoryId: string): WorkbenchCategoryDefinition | undefined {
    return this.categories.get(categoryId);
  }

  getPage(pageId: string): WorkbenchPageDefinition | undefined {
    return this.pages.get(pageId);
  }

  hasPage(pageId: string): boolean {
    return this.pages.has(pageId);
  }

  getPagesOfCategory(categoryId: string): WorkbenchPageDefinition[] {
    return [...this.pages.values()]
      .filter((page) => page.categoryId === categoryId)
      .sort((left, right) => left.order - right.order);
  }

  /** Categories that are shown in the header, in header order. */
  getVisibleCategories(): WorkbenchCategoryDefinition[] {
    return [...this.categories.values()]
      .filter((category) => this.isCategoryVisible(category.id))
      .sort((left, right) => left.order - right.order);
  }

  isCategoryVisible(categoryId: string): boolean {
    if (!this.categories.has(categoryId)) {
      return false;
    }
    return this.showEmptyCategories || this.getPagesOfCategory(categoryId).length > 0;
  }

  setShowEmptyCategories(showEmpty: boolean): void {
    if (this.showEmptyCategories === showEmpty) {
      return;
    }
    this.showEmptyCategories = showEmpty;
    this.emit(EVENT_WORKBENCH_CATEGORIES_UPDATED);
  }

  getActiveCategoryId(): string | null {
    return this.activeCategoryId;
  }

  getActivePageId(): string | null {
    return this.activePageId;
  }

  getActivePage(): WorkbenchPageDefinition | undefined {
    return this.activePageId == null ? undefined : this.pages.get(this.activePageId);
  }

  /** Allowed pane areas of a page (all three when the page does not restrict them). */
  getPaneAreasOfPage(pageId: string | null): readonly PaneAreaName[] {
    const page = pageId == null ? undefined : this.pages.get(pageId);
    return page?.paneAreas ?? ALL_PANE_AREA_NAMES_FOR_PAGES;
  }

  /**
   * Activates a category: its last used page, or its first page. A category without pages becomes the active
   * category with no active page (the workbench then shows the empty-category placeholder).
   * Does nothing for unknown or hidden categories.
   */
  activateCategory(categoryId: string): void {
    if (!this.isCategoryVisible(categoryId)) {
      return;
    }

    const pagesOfCategory = this.getPagesOfCategory(categoryId);
    if (pagesOfCategory.length === 0) {
      const previousPageId = this.activePageId;
      this.activeCategoryId = categoryId;
      this.activePageId = null;
      this.emit(EVENT_WORKBENCH_PAGE_ACTIVATED, [null, previousPageId]);
      this.emit(EVENT_WORKBENCH_CATEGORIES_UPDATED);
      return;
    }

    const lastPageId = this.lastPageIdPerCategory[categoryId];
    const pageToActivate = pagesOfCategory.find((page) => page.id === lastPageId) ?? pagesOfCategory[0];
    this.activatePage(pageToActivate.id);
  }

  activatePage(pageId: string): void {
    const page = this.pages.get(pageId);
    if (page == null) {
      throw new Error(`Page '${pageId}' is not registered.`);
    }

    const previousPageId = this.activePageId;
    this.activeCategoryId = page.categoryId;
    this.activePageId = pageId;
    this.lastPageIdPerCategory[page.categoryId] = pageId;

    if (previousPageId !== pageId) {
      this.emit(EVENT_WORKBENCH_PAGE_ACTIVATED, [pageId, previousPageId]);
    }
    this.emit(EVENT_WORKBENCH_CATEGORIES_UPDATED);
  }

  /** Activates `fallbackPageId` when nothing is active yet (first start, or the stored page is gone). */
  ensureActivePage(fallbackPageId: string): void {
    if (this.activePageId != null && this.pages.has(this.activePageId)) {
      return;
    }
    if (
      this.activeCategoryId != null &&
      this.isCategoryVisible(this.activeCategoryId) &&
      this.getPagesOfCategory(this.activeCategoryId).length === 0
    ) {
      return;
    }
    if (this.pages.has(fallbackPageId)) {
      this.activatePage(fallbackPageId);
    }
  }

  serialize(): WorkbenchCategoriesSerialized {
    return {
      version: 1,
      activeCategoryId: this.activeCategoryId,
      activePageId: this.activePageId,
      lastPageIdPerCategory: { ...this.lastPageIdPerCategory },
    };
  }

  /** Restores stored state. Stored page IDs that are no longer registered are dropped. */
  deserialize(dump: unknown): void {
    const data = dump as Partial<WorkbenchCategoriesSerialized> | null;
    if (data == null || data.version !== 1) {
      return;
    }

    this.lastPageIdPerCategory = {};
    for (const [categoryId, pageId] of Object.entries(data.lastPageIdPerCategory ?? {})) {
      if (this.pages.get(pageId)?.categoryId === categoryId) {
        this.lastPageIdPerCategory[categoryId] = pageId;
      }
    }

    if (data.activePageId != null && this.pages.has(data.activePageId)) {
      this.activePageId = data.activePageId;
      this.activeCategoryId = this.pages.get(data.activePageId)!.categoryId;
    } else if (data.activeCategoryId != null && this.categories.has(data.activeCategoryId)) {
      this.activeCategoryId = data.activeCategoryId;
      this.activePageId = null;
    }
  }
}
