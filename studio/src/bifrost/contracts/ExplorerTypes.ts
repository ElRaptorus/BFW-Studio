import type { Bifrost } from '#bifrost/Bifrost';

import type { ComponentType } from 'react';

/**
 * What an explorer shows: the projects of the open solution, or the one folder the saved
 * solution file declares for a view (`views.<viewId>` in the `.bfwsln`).
 */
export type ExplorerSource =
  | { readonly kind: 'solution' }
  | { readonly kind: 'view'; readonly viewId: string; readonly includedFiles: readonly string[] };

export type ExplorerHeaderAction = {
  readonly icon: string;
  readonly tooltip: string;
  readonly command: string;
  readonly commandArgs?: unknown[];
  readonly dataTestId?: string;
};

/**
 * A file explorer on one or more workbench pages. Explorers are perspectives on the same solution;
 * only explorers with `structuralOperations` may reshape it.
 */
export type ExplorerDefinition = {
  readonly id: string;
  /** The pane the explorer renders in. */
  readonly paneId: string;
  readonly pages: readonly string[];
  readonly source: ExplorerSource;
  /** Pane title; without it the explorer shows the solution name. */
  readonly label?: string;
  /** Default `'hide'`: directories without visible files are left out. */
  readonly emptyDirectories?: 'hide' | 'show';
  /**
   * Default `false`. Enables moving and dropping items, new file and new directory, folder rename and delete,
   * adding and removing solution folders, hiding directories, and "Show Hidden Files".
   */
  readonly structuralOperations?: boolean;
  readonly headerActions?: readonly ExplorerHeaderAction[];
  /** Shown instead of the tree while the explorer has no folder or no files. */
  readonly emptyState?: ComponentType<{ studio: Bifrost }>;
};

/** The id of the Designer explorer, the one explorer that shapes the solution. */
export const DESIGNER_EXPLORER_ID = 'design';

/** The pane provider every explorer pane uses. */
export const EXPLORER_PANE_PROVIDER_ID = 'std/pane-providers/activities/explorer/ExplorerPane';

/** The tree view mediator id of an explorer. */
export function getExplorerTreeId(explorerId: string): string {
  return `std/file-explorer/${explorerId}`;
}
