import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import { hasUpstreamToken, selectInclusiveFlows } from '../graphUtils';
import type { Behavior } from './index';

export class InclusiveGatewayBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine, viaFlow?: any): void {
    const incoming = this.getIncomingFlows(element);
    const outgoing = this.getOutgoingFlows(element);

    if (incoming.length <= 1) {
      this.fork(element, scope, engine, outgoing);
      return;
    }

    if (viaFlow) {
      scope.addSatisfiedJoinFlow(element.id, viaFlow.id);
    }
    this.tryJoin(element, scope, engine, incoming, outgoing);
  }

  signal(element: any, scope: Scope, engine: SimulationEngine, data?: any): void {
    const chosenFlows: any[] = data?.chosenFlows;
    if (!chosenFlows || chosenFlows.length === 0) {
      return;
    }

    engine.emitTokenExit(element, scope, 1);
    for (const flow of chosenFlows) {
      engine.animateFlow(flow, scope, () => {
        engine.enter(flow.target, scope, flow);
      });
    }
  }

  /** Routes one token of the gateway; every other token stays on it. */
  fork(element: any, scope: Scope, engine: SimulationEngine, outgoing: any[]): void {
    if (outgoing.length === 0) {
      engine.consumeToken(element, scope);
      return;
    }

    if (outgoing.length === 1) {
      engine.exit(element, scope);
      return;
    }

    if (engine.mode === 'auto') {
      let cancelled = false;
      const timerId = engine.scheduleElementDelay(
        element,
        scope,
        () => {
          if (cancelled) {
            return;
          }
          engine.emitTokenExit(element, scope, 1);
          for (const flow of selectInclusiveFlows(element, outgoing)) {
            engine.animateFlow(flow, scope, () => {
              engine.enter(flow.target, scope, flow);
            });
          }
        },
        engine.getTaskDelay(),
      );

      const cancel = () => {
        cancelled = true;
        engine.cancelDelay(timerId);
      };

      engine.signalInclusiveGatewayAuto(element, scope, outgoing, cancel);
    } else {
      engine.signalInclusiveGatewayChoice(element, scope, outgoing);
    }
  }

  private tryJoin(element: any, scope: Scope, engine: SimulationEngine, incoming: any[], outgoing: any[]): void {
    const arrivals = scope.getSatisfiedJoinFlows(element.id);
    if (arrivals.length === 0) {
      return;
    }

    const unsatisfied = incoming.filter((incomingFlow: any) => !arrivals.includes(incomingFlow.id));
    if (unsatisfied.some((incomingFlow: any) => hasUpstreamToken(incomingFlow, scope, element.id))) {
      engine.scheduleDelay(() => {
        if (scope.state === 'running') {
          this.tryJoin(element, scope, engine, incoming, outgoing);
        }
      }, 500);
      return;
    }

    const consumedArrivals = scope.consumeSatisfiedJoinFlows(element.id);
    for (let i = 1; i < consumedArrivals; i++) {
      scope.removeToken(element.id);
    }
    this.fork(element, scope, engine, outgoing);
    this.tryJoin(element, scope, engine, incoming, outgoing);
  }

  private getIncomingFlows(element: any): any[] {
    return (element.incoming || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
  }

  private getOutgoingFlows(element: any): any[] {
    return (element.outgoing || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
  }
}
