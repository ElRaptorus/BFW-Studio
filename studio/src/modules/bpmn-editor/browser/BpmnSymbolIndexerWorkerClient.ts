import { AbstractWorkerClient } from '#bifrost/browser/AbstractWorkerClient';
import type { SymbolIndexerResult } from '#bifrost/contracts/SymbolTypes';

export class BpmnSymbolIndexerWorkerClient extends AbstractWorkerClient {
  constructor() {
    const worker = new Worker(
      /* webpackChunkName: "BpmnSymbolIndexerWorker" */ new URL(
        '../webworker/BpmnSymbolIndexerWorker.ts',
        import.meta.url,
      ),
    );
    super(worker);
  }

  async index(uri: string, documentType: string, currentData: string): Promise<SymbolIndexerResult> {
    const result: SymbolIndexerResult = await this.invoke('index', uri, documentType, currentData);
    return result;
  }
}
