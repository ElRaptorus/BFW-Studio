import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import { findComplexRegion } from '../graphUtils';
import { InclusiveGatewayBehavior } from './InclusiveGatewayBehavior';

export class ComplexGatewayBehavior extends InclusiveGatewayBehavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    const incoming = (element.incoming || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');

    if (incoming.length <= 1) {
      this.fork(
        element,
        scope,
        engine,
        (element.outgoing || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow'),
      );
      return;
    }

    if (scope.incrementJoinCounter(element.id) < engine.getComplexJoinThreshold(element)) {
      return;
    }

    engine.emitTokenExit(element, scope);
    engine.routeToOutgoing(element, scope);
    engine.interruptRegion(scope, findComplexRegion(element));
    scope.resetJoinCounter(element.id);
  }
}
