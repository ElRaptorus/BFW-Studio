import type { CmdHelperDescriptor } from '../Helper/CommmandHelper';
import { CmdHelper } from '../Helper/CommmandHelper';

type ModdleElementLike = { id?: string; businessObject?: any; [key: string]: any };

const MODDLE_BPMN_EXTENSION_ELEMENT_TYPE = 'bpmn:ExtensionElements';
const EXTENSION_ELEMENT_SELECTOR = 'extensionElements';

/**
 * Finds the first evil extension element of the given type on a business object.
 * Returns the moddle element or null.
 */
export function findEvilExtension(businessObject: any, evilType: string): any | null {
  const extensionElements = businessObject.extensionElements ?? businessObject.get?.(EXTENSION_ELEMENT_SELECTOR);
  return extensionElements?.values?.find((value: any) => value.$type === evilType) ?? null;
}

/**
 * Finds all evil extension elements of the given type on a business object.
 */
export function findAllEvilExtensions(businessObject: any, evilType: string): any[] {
  const extensionElements = businessObject.extensionElements ?? businessObject.get?.(EXTENSION_ELEMENT_SELECTOR);
  return extensionElements?.values?.filter((value: any) => value.$type === evilType) ?? [];
}

/**
 * Returns a command descriptor that sets (creates or updates) a body-based evil
 * extension element on an element. If the extension element already exists its body
 * property is updated; if not it is created and attached to the extensionElements.
 *
 * Pass `null` or `undefined` as `value` to remove the extension element.
 */
export function setEvilBodyExtension(
  element: ModdleElementLike,
  bpmnFactory: any,
  evilType: string,
  value: string | null | undefined,
): CmdHelperDescriptor[] {
  const businessObject = element.businessObject ?? element;
  const existingExtension = findEvilExtension(businessObject, evilType);

  if (value == null || value === '') {
    if (existingExtension == null) {
      return [];
    }
    return removeEvilExtension(element, evilType);
  }

  if (existingExtension != null) {
    return [CmdHelper.updateBusinessObject(element as any, existingExtension, { body: value })];
  }

  return createEvilExtension(element, bpmnFactory, evilType, { body: value });
}

/**
 * Creates an evil extension element with the given properties and attaches it
 * to the element's extensionElements. Creates the extensionElements container
 * if it does not exist yet.
 *
 * Returns an array of command descriptors.
 */
export function createEvilExtension(
  element: ModdleElementLike,
  bpmnFactory: any,
  evilType: string,
  properties: Record<string, unknown>,
): CmdHelperDescriptor[] {
  const businessObject = element.businessObject ?? element;
  let extensionElements = businessObject.get?.(EXTENSION_ELEMENT_SELECTOR) ?? businessObject.extensionElements;

  const newElement = bpmnFactory.create(evilType, properties);

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
 * Removes all evil extension elements of the given type from an element's
 * extensionElements. If the extensionElements container becomes empty it is also
 * removed.
 */
export function removeEvilExtension(element: ModdleElementLike, evilType: string): CmdHelperDescriptor[] {
  const businessObject = element.businessObject ?? element;
  const extensionElements = businessObject.get?.(EXTENSION_ELEMENT_SELECTOR) ?? businessObject.extensionElements;

  if (extensionElements == null) {
    return [];
  }

  const remaining = (extensionElements.values ?? []).filter((value: any) => value.$type !== evilType);

  if (remaining.length === 0) {
    return [CmdHelper.updateBusinessObject(element as any, businessObject, { extensionElements: undefined })];
  }

  return [CmdHelper.updateBusinessObject(element as any, extensionElements, { values: remaining })];
}

/**
 * Removes all evil extension elements of the given type from an element.
 */
export function removeAllEvilExtensions(element: ModdleElementLike, evilType: string): CmdHelperDescriptor[] {
  return removeEvilExtension(element, evilType);
}

/**
 * Reads the body value of an evil extension element. Returns undefined if not found.
 */
export function getEvilBodyValue(businessObject: any, evilType: string): string | undefined {
  const extension = findEvilExtension(businessObject, evilType);
  return extension?.body ?? undefined;
}
