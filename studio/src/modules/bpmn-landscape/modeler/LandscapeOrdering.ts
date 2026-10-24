import type EventBus from 'diagram-js/lib/core/EventBus';
import OrderingProvider from 'diagram-js/lib/features/ordering/OrderingProvider';

import { isCollapsedGroup } from './landscapeHierarchy';

const isBehind = (element: any): boolean => element.type === 'group' || element.type === 'band';
const isContainer = (element: any): boolean => isBehind(element) && !isCollapsedGroup(element);

/** Bands and groups are drawn behind the other shapes of their parent, connections in front of everything. */
function levelOf(element: any): number {
  if (element.waypoints != null) {
    return 2;
  }
  return isBehind(element) ? 0 : 1;
}

export default class LandscapeOrdering extends OrderingProvider {
  static $inject = ['eventBus'];

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  /** A shape dropped on an element that holds nothing goes into that element's container. */
  getOrdering(element: any, newParent: any): { parent: any; index: number | undefined } {
    let parent = newParent;
    while (parent.parent != null && !isContainer(parent)) {
      parent = parent.parent;
    }
    const level = levelOf(element);
    const siblings = parent.children.filter((child: any) => child !== element);
    const index = siblings.findIndex((child: any) => levelOf(child) > level);
    return { parent, index: index === -1 ? undefined : index };
  }
}
