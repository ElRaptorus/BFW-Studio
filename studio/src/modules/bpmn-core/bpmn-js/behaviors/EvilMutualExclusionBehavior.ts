import type EventBus from 'diagram-js/lib/core/EventBus';

const BRT_TYPE = 'bpmn:BusinessRuleTask';
const SCRIPT_TASK_TYPE = 'bpmn:ScriptTask';

/**
 * Enforces mutual exclusion between conflicting extension properties:
 *
 * - BusinessRuleTask: switching `implementation` between `"feel"` and `"dmn"`
 *   clears the properties belonging to the other mode.
 * - ScriptTask: setting `evil:scriptRef` clears the inline `<bpmn:script>`
 *   body, and vice versa.
 */
function EvilMutualExclusionBehavior(this: any, eventBus: EventBus) {
  function handlePostExecuted(event: any): void {
    const context = event.context;
    const element = context?.element;
    const properties = context?.properties;

    if (element == null || properties == null) {
      return;
    }

    const businessObject = element.businessObject ?? element;
    const elementType: string = businessObject.$type;

    if (elementType === BRT_TYPE && properties.implementation != null) {
      handleBusinessRuleTaskModeSwitch(businessObject, properties.implementation);
    }

    if (elementType === SCRIPT_TASK_TYPE) {
      handleScriptTaskExclusion(businessObject, properties);
    }
  }

  eventBus.on('commandStack.element.updateProperties.postExecuted', handlePostExecuted);
  eventBus.on('commandStack.element.updateModdleProperties.postExecuted', handlePostExecuted);
}

function handleBusinessRuleTaskModeSwitch(businessObject: any, newImplementation: string): void {
  const extensionElements = businessObject.extensionElements?.values;
  if (extensionElements == null) {
    return;
  }

  if (newImplementation === 'feel') {
    removeExtensionsByType(extensionElements, ['evil:DecisionRef', 'evil:DecisionElementId']);
  } else if (newImplementation === 'dmn') {
    if (businessObject.script != null) {
      businessObject.script = undefined;
    }
  }
}

function handleScriptTaskExclusion(businessObject: any, properties: Record<string, any>): void {
  const extensionElements = businessObject.extensionElements?.values;

  if (properties.script != null && properties.script !== '' && extensionElements != null) {
    removeExtensionsByType(extensionElements, ['evil:ScriptRef']);
  }

  const hasScriptRefSet = extensionElements?.some((extension: any) => extension.$type === 'evil:ScriptRef');
  if (hasScriptRefSet && businessObject.script != null) {
    businessObject.script = undefined;
  }
}

function removeExtensionsByType(extensionValues: any[], typesToRemove: string[]): void {
  for (let index = extensionValues.length - 1; index >= 0; index--) {
    if (typesToRemove.includes(extensionValues[index].$type)) {
      extensionValues.splice(index, 1);
    }
  }
}

(EvilMutualExclusionBehavior as any).$inject = ['eventBus'];

export default EvilMutualExclusionBehavior;
