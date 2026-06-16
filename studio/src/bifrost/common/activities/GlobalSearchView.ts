import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import type {
  SearchQuery,
  SearchResult,
  SearchResultsByUri,
  SearchSerialized,
  SearchViewData,
} from '../../../../../studio-sdk/src/contracts/internal/SearchTypes';
import type { ISerializable } from '../../contracts/SerializableTypes';

export const EVENT_GLOBAL_SEARCH_FOCUS_AND_SELECT = 'EVENT_GLOBAL_SEARCH_FOCUS_AND_SELECT';
export const EVENT_GLOBAL_SEARCH_UPDATED = 'EVENT_GLOBAL_SEARCH_UPDATED';
export const EVENT_GLOBAL_SEARCH_ITEM_CLICKED = 'EVENT_GLOBAL_SEARCH_ITEM_CLICKED';

interface ISearchIndex {
  search(...args: any[]): Promise<SearchResult[]>;
}

export class GlobalSearchView extends AbstractEmitter implements ISerializable {
  private searchQuery: SearchQuery;
  private searchResults: SearchResult[];
  private searchIndex: ISearchIndex;

  constructor(searchIndex: ISearchIndex) {
    super();
    this.searchIndex = searchIndex;
    this.searchQuery = {
      phrase: '',
      isCaseSensitive: false,
      isWholeWordOnly: false,
      includedUris: [],
      includeGlobs: [],
      excludeGlobs: [],
    };
    this.searchResults = [];
  }

  focusAndSelect(): void {
    this.emit(EVENT_GLOBAL_SEARCH_FOCUS_AND_SELECT, []);
  }

  refresh(): void {
    this.updateSearchResults().then(() => {
      this.emit(EVENT_GLOBAL_SEARCH_UPDATED);
    });
  }

  async search(phrase: string): Promise<void> {
    this.searchQuery.phrase = phrase;
    await this.updateSearchResults();
  }

  async setCaseSensitivity(isCaseSensitive: boolean): Promise<void> {
    this.searchQuery.isCaseSensitive = isCaseSensitive;
    await this.updateSearchResults();
  }

  async setWholeWordOnly(isWholeWordOnly: boolean): Promise<void> {
    this.searchQuery.isWholeWordOnly = isWholeWordOnly;
    await this.updateSearchResults();
  }

  async setIncludeGlobs(globs: string[]): Promise<void> {
    this.searchQuery.includeGlobs = globs;
    await this.updateSearchResults();
  }

  async setExcludeGlobs(globs: string[]): Promise<void> {
    this.searchQuery.excludeGlobs = globs;
    await this.updateSearchResults();
  }

  async setIncludedUris(uris: string[]): Promise<void> {
    this.searchQuery.includedUris = uris;
    await this.updateSearchResults();
  }

  private async updateSearchResults(): Promise<void> {
    if (this.searchQuery.phrase.trim() === '') {
      this.searchResults = [];
      return;
    }
    this.searchResults = await this.searchIndex.search(this.searchQuery);
  }

  getSearchResultsByUri(): SearchResultsByUri {
    const searchResultMap: SearchResultsByUri = {};
    this.searchResults.forEach((searchResult: SearchResult) => {
      if (searchResultMap[searchResult.uri] == null) {
        searchResultMap[searchResult.uri] = [];
      }
      searchResultMap[searchResult.uri].push(searchResult);
    });

    return searchResultMap;
  }

  open(searchResult: SearchResult): void {
    const eventName = this.getEventNameForOpeningSearchResults(searchResult.documentType);
    this.emit(eventName, [searchResult]);
  }

  onOpenSearchResult(documentType: string, openCallbackFn: (...args: any[]) => void): void {
    this.on(this.getEventNameForOpeningSearchResults(documentType), openCallbackFn);
  }

  deserialize(dump: any): void {
    const deepCopy = JSON.parse(JSON.stringify(dump));

    this.searchQuery = deepCopy.searchQuery;
    this.searchResults = deepCopy.searchResults;
  }

  serialize(): SearchSerialized {
    return { searchQuery: { ...this.searchQuery }, searchResults: this.searchResults };
  }

  getViewData(): SearchViewData {
    return this.serialize();
  }

  private getEventNameForOpeningSearchResults(documentType: string): string {
    return `${EVENT_GLOBAL_SEARCH_ITEM_CLICKED}:${documentType}`;
  }
}
