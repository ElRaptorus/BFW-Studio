import type { ISearchIndexerClient, SearchQuery, SearchResult } from '../contracts/SearchTypes';
import { AbstractEmitter } from './AbstractEmitter';

/**
 * We use this stub as the default, so that we can create a non-searchable Studio instance with `Studio.create()`
 * which does not rely on the WebWorker interface.
 *
 * The "real" `SearchIndex` is set in the entrypoints of the webapp and the Electron app.
 */
export declare class SearchIndexStub extends AbstractEmitter {
  clearIndex(): void;
  index(uri: string, documentType: string, currentData: string): Promise<void>;
  search(searchQuery: SearchQuery): Promise<SearchResult[]>;
  registerSearchIndexerWorkerClient(documentType: string, searchIndexerClient: ISearchIndexerClient): void;
  registerSearchResultFilter(documentType: string, filterFn: (...args: any[]) => any): void;
}
