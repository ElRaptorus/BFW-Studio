import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import { selectStartEvents } from '../eventDefUtils';
import { getIterationCount, getLoopType } from '../loopUtils';
import type { Behavior } from './index';

export class SubProcessBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    const loopType = getLoopType(element);

    if (loopType === 'parallel') {
      this.enterParallel(element, scope, engine);
      return;
    }

    if ((loopType === 'sequential' || loopType === 'loop') && !scope.hasLoopCounter(element.id)) {
      scope.setLoopCounter(element.id, 0);
    }

    this.enterSingle(element, scope, engine);
  }

  exit(element: any, scope: Scope, engine: SimulationEngine): void {
    const loopType = getLoopType(element);

    if (loopType === 'parallel') {
      scope.incrementParallelMiCompleted(element.id);
      if (!scope.isParallelMiComplete(element.id)) {
        return;
      }
      scope.resetParallelMi(element.id);
      engine.routeToOutgoing(element, scope);
      return;
    }

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
      if (this.isCollapsed(element)) {
        this.scheduleParallelCollapsedBatch(element, scope, engine);
      } else {
        this.startParallelExpandedScopes(element, scope, engine);
      }
      return;
    }

    engine.exit(element, scope);
  }

  /** Runs a collapsed subprocess as a black-box delay, or waits for the user in step mode. */
  protected enterCollapsed(element: any, scope: Scope, engine: SimulationEngine): void {
    if (engine.mode === 'step') {
      engine.signalWaiting(element, scope);
    } else {
      engine.scheduleElementDelay(
        element,
        scope,
        () => {
          engine.exit(element, scope);
        },
        engine.getTaskDelay() * 2,
      );
    }
  }

  private enterSingle(element: any, scope: Scope, engine: SimulationEngine): void {
    if (this.isCollapsed(element)) {
      this.enterCollapsed(element, scope, engine);
      return;
    }

    const startEvents = selectStartEvents(element);
    if (startEvents.length === 0) {
      engine.exit(element, scope);
      return;
    }

    const childScope = engine.createScope(element, scope);
    for (const startEvent of startEvents) {
      engine.enter(startEvent, childScope);
    }
  }

  private enterParallel(element: any, scope: Scope, engine: SimulationEngine): void {
    if (engine.mode === 'step') {
      engine.signalWaiting(element, scope);
      return;
    }

    if (this.isCollapsed(element)) {
      this.scheduleParallelCollapsedBatch(element, scope, engine);
    } else {
      this.startParallelExpandedScopes(element, scope, engine);
    }
  }

  private startParallelExpandedScopes(element: any, scope: Scope, engine: SimulationEngine): void {
    const iterationCount = getIterationCount(element, engine);
    const startEvents = selectStartEvents(element);

    scope.setParallelMiExpected(element.id, iterationCount);

    for (let i = 1; i < iterationCount; i++) {
      scope.addToken(element.id);
    }

    for (let i = 0; i < iterationCount; i++) {
      const childScope = engine.createScope(element, scope);
      for (const startEvent of startEvents) {
        engine.enter(startEvent, childScope);
      }
    }
  }

  private scheduleParallelCollapsedBatch(element: any, scope: Scope, engine: SimulationEngine): void {
    const iterationCount = getIterationCount(element, engine);
    let completed = 0;

    for (let i = 0; i < iterationCount; i++) {
      const delay = engine.getTaskDelay() * 2 * (1 + Math.random() * 0.5);
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

  protected isCollapsed(element: any): boolean {
    if (element.collapsed === true) {
      return true;
    }
    if (element.di?.isExpanded === false) {
      return true;
    }
    return false;
  }
}
