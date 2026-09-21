import type EventBus from 'diagram-js/lib/core/EventBus';

const EXTENSION_ELEMENTS_TYPE = 'bpmn:ExtensionElements';

const TYPE_ORDER: Record<string, number> = {
  'bfw:Version': 0,
  'bfw:CorrelationKey': 1,
  'bfw:InputMapping': 10,
  'bfw:OutputMapping': 11,
  'bfw:PayloadContract': 12,
  'bfw:ResultContract': 13,
  'bfw:DataContract': 14,
};

const DEFAULT_ORDER = 50;

/**
 * Keeps `bfw:` extension elements in a consistent order within
 * `<bpmn:extensionElements>`. Primarily ensures `bfw:InputMapping` elements
 * appear before `bfw:OutputMapping`, which makes exported XML diffs cleaner
 * and more predictable.
 */
function BfwExtensionOrderBehavior(this: any, eventBus: EventBus) {
  eventBus.on('commandStack.element.updateProperties.postExecuted', (event: any) => {
    sortExtensions(event.context?.element);
  });

  eventBus.on('commandStack.element.updateModdleProperties.postExecuted', (event: any) => {
    sortExtensions(event.context?.element);
  });
}

function sortExtensions(element: any): void {
  if (element == null) {
    return;
  }

  const businessObject = element.businessObject ?? element;
  const extensionElements = businessObject.extensionElements;

  if (extensionElements == null || extensionElements.$type !== EXTENSION_ELEMENTS_TYPE) {
    return;
  }

  const values: any[] = extensionElements.values;
  if (values == null || values.length <= 1) {
    return;
  }

  values.sort((extensionA: any, extensionB: any) => {
    const orderA = TYPE_ORDER[extensionA.$type] ?? DEFAULT_ORDER;
    const orderB = TYPE_ORDER[extensionB.$type] ?? DEFAULT_ORDER;
    return orderA - orderB;
  });
}

(BfwExtensionOrderBehavior as any).$inject = ['eventBus'];

export default BfwExtensionOrderBehavior;
