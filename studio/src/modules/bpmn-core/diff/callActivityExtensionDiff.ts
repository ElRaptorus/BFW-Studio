import type { CustomPropertiesSummaryEntry, CustomPropertyDelta } from './customPropertiesDiff';

const EVIL_CALLED_PROCESS_VERSION_TYPE = 'evil:CalledProcessVersion';
const EVIL_START_EVENT_ID_TYPE = 'evil:StartEventId';
const BPMN_CALL_ACTIVITY_TYPE = 'bpmn:CallActivity';

/** Human labels for Call Activity body extensions shown as named attribute diffs. */
export const CALL_ACTIVITY_EXTENSION_LABELS: Record<string, string> = {
  calledProcessVersion: 'Called Process Version',
  startEventId: 'Start Event ID',
};

export const CALL_ACTIVITY_DIFF_ATTRIBUTE_LABELS: readonly string[] = [
  CALL_ACTIVITY_EXTENSION_LABELS.calledProcessVersion,
  CALL_ACTIVITY_EXTENSION_LABELS.startEventId,
];

type ElementPropsRecord = Record<string, { displayName: string; props: Record<string, string> }>;

function formatBpmnType(bpmnType: string): string {
  const withoutPrefix = bpmnType.replace(/^bpmn:/, '');
  return withoutPrefix.replace(/([A-Z])/g, ' $1').trim();
}

function displayNameForElement(element: any): string {
  const type = element.$type ? formatBpmnType(element.$type) : 'Element';
  const name = element.name;
  const id = element.id;
  if (name) {
    return `${type} '${name}'`;
  }
  return `${type} (${id})`;
}

function readBody(value: any): string {
  if (value?.body == null) {
    return '';
  }
  return String(value.body).trim();
}

function extractCallActivityExtensionMap(businessObject: any): Record<string, string> {
  if (businessObject?.$type !== BPMN_CALL_ACTIVITY_TYPE) {
    return {};
  }

  const extensionElements = businessObject.extensionElements;
  if (extensionElements?.values == null) {
    return {};
  }

  const map: Record<string, string> = {};
  for (const value of extensionElements.values) {
    if (value.$type === EVIL_CALLED_PROCESS_VERSION_TYPE) {
      const body = readBody(value);
      if (body !== '') {
        map.calledProcessVersion = body;
      }
    }
    if (value.$type === EVIL_START_EVENT_ID_TYPE) {
      const body = readBody(value);
      if (body !== '') {
        map.startEventId = body;
      }
    }
  }
  return map;
}

function collectCallActivityElements(node: any, out: ElementPropsRecord, visited: Set<any>): void {
  if (node == null || typeof node !== 'object') {
    return;
  }
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  if (typeof node.id === 'string' && node.$type === BPMN_CALL_ACTIVITY_TYPE) {
    out[node.id] = {
      displayName: displayNameForElement(node),
      props: extractCallActivityExtensionMap(node),
    };
  }

  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) {
      continue;
    }
    const value = (node as any)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        collectCallActivityElements(item, out, visited);
      }
    } else if (value != null && typeof value === 'object') {
      collectCallActivityElements(value, out, visited);
    }
  }
}

export function collectCallActivityExtensionsByElementId(definitions: any): ElementPropsRecord {
  const out: ElementPropsRecord = {};
  collectCallActivityElements(definitions, out, new Set());
  return out;
}

export function diffCallActivityExtensionMaps(
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

    const propertyNames = new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)]);
    const changes: CustomPropertyDelta[] = [];

    for (const propertyName of propertyNames) {
      const oldValue = beforeProps[propertyName];
      const newValue = afterProps[propertyName];
      const hadBefore = Object.prototype.hasOwnProperty.call(beforeProps, propertyName);
      const hasAfter = Object.prototype.hasOwnProperty.call(afterProps, propertyName);

      if (!hadBefore && hasAfter) {
        changes.push({ propertyName, oldValue: undefined, newValue, kind: 'added' });
      } else if (hadBefore && !hasAfter) {
        changes.push({ propertyName, oldValue, newValue: undefined, kind: 'removed' });
      } else if (hadBefore && hasAfter && oldValue !== newValue) {
        changes.push({ propertyName, oldValue, newValue, kind: 'changed' });
      }
    }

    if (changes.length > 0) {
      changes.sort((changeA, changeB) => changeA.propertyName.localeCompare(changeB.propertyName));
      entries.push({ elementId, displayName, changes });
    }
  }

  entries.sort((entryA, entryB) => entryA.displayName.localeCompare(entryB.displayName));
  return entries;
}
