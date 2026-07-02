import type { BpmnViewerComponentAdapter } from '../../bpmn-core/BpmnViewerComponentAdapter';

/**
 * Reads an `evil:Property` value from the raw moddle business object
 * of a BPMN element in the viewer. This bypasses the SDK-parsed model
 * and accesses the underlying bpmn-moddle data directly, which is the
 * only way to reach studio-internal custom properties like
 * `studio.examplePayload` that the SDK parser does not expose.
 */
export function getCustomPropertyFromViewer(
  adapter: BpmnViewerComponentAdapter | null,
  elementId: string,
  propertyName: string,
): string | null {
  if (!adapter) {
    return null;
  }

  const element = adapter.getElementRegistry().get(elementId);
  if (!element) {
    return null;
  }

  const businessObject = (element as any).businessObject;
  if (!businessObject?.extensionElements?.values) {
    return null;
  }

  for (const extension of businessObject.extensionElements.values) {
    if (extension.$type === 'evil:Properties' && Array.isArray(extension.values)) {
      for (const property of extension.values) {
        if (property.$type === 'evil:Property' && property.name === propertyName) {
          return typeof property.value === 'string' ? property.value : null;
        }
      }
    }
  }

  return null;
}

/**
 * Reads the `<bpmn:activationCondition>` body of a Complex Gateway from the raw
 * moddle business object in the viewer. This bypasses the SDK-parsed model,
 * whose parser currently does not populate `activationCondition`, and reads the
 * underlying bpmn-moddle data directly.
 */
export function getActivationConditionFromViewer(
  adapter: BpmnViewerComponentAdapter | null,
  elementId: string,
): string | null {
  if (!adapter) {
    return null;
  }

  const element = adapter.getElementRegistry().get(elementId);
  if (!element) {
    return null;
  }

  const businessObject = (element as any).businessObject;
  const activationCondition = businessObject?.activationCondition;
  const body = activationCondition?.body ?? activationCondition?.text;
  return typeof body === 'string' ? body : null;
}
