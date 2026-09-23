import type { SimulationEngine } from './SimulationEngine';
import { findBfwBody } from './eventDefUtils';

export type LoopType = 'parallel' | 'sequential' | 'loop' | null;

export function getLoopType(element: any): LoopType {
  const loopCharacteristics = element.businessObject?.loopCharacteristics;
  if (!loopCharacteristics) {
    return null;
  }

  if (loopCharacteristics.$type === 'bpmn:MultiInstanceLoopCharacteristics') {
    return loopCharacteristics.isSequential ? 'sequential' : 'parallel';
  }
  if (loopCharacteristics.$type === 'bpmn:StandardLoopCharacteristics') {
    return 'loop';
  }
  return null;
}

/** The user's iteration count, capped by `loopMaximum` (Standard Loop) or `bfw:MaxIterations` (multi-instance). */
export function getIterationCount(element: any, engine: SimulationEngine): number {
  const loopCharacteristics = element.businessObject?.loopCharacteristics;
  const maximum = Number.parseInt(
    String(
      getLoopType(element) === 'loop'
        ? loopCharacteristics.loopMaximum
        : findBfwBody(loopCharacteristics, 'MaxIterations'),
    ),
    10,
  );
  const count = engine.getMultiInstanceCount(element.id);
  // The element always runs once, so a cap below 1 still allows one iteration.
  return Number.isFinite(maximum) ? Math.min(count, Math.max(1, maximum)) : count;
}
