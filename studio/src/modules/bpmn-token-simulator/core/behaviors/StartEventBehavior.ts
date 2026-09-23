import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import { getEventDefinition } from '../eventDefUtils';
import type { Behavior } from './index';

export class StartEventBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    const timerDefinition = getEventDefinition(element, 'bpmn:TimerEventDefinition');
    if (
      element.type === 'bpmn:StartEvent' &&
      !scope.parent &&
      (timerDefinition?.timeDate != null || timerDefinition?.timeDuration != null)
    ) {
      engine.armWait({ kind: 'catch', element, scope, repeatable: false });
      return;
    }
    engine.exit(element, scope);
  }

  exit(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.routeToOutgoing(element, scope);
  }
}
