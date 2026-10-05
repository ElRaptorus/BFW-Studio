import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SimulationRequest } from '../../../src/modules/dmn-decision-simulator/core/types';
import { DmnSimulationWorkerClient } from '../../../src/modules/dmn-decision-simulator/worker/DmnSimulationWorkerClient';

describe('DmnSimulationWorkerClient', () => {
  const workers: FakeWorker[] = [];

  class FakeWorker {
    static postMessageError: Error | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: ((event: { message?: string }) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    readonly terminate = vi.fn();
    constructor() {
      workers.push(this);
    }
    postMessage(): void {
      if (FakeWorker.postMessageError != null) {
        throw FakeWorker.postMessageError;
      }
    }
  }

  afterEach(() => {
    workers.length = 0;
    FakeWorker.postMessageError = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const request = {} as SimulationRequest;

  it('resolves a failure when postMessage throws', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.postMessageError = new Error('not cloneable');
    const outcome = await new DmnSimulationWorkerClient().evaluate(request);

    expect(!outcome.ok && outcome.error).toEqual({ code: 'simulation_worker_error', message: 'not cloneable' });
    expect(workers[0].terminate).toHaveBeenCalled();
  });

  it('resolves a failure on messageerror', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const pending = new DmnSimulationWorkerClient().evaluate(request);
    workers[0].onmessageerror?.();

    expect(!(await pending).ok).toBe(true);
  });

  it('times out and creates a fresh worker for the next run', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', FakeWorker);
    const client = new DmnSimulationWorkerClient();
    const first = client.evaluate(request);
    await vi.advanceTimersByTimeAsync(5000);
    expect(!(await first).ok).toBe(true);

    void client.evaluate(request);
    expect(workers).toHaveLength(2);
    // A late error of the first worker must not dispose the second one.
    workers[0].onerror?.({ message: 'late' });
    expect(workers[1].terminate).not.toHaveBeenCalled();
  });
});
