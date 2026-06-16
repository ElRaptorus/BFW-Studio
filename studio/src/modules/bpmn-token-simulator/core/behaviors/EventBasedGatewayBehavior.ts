import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import type { Behavior } from './index';

export class EventBasedGatewayBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.emitTokenExit(element, scope);

    const outgoing: any[] = (element.outgoing || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
    const catchEvents = outgoing.map((flow: any) => flow.target).filter((target: any) => target != null);

    if (catchEvents.length === 0) {
      engine.tryCompleteScope(scope);
      return;
    }

    engine.signalEventBasedGateway(element, scope, catchEvents);
  }
}
