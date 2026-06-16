import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import type { Behavior } from './index';

export class ParallelGatewayBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    const incoming = this.getIncomingFlows(element);
    const outgoing = this.getOutgoingFlows(element);

    const isFork = incoming.length <= 1;
    const isJoin = incoming.length > 1;

    if (isFork || (!isJoin && outgoing.length > 0)) {
      this.fork(element, scope, engine, outgoing);
      return;
    }

    // Join: wait until all incoming tokens have arrived
    const arrivedCount = scope.incrementJoinCounter(element.id);
    if (arrivedCount >= incoming.length) {
      scope.resetJoinCounter(element.id);
      this.fork(element, scope, engine, outgoing);
    }
  }

  private fork(element: any, scope: Scope, engine: SimulationEngine, outgoing: any[]): void {
    engine.emitTokenExit(element, scope);

    if (outgoing.length === 0) {
      engine.tryCompleteScope(scope);
      return;
    }

    for (const connection of outgoing) {
      engine.animateFlow(connection, scope, () => {
        engine.enter(connection.target, scope, connection);
      });
    }
  }

  private getIncomingFlows(element: any): any[] {
    return (element.incoming || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
  }

  private getOutgoingFlows(element: any): any[] {
    return (element.outgoing || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
  }
}
