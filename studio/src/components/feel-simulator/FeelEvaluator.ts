import type { EvalResult } from './types';

const EVAL_TIMEOUT_MS = 5000;

export class FeelEvaluator {
  private worker: Worker | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./feel-eval-worker.ts', import.meta.url), { type: 'module' });
    }
    return this.worker;
  }

  evaluate(expression: string, context: Record<string, unknown>): Promise<EvalResult> {
    return new Promise((resolve) => {
      const worker = this.ensureWorker();

      worker.onmessage = (event: MessageEvent): void => {
        if (this.timeoutId != null) {
          clearTimeout(this.timeoutId);
        }
        resolve(event.data as EvalResult);
      };

      worker.onerror = (err): void => {
        if (this.timeoutId != null) {
          clearTimeout(this.timeoutId);
        }
        resolve({ status: 'error', error: err.message ?? 'Worker error', elapsed: 0 });
      };

      this.timeoutId = setTimeout(() => {
        this.worker?.terminate();
        this.worker = null;
        resolve({ status: 'timeout', timeout: EVAL_TIMEOUT_MS });
      }, EVAL_TIMEOUT_MS);

      worker.postMessage({ expression, context });
    });
  }

  dispose(): void {
    if (this.timeoutId != null) {
      clearTimeout(this.timeoutId);
    }
    this.worker?.terminate();
    this.worker = null;
  }
}
