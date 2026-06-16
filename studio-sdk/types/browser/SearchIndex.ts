import { SearchIndexStub } from '../common/SearchIndexStub';
import type { ISearchIndexerClient, SearchQuery, SearchResult } from '../contracts/SearchTypes';

export declare class SearchIndex extends SearchIndexStub {
  clearIndex(): void;
  index(uri: string, documentType: string, currentData: string): Promise<void>;
  search(searchQuery: SearchQuery): Promise<SearchResult[]>;
  registerSearchIndexerWorkerClient(documentType: string, searchIndexerClient: ISearchIndexerClient): void;
  registerSearchResultFilter(documentType: string, filterFn: (...args: any[]) => any): void;
}
