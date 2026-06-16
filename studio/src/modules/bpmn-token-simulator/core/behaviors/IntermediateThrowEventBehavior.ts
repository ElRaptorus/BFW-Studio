import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import {
  getLinkName,
  getMessageFlows,
  hasEventDefinition,
  isEscalationEvent,
  isLinkEvent,
  isMessageEvent,
  isSignalEvent,
} from '../eventDefUtils';
import type { Behavior } from './index';

export class IntermediateThrowEventBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    if (isLinkEvent(element)) {
      const name = getLinkName(element);
      const matchingCatch = name != null ? this.findMatchingLinkCatch(name, scope) : null;

      engine.emitTokenExit(element, scope);

      if (matchingCatch) {
        engine.enter(matchingCatch, scope);
      } else {
        engine.tryCompleteScope(scope);
      }
      return;
    }

    if (isMessageEvent(element)) {
      engine.emitMessageSend(element, scope, getMessageFlows(element));
      engine.exit(element, scope);
      return;
    }

    if (isSignalEvent(element)) {
      engine.broadcastSignal(element, scope);
      engine.exit(element, scope);
      return;
    }

    if (isEscalationEvent(element)) {
      this.handleEscalationThrow(element, scope, engine);
      engine.exit(element, scope);
      return;
    }

    engine.exit(element, scope);
  }

  exit(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.routeToOutgoing(element, scope);
  }

  private handleEscalationThrow(_element: any, scope: Scope, engine: SimulationEngine): void {
    if (!scope.parent) {
      return;
    }

    const boundary = this.findEscalationBoundary(scope);
    if (!boundary) {
      return;
    }

    const isInterrupting = boundary.businessObject?.cancelActivity !== false;
    const parentScope = scope.parent;
    const hostElement = scope.element;

    if (isInterrupting) {
      engine.scheduleDelay(() => {
        engine.cancelElement(hostElement, parentScope);
        const outgoing = (boundary.outgoing || []).filter((connection: any) => connection.type === 'bpmn:SequenceFlow');
        for (const connection of outgoing) {
          engine.animateFlow(connection, parentScope, () => {
            engine.enter(connection.target, parentScope, connection);
          });
        }
      }, 0);
    } else {
      const outgoing = (boundary.outgoing || []).filter((connection: any) => connection.type === 'bpmn:SequenceFlow');
      for (const connection of outgoing) {
        engine.animateFlow(connection, parentScope, () => {
          engine.enter(connection.target, parentScope, connection);
        });
      }
    }
  }

  private findEscalationBoundary(scope: Scope): any | null {
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
        return hasEventDefinition(child, 'bpmn:EscalationEventDefinition');
      }) ?? null
    );
  }

  private findMatchingLinkCatch(linkName: string, scope: Scope): any | null {
    let processScope = scope;
    while (processScope.parent) {
      processScope = processScope.parent;
    }

    return this.scanForLinkCatch(linkName, processScope.element) ?? null;
  }

  private scanForLinkCatch(linkName: string, container: any): any | undefined {
    const children: any[] = container.children || [];
    for (const child of children) {
      if (child.type === 'bpmn:IntermediateCatchEvent') {
        if (isLinkEvent(child) && getLinkName(child) === linkName) {
          return child;
        }
      }
      if (child.children?.length > 0) {
        const found = this.scanForLinkCatch(linkName, child);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }
}
