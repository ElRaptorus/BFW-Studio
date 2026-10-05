import type { SimulationOutcome, SimulationRequest } from '../core/types';

const SIMULATION_TIMEOUT_MILLISECONDS = 5000;

/**
 * Runs simulations in a module worker so a runaway FEEL expression cannot freeze the editor.
 * One evaluation at a time: the controller refuses to start a run while another is in flight.
 */
export class DmnSimulationWorkerClient {
  private worker: Worker | null = null;

  evaluate(request: SimulationRequest): Promise<SimulationOutcome> {
    return new Promise((resolve) => {
      const worker = (this.worker ??= new Worker(new URL('./dmn-simulation-worker.ts', import.meta.url), {
        type: 'module',
      }));
      const failWith = (code: string, message: string): void => {
        clearTimeout(timeoutHandle);
        worker.terminate();
        if (this.worker === worker) {
          this.worker = null;
        }
        resolve({ ok: false, error: { code, message }, steps: [] });
      };
      const timeoutHandle = setTimeout(
        () =>
          failWith(
            'simulation_timeout',
            `The simulation did not finish within ${SIMULATION_TIMEOUT_MILLISECONDS / 1000} seconds.`,
          ),
        SIMULATION_TIMEOUT_MILLISECONDS,
      );
      worker.onmessage = (event: MessageEvent<SimulationOutcome>): void => {
        clearTimeout(timeoutHandle);
        resolve(event.data);
      };
      worker.onmessageerror = (): void =>
        failWith('simulation_worker_error', 'The simulation result could not be read.');
      worker.onerror = (event): void =>
        failWith('simulation_worker_error', event.message ?? 'The simulation worker failed.');
      try {
        worker.postMessage(request);
      } catch (error) {
        failWith('simulation_worker_error', error instanceof Error ? error.message : String(error));
      }
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
