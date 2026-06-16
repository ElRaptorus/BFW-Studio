import type { AbstractEmitter } from '../common/AbstractEmitter';

/**
 * A `SymbolIndexer` analyses a given document based on its given URI, type and data and breaks it down in indexer
 * results (which can be put in the search index).
 */
export interface ISymbolIndexerClient {
  index(uri: string, documentType: string, currentData: string): Promise<SymbolIndexerResult>;
}
/**
 * A `SymbolIndex` manages documents, search indexers, their results and allows to perform a search on documents.
 */
export declare type SymbolIndex = AbstractEmitter & {
  clearIndex(): void;
  index(uri: string, documentType: string, currentData: string): Promise<void>;
  getAll(symbolQuery: SymbolQuery): Promise<SymbolResult[]>;
  registerSymbolIndexerWorkerClient(documentType: string, searchIndexerClient: ISymbolIndexerClient): void;
  registerSymbolResultFilter(documentType: string, filterFn: (...args: any[]) => any): void;
  lock(lockReason?: string): void;
  unlock(): void;
};
export type SymbolQuery = {
  uris?: string[];
} & Partial<Record<Exclude<keyof SymbolResult, 'uri' | 'metadata' | 'extensions'>, string[] | string | null>> & {
    metadata?: Record<string, string[] | string | null>;
  };
export declare type SymbolIndexerResult = {
  readonly success: boolean;
  readonly result?: any[];
  readonly error?: any;
};
export declare type SymbolResultsByUri = {
  [uri: string]: SymbolResult[];
};
export declare type SymbolResult = {
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
   * The icon query for the icon to be displayed
   */
  readonly icon?: string;
  readonly metadata?: any;
  readonly id: string;
  readonly name?: string;
  readonly processId?: string;
  readonly definitionId?: string;
};
