import type EventBus from 'diagram-js/lib/core/EventBus';
import type { Event as DjsEvent } from 'diagram-js/lib/core/EventBus';
import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';
import type { ElementLike } from 'diagram-js/lib/model/Types';
import inherits from 'inherits';

export function CustomResizeRule(this: any, eventBus: EventBus) {
  RuleProvider.call(this, eventBus);
}

inherits(CustomResizeRule, RuleProvider);

CustomResizeRule.$inject = ['eventBus'];

CustomResizeRule.prototype.init = function () {
  this.addRule('shape.resize', 1500, function (event: DjsEvent & { shape: ElementLike & { $type?: string } }) {
    const type = event.shape.type || event.shape.$type;

    const shapeIsResizable =
      (type != null && type.includes('Task')) ||
      type === 'bpmn:SubProcess' ||
      type === 'bpmn:CallActivity' ||
      type === 'bpmn:Participant' ||
      type === 'bpmn:Lane' ||
      type === 'bpmn:LaneSet' ||
      type === 'bpmn:TextAnnotation' ||
      type === 'bpmn:Transaction' ||
      type === 'bpmn:Group' ||
      type === 'bpmn:EventSubProcess';

    return shapeIsResizable;
  });
};

export default {
  __init__: ['customResizeRule'],
  customResizeRule: ['type', CustomResizeRule],
};
