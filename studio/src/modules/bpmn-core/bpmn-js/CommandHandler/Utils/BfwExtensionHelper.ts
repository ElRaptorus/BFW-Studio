import type { CmdHelperDescriptor } from '../Helper/CommmandHelper';
import { CmdHelper } from '../Helper/CommmandHelper';

type ModdleElementLike = { id?: string; businessObject?: any; [key: string]: any };

const MODDLE_BPMN_EXTENSION_ELEMENT_TYPE = 'bpmn:ExtensionElements';
const EXTENSION_ELEMENT_SELECTOR = 'extensionElements';

/**
 * Finds the first bfw extension element of the given type on a business object.
 * Returns the moddle element or null.
 */
export function findBfwExtension(businessObject: any, extensionType: string): any | null {
  const extensionElements = businessObject.extensionElements ?? businessObject.get?.(EXTENSION_ELEMENT_SELECTOR);
  return extensionElements?.values?.find((value: any) => value.$type === extensionType) ?? null;
}

/**
 * Finds all bfw extension elements of the given type on a business object.
 */
export function findAllBfwExtensions(businessObject: any, extensionType: string): any[] {
  const extensionElements = businessObject.extensionElements ?? businessObject.get?.(EXTENSION_ELEMENT_SELECTOR);
  return extensionElements?.values?.filter((value: any) => value.$type === extensionType) ?? [];
}

/**
 * Returns a command descriptor that sets (creates or updates) a body-based bfw
 * extension element on an element. If the extension element already exists its body
 * property is updated; if not it is created and attached to the extensionElements.
 *
 * Pass `null` or `undefined` as `value` to remove the extension element.
 */
export function setBfwBodyExtension(
  element: ModdleElementLike,
  bpmnFactory: any,
  extensionType: string,
  value: string | null | undefined,
): CmdHelperDescriptor[] {
  const businessObject = element.businessObject ?? element;
  const existingExtension = findBfwExtension(businessObject, extensionType);

  if (value == null || value === '') {
    if (existingExtension == null) {
      return [];
    }
    return removeBfwExtension(element, extensionType);
  }

  if (existingExtension != null) {
    return [CmdHelper.updateBusinessObject(element as any, existingExtension, { body: value })];
  }

  return createBfwExtension(element, bpmnFactory, extensionType, { body: value });
}

/**
 * Creates a bfw extension element with the given properties and attaches it
 * to the element's extensionElements. Creates the extensionElements container
 * if it does not exist yet.
 *
 * Returns an array of command descriptors.
 */
export function createBfwExtension(
  element: ModdleElementLike,
  bpmnFactory: any,
  extensionType: string,
  properties: Record<string, unknown>,
): CmdHelperDescriptor[] {
  const businessObject = element.businessObject ?? element;
  let extensionElements = businessObject.get?.(EXTENSION_ELEMENT_SELECTOR) ?? businessObject.extensionElements;

  const newElement = bpmnFactory.create(extensionType, properties);

  if (extensionElements == null) {
    extensionElements = bpmnFactory.create(MODDLE_BPMN_EXTENSION_ELEMENT_TYPE, { values: [] });
    extensionElements.$parent = businessObject;
    newElement.$parent = extensionElements;
    extensionElements.values = [newElement];

    return [CmdHelper.updateBusinessObject(element as any, businessObject, { extensionElements })];
  }

  newElement.$parent = extensionElements;
  return [
    CmdHelper.updateBusinessObject(element as any, extensionElements, {
      values: [...(extensionElements.values ?? []), newElement],
    }),
  ];
}

/**
 * Removes all bfw extension elements of the given type from an element's
 * extensionElements. If the extensionElements container becomes empty it is also
 * removed.
 */
export function removeBfwExtension(element: ModdleElementLike, extensionType: string): CmdHelperDescriptor[] {
  const businessObject = element.businessObject ?? element;
  const extensionElements = businessObject.get?.(EXTENSION_ELEMENT_SELECTOR) ?? businessObject.extensionElements;

  if (extensionElements == null) {
    return [];
  }

  const remaining = (extensionElements.values ?? []).filter((value: any) => value.$type !== extensionType);

  if (remaining.length === 0) {
    return [CmdHelper.updateBusinessObject(element as any, businessObject, { extensionElements: undefined })];
  }

  return [CmdHelper.updateBusinessObject(element as any, extensionElements, { values: remaining })];
}

/**
 * Removes all bfw extension elements of the given type from an element.
 */
export function removeAllBfwExtensions(element: ModdleElementLike, extensionType: string): CmdHelperDescriptor[] {
  return removeBfwExtension(element, extensionType);
}

/**
 * Reads the body value of a bfw extension element. Returns undefined if not found.
 */
export function getBfwBodyValue(businessObject: any, extensionType: string): string | undefined {
  const extension = findBfwExtension(businessObject, extensionType);
  return extension?.body ?? undefined;
}
