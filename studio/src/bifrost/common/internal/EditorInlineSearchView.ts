import { EVENT_INLINE_SEARCH_UPDATED } from '#bifrost/contracts/internal/SearchEvents';
import type { InlineSearchViewData, SearchQuery, SearchResult } from '#bifrost/contracts/internal/SearchTypes';

import { AbstractEmitter } from '../AbstractEmitter';

interface ISearchIndex {
  search(...args: any[]): Promise<SearchResult[]>;
}

type OpenCallbackFn = (searchResult: SearchResult) => void;

export class EditorInlineSearchView extends AbstractEmitter {
  private searchQuery: SearchQuery;
  private searchResults: SearchResult[];
  private searchIndex: ISearchIndex;
  private currentIndex: number;
  private openCallbackFn: OpenCallbackFn;
  private visible: boolean;

  constructor(
    searchIndex: ISearchIndex,
    editorDocumentUri: string,
    searchQuery: SearchQuery | null,
    openCallbackFn: OpenCallbackFn,
  ) {
    super();

    this.openCallbackFn = openCallbackFn;
    this.searchIndex = searchIndex;
    this.searchQuery = searchQuery ?? this.getDefaultSearchQuery(editorDocumentUri);
    this.visible = this.searchQuery.phrase.trim() !== '';
    this.searchResults = [];
    this.currentIndex = 0;
  }

  async search(phrase: string): Promise<void> {
    if (phrase.trim() === '') {
      this.searchQuery.phrase = '';
      this.searchResults = [];
      return;
    }

    if (phrase === this.searchQuery.phrase) {
      return this.gotoNextSearchResult();
    }

    this.searchQuery.phrase = phrase;
    await this.updateSearchResults();

    if (this.searchResults.length > 0) {
      this.currentIndex = 0;
      return this.gotoCurrentSearchResult();
    }

    this.emit(EVENT_INLINE_SEARCH_UPDATED, [this.visible, this.searchQuery]);
  }

  async setCaseSensitivity(isCaseSensitive: boolean): Promise<void> {
    this.searchQuery.isCaseSensitive = isCaseSensitive;
    await this.updateSearchResults();
    this.currentIndex = 0;
    this.gotoCurrentSearchResult();

    this.emit(EVENT_INLINE_SEARCH_UPDATED, [this.visible, this.searchQuery]);
  }

  async setWholeWordOnly(isWholeWordOnly: boolean): Promise<void> {
    this.searchQuery.isWholeWordOnly = isWholeWordOnly;
    await this.updateSearchResults();
    this.currentIndex = 0;
    this.gotoCurrentSearchResult();

    this.emit(EVENT_INLINE_SEARCH_UPDATED, [this.visible, this.searchQuery]);
  }

  async gotoNextSearchResult(): Promise<void> {
    this.currentIndex += 1;
    if (this.currentIndex > this.searchResults.length - 1) {
      this.currentIndex = 0;
    }
    this.gotoCurrentSearchResult();
  }

  async gotoPreviousSearchResult(): Promise<void> {
    this.currentIndex -= 1;
    if (this.currentIndex < 0) {
      this.currentIndex = this.searchResults.length - 1;
    }
    this.gotoCurrentSearchResult();
  }

  getViewData(): InlineSearchViewData {
    const visible = this.visible;
    const hasResults = this.searchResults.length > 0;
    const currentResultIndex = this.currentIndex;
    const maxResultIndex = this.searchResults.length - 1;

    return { visible, hasResults, currentResultIndex, maxResultIndex };
  }

  private gotoCurrentSearchResult(): void {
    if (this.searchResults.length === 0) {
      return;
    }

    const searchResult = this.searchResults[this.currentIndex];

    this.openCallbackFn.apply(null, [searchResult]);

    this.emit(EVENT_INLINE_SEARCH_UPDATED, [this.visible, this.searchQuery]);
  }

  show(): void {
    this.visible = true;
    this.emit(EVENT_INLINE_SEARCH_UPDATED, [this.visible, this.searchQuery]);
  }

  hide(): void {
    this.visible = false;
    this.emit(EVENT_INLINE_SEARCH_UPDATED, [this.visible, this.searchQuery]);
  }

  private async updateSearchResults(): Promise<void> {
    this.searchResults = await this.searchIndex.search(this.searchQuery);
  }

  private getDefaultSearchQuery(editorDocumentUri: string): SearchQuery {
    return {
      phrase: '',
      isCaseSensitive: false,
      isWholeWordOnly: false,
      includedUris: [editorDocumentUri],
      includeGlobs: [],
      excludeGlobs: [],
    };
  }
}
