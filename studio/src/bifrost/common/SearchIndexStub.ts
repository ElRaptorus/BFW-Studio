import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import type { ISearchIndexerClient, SearchQuery, SearchResult } from '#bifrost/contracts/internal/SearchTypes';

/**
 * We use this stub as the default, so that we can create a non-searchable Bifrost instance with `Bifrost.create()`
 * which does not rely on the WebWorker interface.
 *
 * The "real" `SearchIndex` is set in the entrypoints of the webapp and the Electron app.
 */
export class SearchIndexStub extends AbstractEmitter {
  clearIndex(): void {}
  clearIndexByUri(_uri: string): void {}
  clearIndexBySolutionUri(_solutionUri: string): void {}
  async index(_uri: string, _documentType: string, _currentData: string): Promise<void> {}
  async search(_searchQuery: SearchQuery): Promise<SearchResult[]> {
    return [];
  }

  registerSearchIndexerWorkerClient(_documentType: string, _searchIndexerClient: ISearchIndexerClient): void {}
  registerSearchResultFilter(_documentType: string, _filterFn: (searchResult: SearchResult) => boolean): void {}
}
