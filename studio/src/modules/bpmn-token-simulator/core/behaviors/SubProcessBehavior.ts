import { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
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

  private enterSingle(element: any, scope: Scope, engine: SimulationEngine): void {
    const children: any[] = element.children || [];
    const startEvents = children.filter((child: any) => child.type === 'bpmn:StartEvent');

    if (startEvents.length === 0) {
      if (this.isCollapsed(element)) {
        if (engine.mode === 'step') {
          engine.signalWaiting(element, scope);
        } else {
          engine.scheduleDelay(() => {
            engine.exit(element, scope);
          }, engine.getTaskDelay() * 2);
        }
      } else {
        engine.exit(element, scope);
      }
      return;
    }

    if (this.isCollapsed(element)) {
      if (engine.mode === 'step') {
        engine.signalWaiting(element, scope);
      } else {
        engine.scheduleDelay(() => {
          engine.exit(element, scope);
        }, engine.getTaskDelay() * 2);
      }
      return;
    }

    const childScope = new Scope(element, scope);
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
    const children: any[] = element.children || [];
    const startEvents = children.filter((child: any) => child.type === 'bpmn:StartEvent');

    scope.setParallelMiExpected(element.id, iterationCount);

    for (let i = 1; i < iterationCount; i++) {
      scope.addToken(element.id);
    }

    for (let i = 0; i < iterationCount; i++) {
      const childScope = new Scope(element, scope);
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
      engine.scheduleDelay(() => {
        completed++;
        if (completed === iterationCount) {
          engine.exit(element, scope);
        }
      }, delay);
    }
  }

  private isCollapsed(element: any): boolean {
    if (element.collapsed === true) {
      return true;
    }
    if (element.di?.isExpanded === false) {
      return true;
    }
    return false;
  }
}
