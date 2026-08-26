import { AbstractWorkerClient } from '#bifrost/browser/AbstractWorkerClient';
import type { SearchIndexerResult } from '#bifrost/contracts/internal/SearchTypes';

export class BpmnSearchIndexerWorkerClient extends AbstractWorkerClient {
  constructor() {
    const worker = new Worker(
      /* webpackChunkName: "BpmnSearchIndexerWorker" */ new URL(
        '../webworker/BpmnSearchIndexerWorker.ts',
        import.meta.url,
      ),
    );

    super(worker);
  }

  async index(uri: string, documentType: string, currentData: string): Promise<SearchIndexerResult> {
    const result: SearchIndexerResult = await this.invoke('index', uri, documentType, currentData);

    return result;
  }
}
