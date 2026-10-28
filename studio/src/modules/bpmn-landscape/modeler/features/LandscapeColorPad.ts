import type { BpmnElementColor } from '#modules/bpmn-core/BpmnElementCoreTypes';
import { ColorContextPadProvider } from '#modules/bpmn-core/bpmn-js/Provider/ColorContextPadProvider';
import type EventBus from 'diagram-js/lib/core/EventBus';

import { UPDATE_ELEMENT_COMMAND } from '../LandscapeUpdates';

/**
 * The colour panel of the BPMN editor's context pad, for map shapes. Lines take no colour. A colour goes into the
 * element's `style`, as one undo step.
 */
class LandscapeColorPad extends ColorContextPadProvider {
  static $inject = ['contextPad', 'modeling', 'canvas', 'eventBus', 'commandStack'];

  private readonly commandStack: any;

  constructor(contextPad: any, modeling: any, canvas: any, eventBus: EventBus, commandStack: any) {
    super(contextPad, modeling, canvas, eventBus);
    this.commandStack = commandStack;
  }

  getContextPadEntries(element: any) {
    if (element.waypoints != null || element.businessObject == null) {
      return (entries: Record<string, unknown>) => entries;
    }
    return super.getContextPadEntries(element);
  }

  protected applyColor(element: any, color: BpmnElementColor) {
    const style =
      color.backgroundColor == null ? null : { fill: color.backgroundColor, stroke: color.borderColor ?? null };
    this.commandStack.execute(UPDATE_ELEMENT_COMMAND, { element, properties: { style } });
  }
}

export default {
  __init__: ['colorContextPadProvider'],
  colorContextPadProvider: ['type', LandscapeColorPad],
};
