import type { SymbolQuery, SymbolResult } from '../contracts/SymbolTypes';
import { AbstractWorkerClient } from './AbstractWorkerClient';

export class SymbolIndexWorkerClient extends AbstractWorkerClient {
  constructor() {
    const worker = new Worker(
      /* webpackChunkName: "SymbolIndexWorker" */ new URL('../webworker/SymbolIndexWorker.ts', import.meta.url),
    );
    super(worker);
  }

  clear(): void {
    this.invokeWithoutReturn('clear');
  }

  clearByUri(uri: string): void {
    this.invokeWithoutReturn('clearByUri', uri);
  }

  clearBySolutionUri(solutionUri: string): void {
    this.invokeWithoutReturn('clearBySolutionUri', solutionUri);
  }

  putIndexerResult(uri: string, documentType: string, indexerResult: any[]): void {
    this.invokeWithoutReturn('put', uri, documentType, indexerResult);
  }

  async getAll(query: SymbolQuery): Promise<SymbolResult[]> {
    const result = await this.invoke('getAll', query);

    return result;
  }
}
