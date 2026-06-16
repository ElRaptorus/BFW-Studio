import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import type { Behavior } from './index';

export class ExclusiveGatewayBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    const outgoing = this.getOutgoingFlows(element);

    if (outgoing.length <= 1) {
      engine.exit(element, scope);
      return;
    }

    if (engine.mode === 'auto') {
      const defaultFlow = this.getDefaultFlow(element, outgoing);
      const chosenFlow = defaultFlow || outgoing[0];

      let cancelled = false;
      const timerId = engine.scheduleDelay(() => {
        if (cancelled) {
          return;
        }
        engine.emitTokenExit(element, scope);
        engine.animateFlow(chosenFlow, scope, () => {
          engine.enter(chosenFlow.target, scope, chosenFlow);
        });
      }, engine.getTaskDelay());

      const cancel = () => {
        cancelled = true;
        engine.cancelDelay(timerId);
      };

      engine.signalGatewayAuto(element, scope, outgoing, chosenFlow, cancel);
    } else {
      engine.signalGatewayChoice(element, scope, outgoing);
    }
  }

  exit(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.routeToOutgoing(element, scope);
  }

  signal(element: any, scope: Scope, engine: SimulationEngine, data?: any): void {
    const chosenFlow = data?.chosenFlow;
    if (chosenFlow) {
      engine.emitTokenExit(element, scope);
      engine.animateFlow(chosenFlow, scope, () => {
        engine.enter(chosenFlow.target, scope, chosenFlow);
      });
    }
  }

  private getOutgoingFlows(element: any): any[] {
    return (element.outgoing || []).filter((conn: any) => conn.type === 'bpmn:SequenceFlow');
  }

  private getDefaultFlow(element: any, outgoing: any[]): any | null {
    const defaultFlowRef = element.businessObject?.default;
    if (!defaultFlowRef) {
      return null;
    }
    return outgoing.find((flow: any) => flow.businessObject?.id === defaultFlowRef.id) ?? null;
  }
}
