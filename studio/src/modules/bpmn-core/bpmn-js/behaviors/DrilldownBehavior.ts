import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';

function isCollapsedSubProcess(element: any): boolean {
  return element?.type === 'bpmn:SubProcess' && element.collapsed === true;
}

/**
 * Enables double-click on a collapsed subprocess to drill into its plane,
 * overriding the default label-editing behavior for that element type.
 *
 * Also adds a context-pad entry for drill-down.
 */
function DrilldownBehavior(this: any, eventBus: EventBus, canvas: Canvas, elementRegistry: ElementRegistry) {
  // Priority 1500 — higher than LabelEditingProvider (1000) so we intercept first
  eventBus.on('element.dblclick', 1500, (event: any) => {
    const element = event.element;
    if (!isCollapsedSubProcess(element)) {
      return;
    }

    const planeId = `${element.id}_plane`;
    const targetRoot = canvas.findRoot(planeId);
    if (targetRoot != null) {
      canvas.setRootElement(targetRoot);
      return false; // prevent default (label editing)
    }
  });
}

(DrilldownBehavior as any).$inject = ['eventBus', 'canvas', 'elementRegistry'];

export default DrilldownBehavior;
