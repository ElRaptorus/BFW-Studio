import { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { assertNotNull } from '#bifrost/common/AssertionFunctions';
import type { GlobalSearchView } from '#bifrost/common/activities';
import { EVENT_GLOBAL_SEARCH_FOCUS_AND_SELECT, EVENT_GLOBAL_SEARCH_UPDATED } from '#bifrost/common/activities';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import type { TreeItem } from '#bifrost/contracts/TreeTypes';
import { EVENT_EDITOR_AREA_LAYOUT_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import type { SearchQuery, SearchResult, SearchResultsByUri } from '#bifrost/contracts/internal/SearchTypes';
import { Tree } from '#components/Tree/Tree';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';

import React, { Component } from 'react';

import { FormInput } from '@elraptorus/bfw_studio_sdk';

import { Icon } from '../../../Icon';

type GlobalSearchPaneState = {
  searchQuery: SearchQuery;
  searchResultsByUri: SearchResultsByUri;
  searchInOpenEditorsOnly: boolean;
  includeGlobsText: string;
  excludeGlobsText: string;
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} className="pane-header--hero" paneId={props.paneId} />
      <PaneContent {...props} />
    </Pane>
  );
}

export function getPaneTitle(): string {
  return 'Search';
}

export class PaneContent extends Component<PaneComponentProps, GlobalSearchPaneState> {
  private globalSearchView: GlobalSearchView;
  private subscriptions: AbstractSubscription[] = [];
  private ref: React.RefObject<HTMLDivElement | null>;
  private phraseDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private includeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private excludeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: PaneComponentProps) {
    super(props);

    const bifrost = Bifrost.cast(props.studio);

    this.ref = React.createRef();
    this.globalSearchView = bifrost.searchView;
    this.subscriptions = [
      this.globalSearchView.on(EVENT_GLOBAL_SEARCH_FOCUS_AND_SELECT, () => this.focusAndSelect()),
      this.globalSearchView.on(EVENT_GLOBAL_SEARCH_UPDATED, () => this.updateStateFromViewData()),
      bifrost.editors.on(EVENT_EDITOR_AREA_LAYOUT_UPDATED, () => this.onEditorLayoutChanged()),
    ];
    this.state = {
      ...this.getStateFromSearchManager(),
      searchInOpenEditorsOnly: false,
      includeGlobsText: '',
      excludeGlobsText: '',
    };
  }

  componentWillUnmount(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    if (this.phraseDebounceTimer != null) {
      clearTimeout(this.phraseDebounceTimer);
    }
    if (this.includeDebounceTimer != null) {
      clearTimeout(this.includeDebounceTimer);
    }
    if (this.excludeDebounceTimer != null) {
      clearTimeout(this.excludeDebounceTimer);
    }
  }

  focusAndSelect(): void {
    assertNotNull(this.ref.current, 'this.ref.current');

    const inputElement: HTMLInputElement | null = this.ref.current.querySelector('input[type=text]');
    assertNotNull(inputElement, 'inputElement');

    inputElement.focus();
    inputElement.setSelectionRange(0, inputElement.value.length);
  }

  onPhraseChanged(value: string): void {
    if (this.phraseDebounceTimer != null) {
      clearTimeout(this.phraseDebounceTimer);
    }
    this.phraseDebounceTimer = setTimeout(() => this.setPhrase(value), 300);
  }

  async setPhrase(query: string): Promise<void> {
    if (this.phraseDebounceTimer != null) {
      clearTimeout(this.phraseDebounceTimer);
    }
    await this.globalSearchView.search(query);
    this.updateStateFromViewData();
  }

  async setCaseSensitivity(isCaseSensitive: boolean): Promise<void> {
    await this.globalSearchView.setCaseSensitivity(isCaseSensitive);
    this.updateStateFromViewData();
  }

  async setWholeWordOnly(isWholeWordOnly: boolean): Promise<void> {
    await this.globalSearchView.setWholeWordOnly(isWholeWordOnly);
    this.updateStateFromViewData();
  }

  onIncludeGlobsChanged(text: string): void {
    this.setState({ includeGlobsText: text });
    if (this.includeDebounceTimer != null) {
      clearTimeout(this.includeDebounceTimer);
    }
    this.includeDebounceTimer = setTimeout(() => this.applyIncludeGlobs(text), 500);
  }

  async setIncludeGlobs(text: string): Promise<void> {
    this.setState({ includeGlobsText: text });
    if (this.includeDebounceTimer != null) {
      clearTimeout(this.includeDebounceTimer);
    }
    await this.applyIncludeGlobs(text);
  }

  private async applyIncludeGlobs(text: string): Promise<void> {
    const globs = text
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean);
    await this.globalSearchView.setIncludeGlobs(globs);
    this.updateStateFromViewData();
  }

  onExcludeGlobsChanged(text: string): void {
    this.setState({ excludeGlobsText: text });
    if (this.excludeDebounceTimer != null) {
      clearTimeout(this.excludeDebounceTimer);
    }
    this.excludeDebounceTimer = setTimeout(() => this.applyExcludeGlobs(text), 500);
  }

  async setExcludeGlobs(text: string): Promise<void> {
    this.setState({ excludeGlobsText: text });
    if (this.excludeDebounceTimer != null) {
      clearTimeout(this.excludeDebounceTimer);
    }
    await this.applyExcludeGlobs(text);
  }

  private async applyExcludeGlobs(text: string): Promise<void> {
    const globs = text
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean);
    await this.globalSearchView.setExcludeGlobs(globs);
    this.updateStateFromViewData();
  }

  async onEditorLayoutChanged(): Promise<void> {
    if (!this.state.searchInOpenEditorsOnly) {
      return;
    }
    const bifrost = Bifrost.cast(this.props.studio);
    const openDocs = bifrost.editors.getOpenEditorDocuments();
    const uris = openDocs.map((doc) => doc.uri).filter(Boolean);
    await this.globalSearchView.setIncludedUris(uris);
    this.updateStateFromViewData();
  }

  async toggleSearchInOpenEditors(): Promise<void> {
    const newValue = !this.state.searchInOpenEditorsOnly;
    this.setState({ searchInOpenEditorsOnly: newValue });

    if (newValue) {
      const bifrost = Bifrost.cast(this.props.studio);
      const openDocs = bifrost.editors.getOpenEditorDocuments();
      const uris = openDocs.map((doc) => doc.uri).filter(Boolean);
      await this.globalSearchView.setIncludedUris(uris);
    } else {
      await this.globalSearchView.setIncludedUris([]);
    }

    this.updateStateFromViewData();
  }

  private updateStateFromViewData(): void {
    this.setState(this.getStateFromSearchManager());
    this.forceUpdate();
  }

  private getStateFromSearchManager(): Pick<GlobalSearchPaneState, 'searchQuery' | 'searchResultsByUri'> {
    const searchViewData = this.globalSearchView.getViewData();
    const searchQuery = searchViewData.searchQuery;
    const searchResultsByUri = this.globalSearchView.getSearchResultsByUri();

    return { searchQuery, searchResultsByUri };
  }

  private getTreeviewEntries(searchResultsByUri: SearchResultsByUri): any {
    if (searchResultsByUri == null) {
      return [];
    }

    const treeviewEntries: TreeItem[] = [];

    for (const uri of Object.keys(searchResultsByUri)) {
      const treeviewFileEntry = this.getTreeviewEntryForUri(uri, searchResultsByUri[uri]);
      treeviewEntries.push(treeviewFileEntry);
    }

    return treeviewEntries;
  }

  private getTreeviewEntryForUri(uri: string, searchResults: SearchResult[]): TreeItem {
    let label;

    try {
      label = this.props.studio.files.getFilename(uri);
    } catch (error) {
      if (!uri.startsWith('buffer:')) {
        throw error;
      }

      label = this.props.studio.editors.getEditorDocumentByUri(uri)?.label;
    }

    const entries = searchResults.map((searchResult: SearchResult): TreeItem => {
      const type = searchResult.type ?? '';
      const sublabel = type.replace('bpmn:', '');

      return {
        type: 'search_result',
        subtype: searchResult.type,
        labelIcon: searchResult.icon,
        label: searchResult.label,
        labelHighlight: this.state.searchQuery.phrase,
        sublabel: sublabel,
        sublabelHighlight: this.state.searchQuery.phrase,
        labelTooltip: `Score: ${searchResult.score}`,
        metadata: searchResult,
      };
    });

    const treeviewFileEntry: TreeItem = {
      type: 'file',
      label: label,
      expanded: true,
      entries: entries,
    };

    return treeviewFileEntry;
  }

  render(): React.JSX.Element {
    const treeviewEntries = this.getTreeviewEntries(this.state.searchResultsByUri);
    const userHasSearched = this.state.searchQuery.phrase !== '';
    const openEditorsActiveClass = this.state.searchInOpenEditorsOnly ? ' search-options__icon-btn--active' : '';

    return (
      <>
        <div className="pane__content" ref={this.ref}>
          <div className="search-input search-input--global-search">
            <FormInput
              type="text"
              className="form-control global-search-pane-phrase-input"
              placeholder="Search all files ..."
              value={this.state.searchQuery.phrase}
              onChange={(value: any) => this.onPhraseChanged(value)}
              onSubmit={(value: any) => this.setPhrase(value)}
              autoselect
            />

            <div className="search-input__options">
              <label className="form-check-label" data-bs-toggle="tooltip" data-bs-title="Match Case">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={this.state.searchQuery.isCaseSensitive}
                  onChange={(event) => this.setCaseSensitivity(event.target.checked)}
                />
                <Icon id="ph ph-text-aa" />
              </label>

              <label className="form-check-label" data-bs-toggle="tooltip" data-bs-title="Match Whole Word">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={this.state.searchQuery.isWholeWordOnly}
                  onChange={(event) => this.setWholeWordOnly(event.target.checked)}
                />
                <Icon id="ph ph-text-t" />
              </label>
            </div>
          </div>

          <div className="search-options">
            <label className="search-options__label">Include files and folders:</label>
            <div className="search-options__row">
              <FormInput
                type="text"
                className="form-control"
                placeholder="e.g. src/**, *.bpmn"
                value={this.state.includeGlobsText}
                onChange={(value: any) => this.onIncludeGlobsChanged(value)}
                onSubmit={(value: any) => this.setIncludeGlobs(value)}
              />
              <button
                className={`search-options__icon-btn${openEditorsActiveClass}`}
                title="Search in Open Editors Only"
                onClick={() => this.toggleSearchInOpenEditors()}
              >
                <Icon id="ph ph-browsers" />
              </button>
            </div>
            <label className="search-options__label">Exclude files and folders:</label>
            <div className="search-options__row">
              <FormInput
                type="text"
                className="form-control"
                placeholder="e.g. node_modules, *.log"
                value={this.state.excludeGlobsText}
                onChange={(value: any) => this.onExcludeGlobsChanged(value)}
                onSubmit={(value: any) => this.setExcludeGlobs(value)}
              />
            </div>
          </div>
        </div>
        <div className="pane__content pane__content--scroll-vertically">
          {treeviewEntries.length > 0 && (
            <Tree
              studio={this.props.studio}
              viewMediatorId="std/activities/search"
              entries={treeviewEntries}
              onClick={(searchResult: any) => {
                if (searchResult == null) {
                  return;
                }
                this.globalSearchView.open(searchResult);
              }}
              iconComponent={Icon}
            />
          )}
          {treeviewEntries.length === 0 && <NoResults hasSearched={userHasSearched} />}
        </div>
      </>
    );
  }
}

function NoResults(props: any): React.JSX.Element | null {
  if (props.hasSearched) {
    return <span>No results found.</span>;
  } else {
    return null;
  }
}

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  Pane: PaneFull,
  PaneContent: PaneContent,
};
