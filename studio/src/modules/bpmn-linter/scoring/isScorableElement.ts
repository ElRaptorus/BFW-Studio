const DIAGRAM_BUCKET_ID = '__diagram__';

export { DIAGRAM_BUCKET_ID };

/**
 * Elements that contribute one "score point" toward the linter denominator.
 * Includes diagram shapes and sequence flows; excludes the canvas root and label artifacts.
 */
export function isScorableElement(element: unknown, rootElementId: string | null): boolean {
  if (element == null || typeof element !== 'object') {
    return false;
  }
  const el = element as { id?: string; type?: string; businessObject?: { $type?: string } };
  if (rootElementId != null && el.id === rootElementId) {
    return false;
  }
  if (el.type === 'label') {
    return false;
  }
  const bpmnType = el.businessObject?.$type;
  if (bpmnType == null || !bpmnType.startsWith('bpmn:')) {
    return false;
  }
  return true;
}

export function countScorableElements(
  elementRegistry: { getAll: () => unknown[] },
  rootElementId: string | null,
): number {
  return elementRegistry.getAll().filter((el) => isScorableElement(el, rootElementId)).length;
}

/**
 * Map a finding's element id to a logical bucket id for per-element penalties.
 */
export function resolveFindingBucketId(
  elementId: string | null,
  elementRegistry: { get: (id: string) => unknown | undefined } | undefined,
): string {
  if (elementId == null || elementId === '') {
    return DIAGRAM_BUCKET_ID;
  }
  if (elementRegistry) {
    const shape = elementRegistry.get(elementId);
    if (shape == null) {
      return DIAGRAM_BUCKET_ID;
    }
  }
  return elementId;
}
