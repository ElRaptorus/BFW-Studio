import type { ISymbolIndexerClient, SymbolQuery, SymbolResult } from '../contracts/SymbolTypes';
import { AbstractEmitter } from './AbstractEmitter';

/**
 * We use this stub as the default, so that we can create a non-searchable Studio instance with `Studio.create()`
 * which does not rely on the WebWorker interface.
 *
 * The "real" `SearchIndex` is set in the entrypoints of the webapp and the Electron app.
 */
export declare class SymbolIndexStub extends AbstractEmitter {
  clearIndex(): void;
  index(uri: string, documentType: string, currentData: string): Promise<void>;
  getAll(symbolQuery: SymbolQuery): Promise<SymbolResult[]>;
  registerSymbolIndexerWorkerClient(documentType: string, searchIndexerClient: ISymbolIndexerClient): void;
  registerSymbolResultFilter(documentType: string, filterFn: (...args: any[]) => any): void;
  lock(lockReason?: string): void;
  unlock(): void;
}
