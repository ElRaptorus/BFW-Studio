import type EventBus from 'diagram-js/lib/core/EventBus';

const EXTENSION_ELEMENTS_TYPE = 'bpmn:ExtensionElements';

/**
 * Removes empty `evil:` container elements after property edits.
 *
 * When the last child of an `evil:` container (e.g., the last `evil:InputMapping`)
 * is deleted, the empty parent container becomes stale XML noise. This behavior
 * cleans it up to prevent Sanitizer `empty-extension-elements` warnings and
 * to keep exported XML clean.
 */
function EvilEmptyExtensionCleanupBehavior(this: any, eventBus: EventBus) {
  eventBus.on('commandStack.element.updateProperties.postExecuted', (event: any) => {
    cleanupEmptyExtensions(event.context?.element);
  });

  eventBus.on('commandStack.element.updateModdleProperties.postExecuted', (event: any) => {
    cleanupEmptyExtensions(event.context?.element);
  });
}

function cleanupEmptyExtensions(element: any): void {
  if (element == null) {
    return;
  }

  const businessObject = element.businessObject ?? element;
  const extensionElements = businessObject.extensionElements;

  if (extensionElements == null || extensionElements.$type !== EXTENSION_ELEMENTS_TYPE) {
    return;
  }

  const values: any[] = extensionElements.values;
  if (values == null) {
    return;
  }

  for (let index = values.length - 1; index >= 0; index--) {
    const extension = values[index];
    if (isEmptyEvilContainer(extension)) {
      values.splice(index, 1);
    }
  }

  if (values.length === 0) {
    businessObject.extensionElements = undefined;
  }
}

function isEmptyEvilContainer(extension: any): boolean {
  const type: string | undefined = extension?.$type;
  if (type == null || !type.startsWith('evil:')) {
    return false;
  }

  const descriptor = extension.$descriptor;
  if (descriptor == null) {
    return false;
  }

  const collectionProperties = descriptor.properties?.filter((property: any) => property.isMany === true);

  if (collectionProperties == null || collectionProperties.length === 0) {
    return false;
  }

  return collectionProperties.every((property: any) => {
    const value = extension[property.name];
    return value == null || (Array.isArray(value) && value.length === 0);
  });
}

(EvilEmptyExtensionCleanupBehavior as any).$inject = ['eventBus'];

export default EvilEmptyExtensionCleanupBehavior;
