import type { PaneAreaName } from './PaneTypes';

/**
 * A category is an entry of the workbench header (for example Design or Debug).
 * Category IDs are stable identifiers; the label is UI text only.
 */
export type WorkbenchCategoryDefinition = {
  id: string;
  label: string;
  icon: string;
  /** `start` and `end` entries sit at the edges of the header, `main` entries are centered. */
  placement: 'start' | 'main' | 'end';
  order: number;
};

/**
 * A page is a sub-view of a category. Its ID has the form `<categoryId>/<name>`.
 */
export type WorkbenchPageDefinition = {
  id: string;
  categoryId: string;
  label: string;
  /** Icon ID shown in the page bar. */
  icon: string;
  order: number;
  /** Opened when the page is activated while it has no documents. */
  defaultDocumentUri?: string;
  /** Defaults to `true`. */
  editorTabsVisible?: boolean;
  /** Pane areas the page may show. Defaults to all three. */
  paneAreas?: PaneAreaName[];
};

export type WorkbenchCategoriesSerialized = {
  version: 1;
  activeCategoryId: string | null;
  activePageId: string | null;
  lastPageIdPerCategory: Record<string, string>;
};

export const ALL_PANE_AREA_NAMES_FOR_PAGES: readonly PaneAreaName[] = ['left', 'bottom', 'right'];

/** Value of `EditorDocumentType.page` that routes a document to whichever page is currently active. */
export const ACTIVE_PAGE = 'active';
