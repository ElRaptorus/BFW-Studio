import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import { hasUpstreamToken } from '../graphUtils';
import type { Behavior } from './index';

export class InclusiveGatewayBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine, viaFlow?: any): void {
    const incoming = this.getIncomingFlows(element);
    const outgoing = this.getOutgoingFlows(element);

    const isFork = incoming.length <= 1;
    const isJoin = incoming.length > 1;

    if (isFork || (!isJoin && outgoing.length > 0)) {
      this.handleFork(element, scope, engine, outgoing);
      return;
    }

    if (viaFlow) {
      scope.addSatisfiedJoinFlow(element.id, viaFlow.id);
    }

    const satisfied = scope.getSatisfiedJoinFlows(element.id);
    const allSatisfied = incoming.every((incomingFlow: any) => satisfied.has(incomingFlow.id));

    if (allSatisfied) {
      scope.resetSatisfiedJoinFlows(element.id);
      this.handleFork(element, scope, engine, outgoing);
      return;
    }

    const unsatisfied = incoming.filter((incomingFlow: any) => !satisfied.has(incomingFlow.id));
    const anyReachable = unsatisfied.some((incomingFlow: any) => hasUpstreamToken(incomingFlow, scope, element.id));

    if (!anyReachable) {
      if (engine.isEngineIdle()) {
        scope.resetSatisfiedJoinFlows(element.id);
        this.handleFork(element, scope, engine, outgoing);
      } else {
        this.waitForJoin(element, scope, engine, outgoing, incoming);
      }
    } else {
      this.waitForJoin(element, scope, engine, outgoing, incoming);
    }
  }

  signal(element: any, scope: Scope, engine: SimulationEngine, data?: any): void {
    const chosenFlows: any[] = data?.chosenFlows;
    if (!chosenFlows || chosenFlows.length === 0) {
      return;
    }

    const flowIds = new Set(chosenFlows.map((chosenFlow: any) => chosenFlow.id));
    scope.setActivatedBranches(element.id, flowIds);

    engine.emitTokenExit(element, scope);
    for (const flow of chosenFlows) {
      engine.animateFlow(flow, scope, () => {
        engine.enter(flow.target, scope, flow);
      });
    }
  }

  private waitForJoin(element: any, scope: Scope, engine: SimulationEngine, outgoing: any[], incoming: any[]): void {
    engine.scheduleDelay(
      () => {
        if (scope.state !== 'running') {
          return;
        }

        const satisfied = scope.getSatisfiedJoinFlows(element.id);
        if (satisfied.size === 0) {
          return;
        }

        const allSatisfied = incoming.every((incomingFlow: any) => satisfied.has(incomingFlow.id));
        if (allSatisfied) {
          scope.resetSatisfiedJoinFlows(element.id);
          this.handleFork(element, scope, engine, outgoing);
          return;
        }

        const unsatisfied = incoming.filter((incomingFlow: any) => !satisfied.has(incomingFlow.id));
        const anyReachable = unsatisfied.some((incomingFlow: any) => hasUpstreamToken(incomingFlow, scope, element.id));

        if (!anyReachable && engine.isEngineIdle()) {
          scope.resetSatisfiedJoinFlows(element.id);
          this.handleFork(element, scope, engine, outgoing);
        } else {
          this.waitForJoin(element, scope, engine, outgoing, incoming);
        }
      },
      500,
      true,
    );
  }

  private handleFork(element: any, scope: Scope, engine: SimulationEngine, outgoing: any[]): void {
    if (outgoing.length === 0) {
      engine.emitTokenExit(element, scope);
      engine.tryCompleteScope(scope);
      return;
    }

    if (outgoing.length === 1) {
      engine.exit(element, scope);
      return;
    }

    if (engine.mode === 'auto') {
      const flowIds = new Set(outgoing.map((outgoingFlow: any) => outgoingFlow.id));
      scope.setActivatedBranches(element.id, flowIds);

      let cancelled = false;
      const timerId = engine.scheduleDelay(() => {
        if (cancelled) {
          return;
        }
        engine.emitTokenExit(element, scope);
        for (const flow of outgoing) {
          engine.animateFlow(flow, scope, () => {
            engine.enter(flow.target, scope, flow);
          });
        }
      }, engine.getTaskDelay());

      const cancel = () => {
        cancelled = true;
        engine.cancelDelay(timerId);
      };

      engine.signalInclusiveGatewayAuto(element, scope, outgoing, cancel);
    } else {
      engine.signalInclusiveGatewayChoice(element, scope, outgoing);
    }
  }

  private getIncomingFlows(element: any): any[] {
    return (element.incoming || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
  }

  private getOutgoingFlows(element: any): any[] {
    return (element.outgoing || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
  }
}
