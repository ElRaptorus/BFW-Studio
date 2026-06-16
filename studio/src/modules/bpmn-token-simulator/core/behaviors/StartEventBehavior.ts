import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import type { Behavior } from './index';

export class StartEventBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.exit(element, scope);
  }

  exit(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.routeToOutgoing(element, scope);
  }
}
