import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import {
  getMessageFlows,
  hasEventDefinition,
  isErrorEvent,
  isEscalationEvent,
  isMessageEvent,
  isSignalEvent,
  isTerminateEvent,
} from '../eventDefUtils';
import type { Behavior } from './index';

export class EndEventBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    if (isTerminateEvent(element)) {
      if (scope.parent) {
        scope.destroy();
        engine.exit(scope.element, scope.parent);
      } else {
        scope.destroy();
        engine.signalTerminated(scope);
      }
      return;
    }

    if (isErrorEvent(element)) {
      if (scope.parent) {
        const errorBoundary = this.findBoundaryEvent(scope, 'bpmn:ErrorEventDefinition');
        if (errorBoundary) {
          scope.destroy();
          engine.routeToOutgoing(errorBoundary, scope.parent);
        } else {
          engine.tryCompleteScope(scope);
        }
      } else {
        scope.destroy();
        engine.signalErrorTerminated(scope, element);
      }
      return;
    }

    if (isEscalationEvent(element)) {
      if (scope.parent) {
        const escalationBoundary = this.findBoundaryEvent(scope, 'bpmn:EscalationEventDefinition');
        if (escalationBoundary) {
          const isInterrupting = escalationBoundary.businessObject?.cancelActivity !== false;
          if (isInterrupting) {
            scope.destroy();
            engine.routeToOutgoing(escalationBoundary, scope.parent);
          } else {
            engine.routeToOutgoing(escalationBoundary, scope.parent);
            engine.tryCompleteScope(scope);
          }
        } else {
          engine.tryCompleteScope(scope);
        }
      } else {
        engine.tryCompleteScope(scope);
      }
      return;
    }

    if (isMessageEvent(element)) {
      engine.emitMessageSend(element, scope, getMessageFlows(element));
      engine.tryCompleteScope(scope);
      return;
    }

    if (isSignalEvent(element)) {
      engine.broadcastSignal(element, scope);
      engine.tryCompleteScope(scope);
      return;
    }

    engine.tryCompleteScope(scope);
  }

  private findBoundaryEvent(scope: Scope, eventDefinitionType: string): any | null {
    const subProcessElement = scope.element;
    if (!scope.parent) {
      return null;
    }

    const parentChildren: any[] = scope.parent.element?.children || [];
    return (
      parentChildren.find((child: any) => {
        if (child.type !== 'bpmn:BoundaryEvent') {
          return false;
        }
        const attachedTo = child.businessObject?.attachedToRef;
        if (!attachedTo || attachedTo.id !== subProcessElement.businessObject?.id) {
          return false;
        }
        return hasEventDefinition(child, eventDefinitionType);
      }) ?? null
    );
  }
}
