import type { SimulationEngine } from './SimulationEngine';

export type LoopType = 'parallel' | 'sequential' | 'loop' | null;

export function getLoopType(element: any): LoopType {
  const lc = element.businessObject?.loopCharacteristics;
  if (!lc) {
    return null;
  }

  if (lc.$type === 'bpmn:MultiInstanceLoopCharacteristics') {
    return lc.isSequential ? 'sequential' : 'parallel';
  }
  if (lc.$type === 'bpmn:StandardLoopCharacteristics') {
    return 'loop';
  }
  return null;
}

export function getIterationCount(element: any, engine: SimulationEngine): number {
  return engine.getMultiInstanceCount(element.id);
}
