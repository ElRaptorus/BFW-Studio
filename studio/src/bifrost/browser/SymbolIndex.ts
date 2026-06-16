import { waitForAcceptance } from '@evil/bifrost_fw_sdk';

import { EVENT_SYMBOL_INDEX_UPDATED } from '../../../../studio-sdk/src/contracts/internal/SymbolEvents';
import { SymbolIndexStub } from '../common/SymbolIndexStub';
import type { ISymbolIndexerClient, SymbolQuery, SymbolResult } from '../contracts/SymbolTypes';
import { SymbolIndexWorkerClient } from './SymbolIndexWorkerClient';

const DEFAULT_FILTER_FN = (item: any): boolean => true;

export class SymbolIndex extends SymbolIndexStub {
  private locked: boolean;
  private lockReason: string | null | undefined;
  private symbolIndexWorker: SymbolIndexWorkerClient;
  private symbolIndexerClientMap: { [name: string]: ISymbolIndexerClient };
  private symbolResultFilter: any;

  constructor() {
    super();
    this.locked = false;
    this.lockReason = null;
    this.symbolIndexWorker = new SymbolIndexWorkerClient();
    this.symbolIndexerClientMap = {};
    this.symbolResultFilter = {};
  }

  lock(lockReason?: string): void {
    this.locked = true;
    this.lockReason = lockReason;
  }

  unlock(): void {
    this.locked = false;
    this.lockReason = null;
  }

  clearIndex(): void {
    this.symbolIndexWorker.clear();
    this.emit(EVENT_SYMBOL_INDEX_UPDATED);
  }

  clearIndexByUri(uri: string): void {
    this.symbolIndexWorker.clearByUri(uri);
    this.emit(EVENT_SYMBOL_INDEX_UPDATED);
  }

  clearIndexBySolutionUri(solutionUri: string): void {
    this.symbolIndexWorker.clearBySolutionUri(solutionUri);
    this.emit(EVENT_SYMBOL_INDEX_UPDATED);
  }

  async index(uri: string, documentType: string, currentData: string): Promise<void> {
    const wasLockedBefore = this.locked;
    if (!wasLockedBefore) {
      this.lock('indexing document: ${uri}');
    }

    try {
      this.doIndex(uri, documentType, currentData);
    } catch (e) {
      console.error(e);
    }

    if (!wasLockedBefore) {
      this.unlock();
    }
  }

  async getAll(symbolQuery: SymbolQuery): Promise<SymbolResult[]> {
    if (this.locked) {
      await waitForAcceptance(
        () => !this.locked,
        `SymbolIndex did not unlock (was locked with reason '${this.lockReason || '<no reason given>'}').`,
      );
    }

    const symbolResults = await this.symbolIndexWorker.getAll(symbolQuery);

    const filteredSymbolResults = symbolResults.filter((symbolResult: SymbolResult) => {
      const filterFn = this.symbolResultFilter[symbolResult.documentType] || DEFAULT_FILTER_FN;

      return filterFn(symbolResult);
    });

    return filteredSymbolResults;
  }

  registerSymbolIndexerWorkerClient(documentType: string, symbolIndexerClient: ISymbolIndexerClient): void {
    if (this.symbolIndexerClientMap[documentType] != null) {
      throw new Error(`SymbolIndexerClient already registered for document type: ${documentType}`);
    }

    this.symbolIndexerClientMap[documentType] = symbolIndexerClient;
  }

  registerSymbolResultFilter(documentType: string, filterFn: (symbolResult: SymbolResult) => boolean): void {
    this.symbolResultFilter[documentType] = filterFn;
  }

  private async doIndex(uri: string, documentType: string, currentData: string): Promise<void> {
    const symbolIndexerClient = this.symbolIndexerClientMap[documentType];
    if (symbolIndexerClient == null) {
      return;
    }

    const symbolIndexerResult = await symbolIndexerClient.index(uri, documentType, currentData);
    const result = symbolIndexerResult.result || [];

    if (symbolIndexerResult.success) {
      this.symbolIndexWorker.putIndexerResult(uri, documentType, result);
      this.emit(EVENT_SYMBOL_INDEX_UPDATED);
    } else {
      console.warn(`symbolIndexerClient could not index '${uri}':`, symbolIndexerResult.error || '<no error given>');
    }
  }
}
