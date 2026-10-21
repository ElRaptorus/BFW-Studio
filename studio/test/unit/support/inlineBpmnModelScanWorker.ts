import type { BpmnModelScanRequest, BpmnModelScanResponse } from '#modules/bpmn-core/parseSolutionBpmnModel';
import { parseSolutionBpmnModel } from '#modules/bpmn-core/parseSolutionBpmnModel';
import { vi } from 'vitest';

type WorkerBehaviour = 'parse' | 'fail';

/**
 * Replaces the global `Worker` (absent in Node) with one that runs the real scan worker logic on the test thread.
 * Request and response pass through `structuredClone`, as they do between threads, so data that cannot cross a real
 * worker boundary fails here too. Loading the bundled worker and its error events are covered by integration tests.
 * Every request is recorded; `behaviour.current = 'fail'` makes the next worker report a load error instead.
 */
export function installInlineBpmnModelScanWorker() {
  const requests: BpmnModelScanRequest[] = [];
  const behaviour: { current: WorkerBehaviour } = { current: 'parse' };

  class InlineWorker {
    onmessage: ((event: { data: BpmnModelScanResponse }) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    onerror: ((event: { message: string }) => void) | null = null;
    readonly terminate = vi.fn();

    postMessage(message: BpmnModelScanRequest): void {
      const request = structuredClone(message);
      requests.push(request);
      const failing = behaviour.current === 'fail';
      queueMicrotask(() => {
        if (failing) {
          this.onerror?.({ message: 'The worker script could not be loaded.' });
          return;
        }
        const response: BpmnModelScanResponse = {
          requestId: request.requestId,
          entries: request.files.map(parseSolutionBpmnModel),
        };
        this.onmessage?.({ data: structuredClone(response) });
      });
    }
  }

  vi.stubGlobal('Worker', InlineWorker);
  return { requests, behaviour };
}
