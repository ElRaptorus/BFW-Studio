import { AbstractWorkerClient } from '#bifrost/browser/AbstractWorkerClient';

import type { SearchIndexerResult } from '../../../../../studio-sdk/src/contracts/internal/SearchTypes';

export class DmnSearchIndexerWorkerClient extends AbstractWorkerClient {
  constructor() {
    const worker = new Worker(
      /* webpackChunkName: "DmnSearchIndexerWorker" */ new URL(
        '../webworker/DmnSearchIndexerWorker.ts',
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
