import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import { isConditionalEvent, isMessageEvent, isSignalEvent, isTimerEvent } from '../eventDefUtils';
import type { Behavior } from './index';

export class IntermediateCatchEventBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine, viaFlow?: any): void {
    if (viaFlow?.source?.type === 'bpmn:EventBasedGateway') {
      engine.scheduleElementDelay(element, scope, () => engine.exit(element, scope), engine.getTaskDelay());
    } else if (
      isMessageEvent(element) ||
      isSignalEvent(element) ||
      isTimerEvent(element) ||
      isConditionalEvent(element)
    ) {
      engine.armWait({ kind: 'catch', element, scope, repeatable: false });
    } else {
      engine.exit(element, scope);
    }
  }

  exit(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.routeToOutgoing(element, scope);
  }
}
