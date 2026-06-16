import type { SearchIndexStub } from '../../../types/common';

export type SearchQuery = {
  phrase: string;
  isCaseSensitive: boolean;
  isWholeWordOnly: boolean;
  includedUris: string[];
  includeGlobs: string[];
  excludeGlobs: string[];
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
export interface ISearchIndex extends SearchIndexStub {
  clearIndex(): void;

  clearIndexByUri(uri: string): void;

  clearIndexBySolutionUri(solutionUri: string): void;

  index(uri: string, documentType: string, currentData: string): Promise<void>;

  search(searchQuery: SearchQuery): Promise<SearchResult[]>;

  registerSearchIndexerWorkerClient(documentType: string, searchIndexerClient: ISearchIndexerClient): void;

  registerSearchResultFilter(documentType: string, filterFn: (...args: any[]) => any): void;
}

export type SearchIndexerResult = {
  readonly success: boolean;
  readonly result?: any[];
  readonly error?: any;
};

export type SearchResultsByUri = { [uri: string]: SearchResult[] };

export type SearchResult = {
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

  // `prio1`, `prio2`, `prio3` and `rest` are generic fields of indexed values in weighted, descending order.
  //
  // prio1 being the most important field of indexed data.
  // Data that is important, but slightly less so than that in prio1 can be put in prio2.
  // `prio3` is defined accordingly.
  //
  // `rest` is the least important indexed data
  // you put data here that should be found, but hits on this field are less relevant than
  // hits on the other fields.
  //
  // Example:
  //
  // If we were to write an indexer for programmer oriented Markdown files, we could
  // place the '#' headings in prio1 and the '##' headings in `prio2`. Since we said
  // it's programmer-oriented, we could place all code-blocks in `prio3` and the rest
  // of the document in `rest`.
  // This way, a hit in a headline counts more than in code, but a hit in code counts
  // more than in the text body of the document (which we suppose is what we want).
  //
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

export type SearchViewData = {
  searchQuery: SearchQuery;
  searchResults: SearchResult[];
};

// the serialized data that goes into storage is the same as the data handed to the view (for now)
// but these are two conceptually different things, which is why we alias them here
export type SearchSerialized = SearchViewData;

export type InlineSearchViewData = {
  visible: boolean;
  hasResults: boolean;
  currentResultIndex: number;
  maxResultIndex: number;
};
