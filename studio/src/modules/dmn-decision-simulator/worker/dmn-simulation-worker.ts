import { evaluateDmnSimulation } from '../core/evaluateDmnSimulation';
import type { SimulationRequest } from '../core/types';

self.onmessage = (event: MessageEvent<SimulationRequest>): void => {
  self.postMessage(evaluateDmnSimulation(event.data));
};
