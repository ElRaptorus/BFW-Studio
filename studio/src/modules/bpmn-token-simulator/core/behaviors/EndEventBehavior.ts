import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import {
  getCompensateActivityRef,
  getErrorCode,
  getEscalationCode,
  isCancelEvent,
  isCompensateEvent,
  isErrorEvent,
  isEscalationEvent,
  isMessageEvent,
  isSignalEvent,
  isTerminateEvent,
} from '../eventDefUtils';
import { resolveError, resolveEscalation } from '../eventResolver';
import type { Behavior } from './index';

export class EndEventBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    if (isTerminateEvent(element)) {
      if (scope.parent) {
        engine.interruptAllInScope(scope, new Set([element.id]));
        engine.consumeToken(element, scope);
      } else {
        scope.destroy();
        engine.signalTerminated(scope);
      }
      return;
    }

    if (isErrorEvent(element)) {
      const errorCatch = resolveError(scope, getErrorCode(element), engine.elementRegistry);
      if (errorCatch) {
        engine.enterCatch(errorCatch, new Set([element.id]));
        engine.consumeToken(element, scope);
        return;
      }
      this.terminateWithError(element, scope, engine);
      return;
    }

    if (isEscalationEvent(element)) {
      const escalationCatches = resolveEscalation(scope, getEscalationCode(element), engine.elementRegistry);
      for (const escalationCatch of escalationCatches) {
        engine.enterCatch(escalationCatch);
      }
      // Siblings go after the catches are entered, so the scope cannot complete before an event subprocess of its own holds a token.
      engine.interruptAllInScope(
        scope,
        new Set([element.id, ...escalationCatches.map((escalationCatch) => escalationCatch.element.id)]),
      );
      engine.consumeToken(element, scope);
      return;
    }

    if (isCompensateEvent(element)) {
      engine.runCompensation(scope, getCompensateActivityRef(element), () => engine.consumeToken(element, scope));
      return;
    }

    if (isCancelEvent(element) && scope.parent && scope.element.type === 'bpmn:Transaction') {
      const parentScope = scope.parent;
      engine.interruptAllInScope(scope, new Set([element.id]));
      engine.runCompensation(scope, undefined, () => {
        const cancelBoundary = (scope.element.attachers || []).find(
          (attacher: any) => attacher.type === 'bpmn:BoundaryEvent' && isCancelEvent(attacher),
        );
        if (!cancelBoundary) {
          this.terminateWithError(element, scope, engine);
          return;
        }
        engine.enterCatch({ element: cancelBoundary, scope: parentScope, host: scope.element, interrupting: true });
      });
      return;
    }

    if (isMessageEvent(element)) {
      engine.deliverMessage(element, scope);
      engine.consumeToken(element, scope);
      return;
    }

    if (isSignalEvent(element)) {
      engine.broadcastSignal(element, scope);
      engine.consumeToken(element, scope);
      return;
    }

    engine.consumeToken(element, scope);
  }

  private terminateWithError(element: any, scope: Scope, engine: SimulationEngine): void {
    let rootScope = scope;
    while (rootScope.parent) {
      rootScope = rootScope.parent;
    }
    rootScope.destroy();
    engine.signalErrorTerminated(rootScope, element);
  }
}
