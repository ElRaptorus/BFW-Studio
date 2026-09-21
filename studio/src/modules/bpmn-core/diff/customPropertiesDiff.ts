const BFW_PROPERTIES_TYPE = 'bfw:Properties';
const BFW_PROPERTY_TYPE = 'bfw:Property';

/** How an `bfw:Property` entry differs between two diagram versions. */
export type CustomPropertyChangeKind = 'added' | 'removed' | 'changed';

export type CustomPropertyDelta = {
  propertyName: string;
  oldValue: string | undefined;
  newValue: string | undefined;
  kind: CustomPropertyChangeKind;
};

export type CustomPropertiesSummaryEntry = {
  elementId: string;
  displayName: string;
  changes: CustomPropertyDelta[];
};

type ElementPropsRecord = Record<string, { displayName: string; props: Record<string, string> }>;

function formatBpmnType(bpmnType: string): string {
  const withoutPrefix = bpmnType.replace(/^bpmn:/, '');
  return withoutPrefix.replace(/([A-Z])/g, ' $1').trim();
}

function displayNameForElement(el: any): string {
  const type = el.$type ? formatBpmnType(el.$type) : 'Element';
  const name = el.name;
  const id = el.id;
  if (name) {
    return `${type} '${name}'`;
  }
  return `${type} (${id})`;
}

function extractCustomPropertiesMap(businessObject: any): Record<string, string> {
  const extensionElements = businessObject?.extensionElements;
  if (extensionElements?.values == null) {
    return {};
  }

  const propsContainer = extensionElements.values.find((value: any) => value.$type === BFW_PROPERTIES_TYPE);
  if (propsContainer?.values == null) {
    return {};
  }

  const map: Record<string, string> = {};
  for (const property of propsContainer.values) {
    if (property.$type === BFW_PROPERTY_TYPE && property.name != null) {
      map[String(property.name)] = property.value != null ? String(property.value) : '';
    }
  }
  return map;
}

/**
 * Depth-first walk of the moddle tree; visits every object carrying a string `id` (BPMN elements).
 */
function collectElementsWithId(node: any, out: ElementPropsRecord, visited: Set<any>): void {
  if (node == null || typeof node !== 'object') {
    return;
  }
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  if (typeof node.id === 'string' && node.$type) {
    const props = extractCustomPropertiesMap(node);
    out[node.id] = {
      displayName: displayNameForElement(node),
      props,
    };
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    const value = (node as any)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        collectElementsWithId(item, out, visited);
      }
    } else if (value != null && typeof value === 'object') {
      collectElementsWithId(value, out, visited);
    }
  }
}

export function collectCustomPropertiesByElementId(definitions: any): ElementPropsRecord {
  const out: ElementPropsRecord = {};
  const visited = new Set<any>();
  collectElementsWithId(definitions, out, visited);
  return out;
}

export function diffCustomPropertiesMaps(
  beforeMap: ElementPropsRecord,
  afterMap: ElementPropsRecord,
): CustomPropertiesSummaryEntry[] {
  const elementIds = new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)]);
  const entries: CustomPropertiesSummaryEntry[] = [];

  for (const elementId of elementIds) {
    const before = beforeMap[elementId];
    const after = afterMap[elementId];
    const beforeProps = before?.props ?? {};
    const afterProps = after?.props ?? {};
    const displayName = after?.displayName ?? before?.displayName ?? elementId;

    const propNames = new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)]);
    const changes: CustomPropertyDelta[] = [];

    for (const name of propNames) {
      const oldValue = beforeProps[name];
      const newValue = afterProps[name];
      const hadBefore = Object.prototype.hasOwnProperty.call(beforeProps, name);
      const hasAfter = Object.prototype.hasOwnProperty.call(afterProps, name);

      if (!hadBefore && hasAfter) {
        changes.push({ propertyName: name, oldValue: undefined, newValue, kind: 'added' });
      } else if (hadBefore && !hasAfter) {
        changes.push({ propertyName: name, oldValue, newValue: undefined, kind: 'removed' });
      } else if (hadBefore && hasAfter && oldValue !== newValue) {
        changes.push({ propertyName: name, oldValue, newValue, kind: 'changed' });
      }
    }

    if (changes.length > 0) {
      changes.sort((changeA, changeB) => changeA.propertyName.localeCompare(changeB.propertyName));
      entries.push({ elementId, displayName, changes });
    }
  }

  entries.sort((changeA, changeB) => changeA.displayName.localeCompare(changeB.displayName));
  return entries;
}
