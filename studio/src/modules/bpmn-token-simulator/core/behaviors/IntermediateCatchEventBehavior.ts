import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import type { Behavior } from './index';

export class IntermediateCatchEventBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    if (engine.mode === 'step') {
      engine.signalWaiting(element, scope);
    } else {
      engine.scheduleDelay(() => {
        engine.exit(element, scope);
      }, engine.getTaskDelay());
    }
  }

  exit(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.routeToOutgoing(element, scope);
  }

  signal(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.exit(element, scope);
  }
}
