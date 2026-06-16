import type { SearchQuery, SearchResult } from '../../../../studio-sdk/src/contracts/internal/SearchTypes';
import { AbstractWorkerClient } from './AbstractWorkerClient';

export class SearchIndexWorkerClient extends AbstractWorkerClient {
  constructor() {
    const worker = new Worker(
      /* webpackChunkName: "SearchIndexWorker" */ new URL('../webworker/SearchIndexWorker.ts', import.meta.url),
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

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const result = await this.invoke('search', query);

    return result;
  }
}
