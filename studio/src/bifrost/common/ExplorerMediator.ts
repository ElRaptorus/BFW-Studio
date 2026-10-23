import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import {
  DESIGNER_EXPLORER_ID,
  EXPLORER_PANE_PROVIDER_ID,
  type ExplorerDefinition,
  getExplorerTreeId,
} from '#bifrost/contracts/ExplorerTypes';
import type { PaneObject } from '#bifrost/contracts/PaneTypes';
import type { Solution } from '#bifrost/contracts/SolutionTypes';
import type { TreeDecorationProvider, TreeDecorationSource, TreeItemDecoration } from '#bifrost/contracts/TreeTypes';
import { ACTIVE_PAGE } from '#bifrost/contracts/WorkbenchTypes';

import type { Bifrost } from '../Bifrost';
import type { FileHandlingService } from './FileHandlingService';
import { EVENT_FILE_EXPLORER_OPENED_SOLUTION, FileExplorerView } from './activities';

/** Emitted with the explorer id whenever the tree of an explorer changes. */
export const EVENT_EXPLORER_VIEW_UPDATED = 'EVENT_EXPLORER_VIEW_UPDATED';

const DESIGNER_EXPLORER: ExplorerDefinition = {
  id: DESIGNER_EXPLORER_ID,
  paneId: 'design/workspace/explorer',
  pages: ['design/workspace'],
  source: { kind: 'solution' },
  emptyDirectories: 'show',
  structuralOperations: true,
};

type RegisteredDecorationProvider = { provider: TreeDecorationProvider; explorerIds: readonly string[] | null };

/**
 * Holds the file explorers. Every explorer is a perspective on the open solution with its own tree;
 * the Designer explorer is built in, other modules register theirs for their pages.
 */
export class ExplorerMediator extends AbstractEmitter {
  private bifrost: Bifrost;
  private fileHandling: FileHandlingService;
  private definitions = new Map<string, ExplorerDefinition>();
  private views = new Map<string, FileExplorerView>();
  private solution: Solution | null = null;
  private decorationProviders: RegisteredDecorationProvider[] = [];
  private decorationListeners = new Set<(changedUris: Set<string>) => void>();
  private decorationSources = new Map<string, TreeDecorationSource>();
  private lastFocusedExplorerId: string | null = null;

  constructor(bifrost: Bifrost, fileHandling: FileHandlingService) {
    super();
    this.bifrost = bifrost;
    this.fileHandling = fileHandling;
    this.add(DESIGNER_EXPLORER);
    globalThis.document?.addEventListener('focusin', (event) => {
      this.lastFocusedExplorerId = this.getExplorerIdOfElement(event.target as Element) ?? this.lastFocusedExplorerId;
    });
  }

  /**
   * Registers an explorer and returns its pane for `bifrost.panes.registerPaneGroup`.
   *
   *    bifrost.panes.registerPaneGroup('left', 'maps', [bifrost.explorers.register({ id: 'maps', ... })]);
   */
  register(definition: ExplorerDefinition): PaneObject {
    this.add(definition);
    return this.getPane(definition.id);
  }

  /** The pane of a registered explorer, including the built-in Designer explorer. */
  getPane(explorerId: string): PaneObject {
    return { id: this.get(explorerId).paneId, providerId: EXPLORER_PANE_PROVIDER_ID, collapsed: false };
  }

  get(explorerId: string): ExplorerDefinition {
    const definition = this.definitions.get(explorerId);
    if (definition == null) {
      throw new Error(`There is no explorer with the id '${explorerId}'.`);
    }
    return definition;
  }

  getView(explorerId: string): FileExplorerView {
    const view = this.views.get(explorerId);
    if (view == null) {
      throw new Error(`There is no explorer with the id '${explorerId}'.`);
    }
    return view;
  }

  getAll(): ExplorerDefinition[] {
    return [...this.definitions.values()];
  }

  getByPaneId(paneId: string): ExplorerDefinition | null {
    return this.getAll().find((definition) => definition.paneId === paneId) ?? null;
  }

  /** The explorer that shows the folder of solution view `viewId`. */
  getViewExplorer(viewId: string): ExplorerDefinition | null {
    return (
      this.getAll().find((definition) => definition.source.kind === 'view' && definition.source.viewId === viewId) ??
      null
    );
  }

  getExplorersOfPage(pageId: string | null): ExplorerDefinition[] {
    return pageId == null ? [] : this.getAll().filter((definition) => definition.pages.includes(pageId));
  }

  /**
   * The explorer whose tree holds the keyboard focus or held it last (a context menu takes the focus away),
   * as long as it belongs to the active page; else the first explorer of the active page, else the Designer explorer.
   */
  getActiveExplorer(): ExplorerDefinition {
    const pageExplorers = this.getExplorersOfPage(this.bifrost.categories.getActivePageId());
    const focusedExplorerId =
      this.getExplorerIdOfElement(globalThis.document?.activeElement) ?? this.lastFocusedExplorerId;
    const focused = pageExplorers.find((definition) => definition.id === focusedExplorerId);
    return focused ?? pageExplorers[0] ?? this.get(DESIGNER_EXPLORER_ID);
  }

  private getExplorerIdOfElement(element: Element | null | undefined): string | null {
    const treeId = element?.closest?.('[data-view-mediator-id]')?.getAttribute('data-view-mediator-id');
    return this.getAll().find((definition) => getExplorerTreeId(definition.id) === treeId)?.id ?? null;
  }

  /**
   * The explorers that should reveal the document at `uri`: those showing the file on the page the document
   * opens on, else every explorer showing it.
   */
  getRevealTargets(uri: string): string[] {
    const showing = this.getAll().filter((definition) => this.getView(definition.id).containsFile(uri));
    const pageId = this.getDocumentPage(uri);
    const onPage = showing.filter((definition) => pageId != null && definition.pages.includes(pageId));
    return (onPage.length > 0 ? onPage : showing).map((definition) => definition.id);
  }

  /** Called by Bifrost whenever the solution changes. */
  async setSolution(solution: Solution | null): Promise<void> {
    this.solution = solution;
    await Promise.all([...this.views.values()].map((view) => this.applySolution(view)));
  }

  /**
   * Adds a decoration provider. Without `explorerIds` it decorates every explorer, Open Editors and editor tabs;
   * with them, only those explorers.
   */
  registerDecorationProvider(provider: TreeDecorationProvider, explorerIds?: readonly string[]): void {
    this.decorationProviders.push({ provider, explorerIds: explorerIds ?? null });
    provider.onDidChange((uris) => {
      const uriSet = new Set(uris);
      for (const listener of this.decorationListeners) {
        listener(uriSet);
      }
    });
  }

  /** The merged decorations of the unscoped providers, plus those scoped to `explorerId`. */
  getDecorationSource(explorerId?: string): TreeDecorationSource {
    const key = explorerId ?? '';
    let source = this.decorationSources.get(key);
    if (source == null) {
      source = {
        getDecoration: (uri) => this.getDecoration(uri, explorerId),
        subscribe: (listener) => {
          this.decorationListeners.add(listener);
          return { dispose: () => this.decorationListeners.delete(listener) };
        },
      };
      this.decorationSources.set(key, source);
    }
    return source;
  }

  private getDecoration(uri: string, explorerId: string | undefined): TreeItemDecoration | null {
    let merged: TreeItemDecoration | null = null;
    for (const { provider, explorerIds } of this.decorationProviders) {
      if (explorerIds != null && (explorerId == null || !explorerIds.includes(explorerId))) {
        continue;
      }
      const decoration = provider.provideDecoration(uri);
      if (decoration == null) {
        continue;
      }
      if (merged == null) {
        merged = {
          styles: decoration.styles ? { ...decoration.styles } : undefined,
          badges: decoration.badges ? [...decoration.badges] : undefined,
        };
        continue;
      }
      if (decoration.styles) {
        merged.styles = { ...merged.styles, ...decoration.styles };
      }
      if (decoration.badges && decoration.badges.length > 0) {
        merged.badges = [...(merged.badges ?? []), ...decoration.badges];
      }
    }
    return merged;
  }

  private add(definition: ExplorerDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`There is already an explorer with the id '${definition.id}'.`);
    }
    if (this.getByPaneId(definition.paneId) != null) {
      throw new Error(`The pane '${definition.paneId}' already shows an explorer.`);
    }
    this.definitions.set(definition.id, definition);
    const view = new FileExplorerView(this.bifrost, this.fileHandling, definition);
    view.on(EVENT_FILE_EXPLORER_OPENED_SOLUTION, () => this.emit(EVENT_EXPLORER_VIEW_UPDATED, [definition.id]));
    this.views.set(definition.id, view);
    if (this.solution != null) {
      void this.applySolution(view);
    }
  }

  private async applySolution(view: FileExplorerView): Promise<void> {
    if (this.solution == null) {
      view.clearSolution();
      return;
    }
    await view.setSolution(this.solution);
  }

  private getDocumentPage(uri: string): string | null {
    if (!this.bifrost.editors.hasDocumentTypeDefinitionForUri(uri)) {
      return null;
    }
    const page = this.bifrost.editors.getDocumentTypeDefinitionByUri(uri).page;
    return page === ACTIVE_PAGE ? this.bifrost.categories.getActivePageId() : page;
  }
}
