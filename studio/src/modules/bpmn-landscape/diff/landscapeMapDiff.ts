import { formatSummaryValueForDisplay } from '#modules/bpmn-core/diff/changeSummaryBuilder';

import type { LandscapeElement, LandscapeElementType, LandscapeMap } from '../LandscapeMapFile';
import { createEmptyLandscapeMap, parseLandscapeMap, serializeLandscapeMap } from '../LandscapeMapFile';
import type { ProcessRelationKind } from '../buildProcessRelations';

export type LandscapeItemType = LandscapeElementType | 'connector' | 'level';
export type LandscapePropertyChange = { property: string; label: string; before: string | null; after: string | null };
export type LandscapeItemChange = {
  id: string;
  itemType: LandscapeItemType;
  displayName: string;
  /** Content properties only. */
  propertyChanges: LandscapePropertyChange[];
  /** Bounds or waypoints changed. */
  layoutChanged: boolean;
};
export type LandscapeMapDiff = {
  added: LandscapeItemChange[];
  removed: LandscapeItemChange[];
  /** At least one content property changed. */
  modified: LandscapeItemChange[];
  /** Only the layout changed. */
  layoutChanged: LandscapeItemChange[];
  mapProperties: LandscapePropertyChange[];
};

const NOTE_NAME_LENGTH = 40;
const RELATION_LAYER_LABELS: Record<ProcessRelationKind, string> = {
  callActivity: 'Call activity relations',
  message: 'Message relations',
  signal: 'Signal relations',
};

type ItemProperty = { property: string; label: string; value: string | null };
type ComparableItem = {
  id: string;
  itemType: LandscapeItemType;
  displayName: string;
  properties: ItemProperty[];
  layout: string;
};

const itemProperty = (property: string, label: string, value: string | boolean | null): ItemProperty => ({
  property,
  label,
  value: value == null ? null : String(value),
});

function serializeExtensionAttributes(attributes: Record<string, string> | undefined): string | null {
  const entries = Object.entries(attributes ?? {}).sort(([first], [second]) => first.localeCompare(second));
  return entries.length === 0 ? null : entries.map(([name, value]) => `${name}="${value}"`).join(' ');
}

function serializeMapExtensions(extensions: LandscapeMap['extensions']): string | null {
  if (Object.keys(extensions.attributes).length === 0 && extensions.elements.length === 0) {
    return null;
  }
  const attributes = Object.fromEntries(
    Object.entries(extensions.attributes).sort(([first], [second]) => first.localeCompare(second)),
  );
  return serializeLandscapeMap({ ...createEmptyLandscapeMap(''), extensions: { ...extensions, attributes } });
}

function elementDisplayName(element: LandscapeElement): string {
  let name: string;
  switch (element.type) {
    case 'process':
      name = element.label ?? element.processId;
      break;
    case 'note':
      name = element.text.slice(0, NOTE_NAME_LENGTH);
      break;
    default:
      name = element.label;
  }
  return name === '' ? `${element.type} ${element.id}` : name;
}

function elementProperties(element: LandscapeElement): ItemProperty[] {
  const common = [
    itemProperty('parentId', 'Parent', element.parentId),
    itemProperty('style.fill', 'Fill', element.style?.fill ?? null),
    itemProperty('style.stroke', 'Stroke', element.style?.stroke ?? null),
    itemProperty(
      'extensionAttributes',
      'Extension attributes',
      serializeExtensionAttributes(element.extensionAttributes),
    ),
  ];
  switch (element.type) {
    case 'band':
      return [itemProperty('label', 'Label', element.label), ...common];
    case 'group':
      return [
        itemProperty('label', 'Label', element.label),
        itemProperty('collapsed', 'Collapsed', element.collapsed),
        ...common,
      ];
    case 'process':
      return [
        itemProperty('processId', 'Process', element.processId),
        itemProperty('fileHint', 'File', element.fileHint),
        itemProperty('label', 'Label', element.label),
        itemProperty('shape', 'Shape', element.shape),
        ...common,
      ];
    case 'placeholder':
      return [itemProperty('label', 'Label', element.label), itemProperty('shape', 'Shape', element.shape), ...common];
    case 'mapLink':
      return [
        itemProperty('label', 'Label', element.label),
        itemProperty('mapPath', 'Linked map', element.mapPath),
        ...common,
      ];
    case 'note':
      return [itemProperty('text', 'Text', element.text), ...common];
  }
}

/** Elements and connectors share one id space; levels have their own. */
function comparableItemsOf(map: LandscapeMap): {
  shapes: Map<string, ComparableItem>;
  levels: Map<string, ComparableItem>;
} {
  const shapes = new Map<string, ComparableItem>();
  for (const element of map.elements) {
    shapes.set(element.id, {
      id: element.id,
      itemType: element.type,
      displayName: elementDisplayName(element),
      properties: elementProperties(element),
      layout: JSON.stringify([element.x, element.y, element.width, element.height]),
    });
  }
  for (const connector of map.connectors) {
    const endName = (id: string): string => shapes.get(id)?.displayName ?? id;
    shapes.set(connector.id, {
      id: connector.id,
      itemType: 'connector',
      displayName: connector.label || `${endName(connector.sourceId)} → ${endName(connector.targetId)}`,
      properties: [
        itemProperty('label', 'Label', connector.label),
        itemProperty('sourceId', 'Source', connector.sourceId),
        itemProperty('targetId', 'Target', connector.targetId),
        itemProperty(
          'extensionAttributes',
          'Extension attributes',
          serializeExtensionAttributes(connector.extensionAttributes),
        ),
      ],
      layout: JSON.stringify(connector.waypoints.map((point) => [point.x, point.y])),
    });
  }
  const levels = new Map<string, ComparableItem>(
    map.levels.map((level) => [
      level.id,
      {
        id: level.id,
        itemType: 'level',
        displayName: level.name,
        properties: [itemProperty('name', 'Name', level.name)],
        layout: '',
      },
    ]),
  );
  return { shapes, levels };
}

const unchanged = (item: ComparableItem): LandscapeItemChange => ({
  id: item.id,
  itemType: item.itemType,
  displayName: item.displayName,
  propertyChanges: [],
  layoutChanged: false,
});

/** A property that only one side has (the element type changed under the same id) counts as `null` on the other. */
function compareItems(before: ComparableItem, after: ComparableItem): LandscapeItemChange {
  const beforeValues = new Map(before.properties.map((entry) => [entry.property, entry.value]));
  const afterValues = new Map(after.properties.map((entry) => [entry.property, entry.value]));
  const properties = [...after.properties, ...before.properties.filter((entry) => !afterValues.has(entry.property))];
  return {
    ...unchanged(after),
    propertyChanges: properties.flatMap((entry): LandscapePropertyChange[] => {
      const beforeValue = beforeValues.get(entry.property) ?? null;
      const afterValue = afterValues.get(entry.property) ?? null;
      return beforeValue === afterValue
        ? []
        : [{ property: entry.property, label: entry.label, before: beforeValue, after: afterValue }];
    }),
    layoutChanged: before.layout !== after.layout,
  };
}

function diffItems(
  before: Map<string, ComparableItem>,
  after: Map<string, ComparableItem>,
  diff: LandscapeMapDiff,
): void {
  for (const [id, afterItem] of after) {
    const beforeItem = before.get(id);
    if (beforeItem == null) {
      diff.added.push(unchanged(afterItem));
      continue;
    }
    const change = compareItems(beforeItem, afterItem);
    if (change.propertyChanges.length > 0) {
      diff.modified.push(change);
    } else if (change.layoutChanged) {
      diff.layoutChanged.push(change);
    }
  }
  for (const [id, beforeItem] of before) {
    if (!after.has(id)) {
      diff.removed.push(unchanged(beforeItem));
    }
  }
}

function diffMapProperties(before: LandscapeMap, after: LandscapeMap): LandscapePropertyChange[] {
  const changes: LandscapePropertyChange[] = [];
  const compare = (property: string, label: string, beforeValue: string | null, afterValue: string | null): void => {
    if (beforeValue !== afterValue) {
      changes.push({ property, label, before: beforeValue, after: afterValue });
    }
  };
  compare('name', 'Name', before.name, after.name);
  for (const [kind, label] of Object.entries(RELATION_LAYER_LABELS) as [ProcessRelationKind, string][]) {
    compare(`relationLayers.${kind}`, label, String(before.relationLayers[kind]), String(after.relationLayers[kind]));
  }
  const beforeHidden = new Set(before.hiddenRelations);
  const afterHidden = new Set(after.hiddenRelations);
  for (const key of afterHidden) {
    if (!beforeHidden.has(key)) {
      changes.push({ property: 'hiddenRelations', label: 'Hidden relation', before: null, after: key });
    }
  }
  for (const key of beforeHidden) {
    if (!afterHidden.has(key)) {
      changes.push({ property: 'hiddenRelations', label: 'Hidden relation', before: key, after: null });
    }
  }
  compare(
    'extensions',
    'Extensions',
    serializeMapExtensions(before.extensions),
    serializeMapExtensions(after.extensions),
  );
  return changes;
}

/**
 * Compares two maps item by item, matched by id.
 *
 * ponytail: the order of elements, connectors and levels is not compared, so z-order changes (and a reordering of the
 * level names) are invisible in diff and merge; compare the position of each id among its siblings if that matters.
 */
export function diffLandscapeMaps(before: LandscapeMap, after: LandscapeMap): LandscapeMapDiff {
  const diff: LandscapeMapDiff = {
    added: [],
    removed: [],
    modified: [],
    layoutChanged: [],
    mapProperties: diffMapProperties(before, after),
  };
  const beforeItems = comparableItemsOf(before);
  const afterItems = comparableItemsOf(after);
  diffItems(beforeItems.shapes, afterItems.shapes, diff);
  diffItems(beforeItems.levels, afterItems.levels, diff);
  return diff;
}

async function readMap(text: string): Promise<LandscapeMap> {
  const result = await parseLandscapeMap(text);
  if (!result.ok) {
    throw new Error(result.errors.join('\n'));
  }
  return result.map;
}

/** Parses both texts; throws an Error whose message joins the reader's diagnostics. */
export async function diffLandscapeMapTexts(beforeText: string, afterText: string): Promise<LandscapeMapDiff> {
  const [before, after] = await Promise.all([readMap(beforeText), readMap(afterText)]);
  return diffLandscapeMaps(before, after);
}

export function formatLandscapeDiffAsMarkdown(
  diff: LandscapeMapDiff,
  fileName: string,
  options?: { includeHeading?: boolean },
): string {
  const lines: string[] = [];
  if (options?.includeHeading !== false) {
    lines.push(`### Changes in ${fileName}\n`);
  }
  const propertyLine = (change: LandscapePropertyChange): string =>
    `  - ${change.label}: ${formatSummaryValueForDisplay(change.before ?? undefined)} → ${formatSummaryValueForDisplay(change.after ?? undefined)}`;

  if (diff.mapProperties.length > 0) {
    lines.push(`#### Map properties (${diff.mapProperties.length})`, ...diff.mapProperties.map(propertyLine), '');
  }
  const sections: [string, LandscapeItemChange[]][] = [
    ['Added', diff.added],
    ['Removed', diff.removed],
    ['Modified', diff.modified],
    ['Layout changed', diff.layoutChanged],
  ];
  for (const [title, items] of sections) {
    if (items.length === 0) {
      continue;
    }
    lines.push(`#### ${title} (${items.length})`);
    for (const item of items) {
      lines.push(`- ${item.displayName}`, ...item.propertyChanges.map(propertyLine));
    }
    lines.push('');
  }

  if (diff.mapProperties.length === 0 && sections.every(([, items]) => items.length === 0)) {
    lines.push('No semantic changes detected.');
  }
  return lines.join('\n');
}
