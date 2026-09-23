import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import { getIterationCount, getLoopType } from '../loopUtils';
import type { Behavior } from './index';

export class TaskBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine, viaFlow?: any): void {
    const loopType = getLoopType(element);

    if (loopType === 'parallel') {
      this.enterParallel(element, scope, engine);
      return;
    }

    if ((loopType === 'sequential' || loopType === 'loop') && !scope.hasLoopCounter(element.id)) {
      scope.setLoopCounter(element.id, 0);
    }

    const isReceiveTask = element.type === 'bpmn:ReceiveTask';
    if (isReceiveTask && viaFlow?.source?.type !== 'bpmn:EventBasedGateway') {
      engine.armWait({ kind: 'catch', element, scope, repeatable: false });
    } else if (engine.mode === 'step' && !isReceiveTask) {
      engine.signalWaiting(element, scope);
    } else {
      engine.scheduleElementDelay(
        element,
        scope,
        () => {
          engine.exit(element, scope);
        },
        engine.getTaskDelay(),
      );
    }
  }

  exit(element: any, scope: Scope, engine: SimulationEngine): void {
    if (element.type === 'bpmn:SendTask') {
      engine.deliverMessage(element, scope);
    }

    const loopType = getLoopType(element);

    if (loopType === 'sequential' || loopType === 'loop') {
      const iterationCount = getIterationCount(element, engine);
      const current = scope.incrementLoopCounter(element.id);
      if (current < iterationCount) {
        engine.enter(element, scope);
        return;
      }
      scope.resetLoopCounter(element.id);
    }

    engine.routeToOutgoing(element, scope);
  }

  signal(element: any, scope: Scope, engine: SimulationEngine): void {
    const loopType = getLoopType(element);
    if (loopType === 'parallel') {
      this.scheduleParallelBatch(element, scope, engine);
      return;
    }
    engine.exit(element, scope);
  }

  private enterParallel(element: any, scope: Scope, engine: SimulationEngine): void {
    if (engine.mode === 'step') {
      engine.signalWaiting(element, scope);
      return;
    }
    this.scheduleParallelBatch(element, scope, engine);
  }

  private scheduleParallelBatch(element: any, scope: Scope, engine: SimulationEngine): void {
    const iterationCount = getIterationCount(element, engine);
    let completed = 0;

    for (let i = 0; i < iterationCount; i++) {
      const delay = engine.getTaskDelay() * (1 + Math.random() * 0.5);
      engine.scheduleElementDelay(
        element,
        scope,
        () => {
          completed++;
          if (completed === iterationCount) {
            engine.exit(element, scope);
          }
        },
        delay,
      );
    }
  }
}
