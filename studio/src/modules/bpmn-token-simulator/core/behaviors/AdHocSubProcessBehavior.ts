import type { Scope } from '../Scope';
import type { SimulationEngine } from '../SimulationEngine';
import { isEventSubProcess, isSubProcessType } from '../eventDefUtils';
import { SubProcessBehavior } from './SubProcessBehavior';

/** Loop and multi-instance markers on the ad-hoc shell are ignored. */
export class AdHocSubProcessBehavior extends SubProcessBehavior {
  enter(element: any, scope: Scope, engine: SimulationEngine): void {
    if (this.isCollapsed(element)) {
      this.enterCollapsed(element, scope, engine);
      return;
    }

    const activities = (element.children || []).filter(
      (child: any) =>
        (child.type.endsWith('Task') ||
          child.type === 'bpmn:CallActivity' ||
          (isSubProcessType(child) && !isEventSubProcess(child))) &&
        child.businessObject?.isForCompensation !== true &&
        !(child.incoming || []).some((connection: any) => connection.type === 'bpmn:SequenceFlow'),
    );
    if (activities.length === 0) {
      engine.exit(element, scope);
      return;
    }

    const childScope = engine.createScope(element, scope);
    if (element.businessObject?.ordering === 'Sequential') {
      childScope.pendingSequentialActivities = activities.slice(1);
      engine.enter(activities[0], childScope);
      return;
    }
    for (const activity of activities) {
      engine.enter(activity, childScope);
    }
  }

  exit(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.routeToOutgoing(element, scope);
  }

  signal(element: any, scope: Scope, engine: SimulationEngine): void {
    engine.exit(element, scope);
  }
}
