export declare type SearchQuery = {
  phrase: string;
  isCaseSensitive: boolean;
  isWholeWordOnly: boolean;
  includedUris: string[];
};
/**
 * A `SearchIndexer` analyses a given document based on its given URI, type and data and breaks it down in indexer
 * results (which can be put in the search index).
 */
export interface ISearchIndexerClient {
  index(uri: string, documentType: string, currentData: string): Promise<SearchIndexerResult>;
}
/**
 * A `SearchIndex` manages documents, search indexers, their results and allows to perform a search on documents.
 */
export declare type SearchIndex = {
  clearIndex(): void;
  index(uri: string, documentType: string, currentData: string): Promise<void>;
  search(searchQuery: SearchQuery): Promise<SearchResult[]>;
  registerSearchIndexerWorkerClient(documentType: string, searchIndexerClient: ISearchIndexerClient): void;
  registerSearchResultFilter(documentType: string, filterFn: (...args: any[]) => any): void;
};
export declare type SearchIndexerResult = {
  readonly success: boolean;
  readonly result?: any[];
  readonly error?: any;
};
export declare type SearchResultsByUri = {
  [uri: string]: SearchResult[];
};
export declare type SearchResult = {
  readonly uri: string;
  /**
   * Type of the document containing the result, e.g. "bpmn"
   */
  readonly documentType: string;
  /**
   * Type of the result, e.g. "ScriptTask"
   */
  readonly type?: string;
  /**
   * Text to be displayed
   */
  readonly label: string;
  /**
   * The icon id for the icon to be displayed
   */
  readonly icon?: string;
  readonly prio1: string | string[];
  readonly prio2: string | string[];
  readonly prio3: string | string[];
  readonly rest: string | string[];
  /**
   * Allows you to embed data that is needed for navigating to the element inside the parent
   * e.g. the element's ID or anchor
   */
  readonly metadata?: any;
  /**
   * Added by the search algorythm before returning the result
   */
  readonly score?: number;
};
export declare type SearchViewData = {
  searchQuery: SearchQuery;
  searchResults: SearchResult[];
};
export declare type SearchSerialized = SearchViewData;
export declare type InlineSearchViewData = {
  visible: boolean;
  hasResults: boolean;
  currentResultIndex: number;
  maxResultIndex: number;
};
