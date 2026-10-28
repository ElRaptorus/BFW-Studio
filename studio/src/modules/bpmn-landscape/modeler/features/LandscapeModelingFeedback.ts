import type EventBus from 'diagram-js/lib/core/EventBus';
import TooltipsModule from 'diagram-js/lib/features/tooltips';

import { isCollapsedGroup } from '../landscapeHierarchy';

const TOOLTIP_OFFSET = 5;
const TOOLTIP_TIMEOUT = 2000;

/** Why the rules rejected dropping the shapes on the target, see `canContain` in `LandscapeRules`; `null` when obvious. */
function reasonOf(shapes: any[], target: any): string | null {
  if (target == null) {
    return null;
  }
  const isMainRoot = target.businessObject == null && target.group == null;
  if (!isMainRoot && shapes.some((shape) => shape.type === 'band')) {
    return 'A band can only be placed on the top level of the map.';
  }
  if (isCollapsedGroup(target)) {
    return 'A collapsed group holds no elements. Open it to add elements here.';
  }
  return null;
}

/** A tooltip at the mouse that says why a move or a drop from the palette was rejected. */
class LandscapeModelingFeedback {
  static $inject = ['eventBus', 'tooltips'];

  constructor(eventBus: EventBus, tooltips: any) {
    const showReason = (shapes: any[], event: any): void => {
      const reason = reasonOf(shapes, event.hover);
      if (reason != null) {
        tooltips.add({
          position: { x: event.x + TOOLTIP_OFFSET, y: event.y + TOOLTIP_OFFSET },
          type: 'error',
          timeout: TOOLTIP_TIMEOUT,
          html: reason,
        });
      }
    };
    eventBus.on('shape.move.rejected', (event: any) => showReason(event.context.shapes ?? [], event));
    eventBus.on('create.rejected', (event: any) => showReason(event.context.elements ?? [], event));
  }
}

export default {
  __depends__: [TooltipsModule],
  __init__: ['landscapeModelingFeedback'],
  landscapeModelingFeedback: ['type', LandscapeModelingFeedback],
};
