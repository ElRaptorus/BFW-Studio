import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import {
  getCompensateActivityRef,
  getEscalationCode,
  getLinkName,
  isCompensateEvent,
  isEscalationEvent,
  isLinkEvent,
  isMessageEvent,
  isSignalEvent,
} from '../eventDefUtils';
import { resolveEscalation } from '../eventResolver';
import type { Behavior } from './index';

export class IntermediateThrowEventBehavior implements Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    if (isLinkEvent(element)) {
      const name = getLinkName(element);
      const matchingCatch =
        name != null
          ? (scope.element.children || []).find(
              (child: any) =>
                child.type === 'bpmn:IntermediateCatchEvent' && isLinkEvent(child) && getLinkName(child) === name,
            )
          : undefined;

      engine.emitTokenExit(element, scope);

      if (matchingCatch) {
        engine.enter(matchingCatch, scope);
      } else {
        engine.tryCompleteScope(scope);
      }
      return;
    }

    if (isMessageEvent(element)) {
      engine.deliverMessage(element, scope);
      engine.exit(element, scope);
      return;
    }

    if (isSignalEvent(element)) {
      engine.broadcastSignal(element, scope);
      engine.exit(element, scope);
      return;
    }

    if (isEscalationEvent(element)) {
      for (const escalationCatch of resolveEscalation(scope, getEscalationCode(element), engine.elementRegistry)) {
        engine.enterCatch(escalationCatch);
      }
      engine.exit(element, scope);
      return;
    }

    if (isCompensateEvent(element)) {
      engine.runCompensation(scope, getCompensateActivityRef(element), () => engine.exit(element, scope));
      return;
    }

    engine.exit(element, scope);
  }

  exit(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.routeToOutgoing(element, scope);
  }
}
