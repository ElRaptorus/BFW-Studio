import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';

import type { ISymbolIndexerClient, SymbolQuery, SymbolResult } from '../contracts/SymbolTypes';

/**
 * We use this stub as the default, so that we can create a non-searchable Bifrost instance with `Bifrost.create()`
 * which does not rely on the WebWorker interface.
 *
 * The "real" `SearchIndex` is set in the entrypoints of the webapp and the Electron app.
 */
export class SymbolIndexStub extends AbstractEmitter {
  clearIndex(): void {}

  clearIndexByUri(uri: string): void {}

  clearIndexBySolutionUri(solutionUri: string): void {}

  async index(uri: string, documentType: string, currentData: string): Promise<void> {}

  async getAll(symbolQuery: SymbolQuery): Promise<SymbolResult[]> {
    return [];
  }

  registerSymbolIndexerWorkerClient(documentType: string, searchIndexerClient: ISymbolIndexerClient): void {}

  registerSymbolResultFilter(documentType: string, filterFn: (symbolResult: SymbolResult) => boolean): void {}

  lock(lockReason?: string): void {}

  unlock(): void {}
}
