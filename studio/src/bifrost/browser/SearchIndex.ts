import { EVENT_INDEX_UPDATED } from '#bifrost/contracts/internal/SearchEvents';
import type { ISearchIndexerClient, SearchQuery, SearchResult } from '#bifrost/contracts/internal/SearchTypes';

import { SearchIndexStub } from '../common/SearchIndexStub';
import { SearchIndexWorkerClient } from './SearchIndexWorkerClient';

const DEFAULT_FILTER_FN = (item: any): boolean => true;

export class SearchIndex extends SearchIndexStub {
  private searchIndexWorker: SearchIndexWorkerClient;
  private searchIndexerClientMap: { [name: string]: ISearchIndexerClient };
  private searchResultFilter: any;

  constructor() {
    super();
    this.searchIndexWorker = new SearchIndexWorkerClient();
    this.searchIndexerClientMap = {};
    this.searchResultFilter = {};
  }

  clearIndex(): void {
    this.searchIndexWorker.clear();
    this.emit(EVENT_INDEX_UPDATED);
  }

  clearIndexByUri(uri: string): void {
    this.searchIndexWorker.clearByUri(uri);
    this.emit(EVENT_INDEX_UPDATED);
  }

  clearIndexBySolutionUri(solutionUri: string): void {
    this.searchIndexWorker.clearBySolutionUri(solutionUri);
    this.emit(EVENT_INDEX_UPDATED);
  }

  async index(uri: string, documentType: string, currentData: string): Promise<void> {
    const searchIndexerClient = this.searchIndexerClientMap[documentType];
    if (searchIndexerClient == null) {
      return;
    }

    const searchIndexerResult = await searchIndexerClient.index(uri, documentType, currentData);
    const result = searchIndexerResult.result || [];

    if (searchIndexerResult.success) {
      this.searchIndexWorker.putIndexerResult(uri, documentType, result);
      this.emit(EVENT_INDEX_UPDATED);
    } else {
      console.warn(`searchIndexerClient could not index '${uri}':`, searchIndexerResult.error || '<no error given>');
    }
  }

  async search(searchQuery: SearchQuery): Promise<SearchResult[]> {
    const searchResults = await this.searchIndexWorker.search(searchQuery);

    const filteredSearchResults = searchResults.filter((searchResult: SearchResult) => {
      const filterFn = this.searchResultFilter[searchResult.documentType] || DEFAULT_FILTER_FN;

      return filterFn(searchResult);
    });

    return filteredSearchResults;
  }

  registerSearchIndexerWorkerClient(documentType: string, searchIndexerClient: ISearchIndexerClient): void {
    if (this.searchIndexerClientMap[documentType] != null) {
      throw new Error(`SearchIndexerClient already registered for document type: ${documentType}`);
    }

    this.searchIndexerClientMap[documentType] = searchIndexerClient;
  }

  registerSearchResultFilter(documentType: string, filterFn: (searchResult: SearchResult) => boolean): void {
    this.searchResultFilter[documentType] = filterFn;
  }
}
