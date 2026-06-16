import type { ISymbolIndexerClient, SymbolQuery, SymbolResult } from '../contracts';

export declare class SymbolIndex {
  lock(lockReason?: string): void;
  unlock(): void;
  clearIndex(): void;
  index(uri: string, documentType: string, currentData: string): Promise<void>;
  getAll(symbolQuery: SymbolQuery): Promise<SymbolResult[]>;
  registerSymbolIndexerWorkerClient(documentType: string, symbolIndexerClient: ISymbolIndexerClient): void;
  registerSymbolResultFilter(documentType: string, filterFn: (...args: any[]) => any): void;
}
