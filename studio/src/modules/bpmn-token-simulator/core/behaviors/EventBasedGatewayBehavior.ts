import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import type { Behavior } from './index';

export class EventBasedGatewayBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    const outgoing: any[] = (element.outgoing || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
    const candidates = outgoing.map((flow: any) => flow.target).filter((target: any) => target != null);

    if (candidates.length === 0) {
      engine.consumeToken(element, scope);
      return;
    }

    engine.armWait({ kind: 'event-gateway', element, scope, candidates, repeatable: false });
  }
}
