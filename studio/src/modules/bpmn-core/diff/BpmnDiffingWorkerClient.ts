import { AbstractWorkerClient } from '#bifrost/browser/AbstractWorkerClient';

export default class BpmnDiffingWorkerClient extends AbstractWorkerClient {
  constructor() {
    const worker = new Worker(
      /* webpackChunkName: "BpmnDiffingWorker" */ new URL('./webworker/BpmnDiffingWorker.ts', import.meta.url),
    );
    super(worker);
  }

  async diff(xmlBefore: string, xmlAfter: string): Promise<any> {
    const result: any = await this.invoke('diff', xmlBefore, xmlAfter);

    return result;
  }
}
