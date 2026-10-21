import type { ProcessRelationKind } from './buildProcessRelations';

export const LANDSCAPE_MAP_FORMAT = 'bfw-landscape-map';
export const LANDSCAPE_MAP_VERSION = 1;

export type LandscapeElementStyle = { fill: string | null; stroke: string | null };
export type LandscapeShape = 'box' | 'chevron';

type LandscapeElementBase = {
  id: string;
  /** A band or group that contains the element; `null` at top level. */
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  style: LandscapeElementStyle | null;
};

export type LandscapeBandElement = LandscapeElementBase & { type: 'band'; label: string };
export type LandscapeGroupElement = LandscapeElementBase & { type: 'group'; label: string; collapsed: boolean };
export type LandscapeProcessElement = LandscapeElementBase & {
  type: 'process';
  processId: string;
  /** The BPMN file, relative to the map file; tells processes with the same id apart. */
  fileHint: string | null;
  /** Replaces the process name on the map; `null` shows the process name. */
  label: string | null;
  shape: LandscapeShape;
};
export type LandscapePlaceholderElement = LandscapeElementBase & {
  type: 'placeholder';
  label: string;
  shape: LandscapeShape;
};
export type LandscapeMapLinkElement = LandscapeElementBase & {
  type: 'mapLink';
  label: string;
  /** The linked `.bfwmap`, relative to the map file. */
  mapPath: string;
};
export type LandscapeNoteElement = LandscapeElementBase & { type: 'note'; text: string };

export type LandscapeElement =
  | LandscapeBandElement
  | LandscapeGroupElement
  | LandscapeProcessElement
  | LandscapePlaceholderElement
  | LandscapeMapLinkElement
  | LandscapeNoteElement;
export type LandscapeElementType = LandscapeElement['type'];

export type LandscapePoint = { x: number; y: number };
export type LandscapeConnector = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  waypoints: LandscapePoint[];
};

export type LandscapeLevel = { id: string; name: string };

export type LandscapeMap = {
  name: string;
  /** Names of the nesting depths: `levels[0]` names top-level groups, `levels[1]` groups inside them. */
  levels: LandscapeLevel[];
  relationLayers: Record<ProcessRelationKind, boolean>;
  elements: LandscapeElement[];
  connectors: LandscapeConnector[];
  /** `ProcessRelation.key` of every derived relation the user hid. */
  hiddenRelations: string[];
  /** Top-level keys this Studio does not know, written back unchanged. */
  unknownProperties: Record<string, unknown>;
};

export type LandscapeMapParseResult = { ok: true; map: LandscapeMap } | { ok: false; errors: string[] };

const KNOWN_KEYS = new Set([
  'format',
  'version',
  'name',
  'levels',
  'relationLayers',
  'elements',
  'connectors',
  'hiddenRelations',
]);
const ELEMENT_TYPES = new Set<string>(['band', 'group', 'process', 'placeholder', 'mapLink', 'note']);
const RELATION_KINDS: ProcessRelationKind[] = ['callActivity', 'message', 'signal'];
/** An absolute path, a Windows drive, or a URI scheme. */
const NON_RELATIVE_PATH_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|[\\/])/i;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function createEmptyLandscapeMap(name: string): LandscapeMap {
  return {
    name,
    levels: [],
    relationLayers: { callActivity: true, message: true, signal: true },
    elements: [],
    connectors: [],
    hiddenRelations: [],
    unknownProperties: {},
  };
}

/** Collects every problem of one file, so the user can fix them in one pass. */
class LandscapeMapReader {
  readonly errors: string[] = [];

  string(record: JsonRecord, key: string, where: string, required: 'non-empty' | 'any' = 'any'): string {
    const value = record[key];
    if (typeof value !== 'string' || (required === 'non-empty' && value.trim() === '')) {
      this.errors.push(`${where} needs "${key}" as a ${required === 'non-empty' ? 'non-empty ' : ''}string.`);
      return '';
    }
    return value;
  }

  optionalString(record: JsonRecord, key: string, where: string): string | null {
    const value = record[key];
    if (value == null) {
      return null;
    }
    if (typeof value !== 'string') {
      this.errors.push(`${where} needs "${key}" as a string or null.`);
      return null;
    }
    return value;
  }

  relativePath(record: JsonRecord, key: string, where: string, required: boolean): string | null {
    const value = required ? this.string(record, key, where, 'non-empty') : this.optionalString(record, key, where);
    if (value != null && NON_RELATIVE_PATH_PATTERN.test(value)) {
      this.errors.push(`${where} has "${key}" "${value}", which is not a path relative to the map file.`);
    }
    return value;
  }

  number(record: JsonRecord, key: string, where: string, minimumExclusive?: number): number {
    const value = record[key];
    if (!isFiniteNumber(value) || (minimumExclusive != null && value <= minimumExclusive)) {
      const bound = minimumExclusive == null ? '' : ` greater than ${minimumExclusive}`;
      this.errors.push(`${where} needs "${key}" as a number${bound}.`);
      return minimumExclusive == null ? 0 : minimumExclusive + 1;
    }
    return value;
  }

  array(record: JsonRecord, key: string, where: string): unknown[] {
    const value = record[key];
    if (value == null) {
      return [];
    }
    if (!Array.isArray(value)) {
      this.errors.push(`${where} needs "${key}" as an array.`);
      return [];
    }
    return value;
  }

  shape(record: JsonRecord, where: string): LandscapeShape {
    const value = record.shape ?? 'box';
    if (value !== 'box' && value !== 'chevron') {
      this.errors.push(`${where} has shape "${String(value)}"; use "box" or "chevron".`);
      return 'box';
    }
    return value;
  }

  style(record: JsonRecord, where: string): LandscapeElementStyle | null {
    const value = record.style;
    if (value == null) {
      return null;
    }
    if (!isRecord(value)) {
      this.errors.push(`${where} needs "style" as an object.`);
      return null;
    }
    return {
      fill: this.optionalString(value, 'fill', `${where} style`),
      stroke: this.optionalString(value, 'stroke', `${where} style`),
    };
  }
}

function readLevels(reader: LandscapeMapReader, root: JsonRecord): LandscapeLevel[] {
  return reader.array(root, 'levels', 'The map').flatMap((value, index): LandscapeLevel[] => {
    const where = `Level ${index + 1}`;
    if (!isRecord(value)) {
      reader.errors.push(`${where} is not an object.`);
      return [];
    }
    return [{ id: reader.string(value, 'id', where, 'non-empty'), name: reader.string(value, 'name', where) }];
  });
}

function readRelationLayers(reader: LandscapeMapReader, root: JsonRecord): Record<ProcessRelationKind, boolean> {
  const layers = { callActivity: true, message: true, signal: true };
  const value = root.relationLayers;
  if (value == null) {
    return layers;
  }
  if (!isRecord(value)) {
    reader.errors.push('The map needs "relationLayers" as an object.');
    return layers;
  }
  for (const kind of RELATION_KINDS) {
    const shown = value[kind];
    if (shown != null && typeof shown !== 'boolean') {
      reader.errors.push(`The relation layer "${kind}" must be true or false.`);
    } else if (shown != null) {
      layers[kind] = shown;
    }
  }
  return layers;
}

function readElement(reader: LandscapeMapReader, value: unknown, index: number): LandscapeElement | null {
  if (!isRecord(value)) {
    reader.errors.push(`Element ${index + 1} is not an object.`);
    return null;
  }
  const id = reader.string(value, 'id', `Element ${index + 1}`, 'non-empty');
  const type = value.type;
  const where = `Element '${id}'`;
  if (typeof type !== 'string' || !ELEMENT_TYPES.has(type)) {
    reader.errors.push(`${where} has the unknown type "${String(type)}".`);
    return null;
  }
  const parentId = reader.optionalString(value, 'parentId', where);
  const base: LandscapeElementBase = {
    id,
    parentId: parentId === '' ? null : parentId,
    x: reader.number(value, 'x', where),
    y: reader.number(value, 'y', where),
    width: reader.number(value, 'width', where, 0),
    height: reader.number(value, 'height', where, 0),
    style: reader.style(value, where),
  };
  switch (type) {
    case 'band':
      return { ...base, type, label: reader.string(value, 'label', where) };
    case 'group': {
      const collapsed = value.collapsed ?? false;
      if (typeof collapsed !== 'boolean') {
        reader.errors.push(`${where} needs "collapsed" as true or false.`);
      }
      return { ...base, type, label: reader.string(value, 'label', where), collapsed: collapsed === true };
    }
    case 'process':
      return {
        ...base,
        type,
        processId: reader.string(value, 'processId', where, 'non-empty'),
        fileHint: reader.relativePath(value, 'fileHint', where, false) || null,
        label: reader.optionalString(value, 'label', where),
        shape: reader.shape(value, where),
      };
    case 'placeholder':
      return { ...base, type, label: reader.string(value, 'label', where), shape: reader.shape(value, where) };
    case 'mapLink':
      return {
        ...base,
        type,
        label: reader.string(value, 'label', where),
        mapPath: reader.relativePath(value, 'mapPath', where, true) ?? '',
      };
    default:
      return { ...base, type: 'note', text: reader.string(value, 'text', where) };
  }
}

function readConnector(reader: LandscapeMapReader, value: unknown, index: number): LandscapeConnector | null {
  if (!isRecord(value)) {
    reader.errors.push(`Connector ${index + 1} is not an object.`);
    return null;
  }
  const id = reader.string(value, 'id', `Connector ${index + 1}`, 'non-empty');
  const where = `Connector '${id}'`;
  const waypoints = reader.array(value, 'waypoints', where).flatMap((point, pointIndex): LandscapePoint[] => {
    if (!isRecord(point) || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
      reader.errors.push(`${where} has waypoint ${pointIndex + 1} without numeric "x" and "y".`);
      return [];
    }
    return [{ x: point.x, y: point.y }];
  });
  return {
    id,
    sourceId: reader.string(value, 'sourceId', where, 'non-empty'),
    targetId: reader.string(value, 'targetId', where, 'non-empty'),
    label: reader.optionalString(value, 'label', where) ?? '',
    waypoints,
  };
}

function checkIdentifiers(reader: LandscapeMapReader, map: LandscapeMap): void {
  const seenIds = new Set<string>();
  for (const item of [...map.elements, ...map.connectors]) {
    if (item.id !== '' && seenIds.has(item.id)) {
      reader.errors.push(`The id '${item.id}' is used more than once.`);
    }
    seenIds.add(item.id);
  }
  const seenProcessIds = new Set<string>();
  for (const element of map.elements) {
    if (element.type !== 'process') {
      continue;
    }
    if (seenProcessIds.has(element.processId)) {
      reader.errors.push(`The process '${element.processId}' appears more than once; a map shows a process once.`);
    }
    seenProcessIds.add(element.processId);
  }
}

function checkParents(reader: LandscapeMapReader, map: LandscapeMap): void {
  const elementsById = new Map(map.elements.map((element) => [element.id, element]));
  for (const element of map.elements) {
    if (element.parentId == null) {
      continue;
    }
    const parent = elementsById.get(element.parentId);
    if (parent == null || (parent.type !== 'band' && parent.type !== 'group')) {
      reader.errors.push(`Element '${element.id}' has the parent '${element.parentId}', which is no band or group.`);
    } else if (element.type === 'band') {
      reader.errors.push(`Band '${element.id}' is inside '${element.parentId}'; bands stay at the top level.`);
    }
  }
  for (const element of map.elements) {
    const visited = new Set<string>([element.id]);
    let parentId = element.parentId;
    while (parentId != null) {
      if (visited.has(parentId)) {
        reader.errors.push(`Element '${element.id}' is nested inside itself through '${parentId}'.`);
        break;
      }
      visited.add(parentId);
      parentId = elementsById.get(parentId)?.parentId ?? null;
    }
  }
}

function checkConnectors(reader: LandscapeMapReader, map: LandscapeMap): void {
  const elementIds = new Set(map.elements.map((element) => element.id));
  for (const connector of map.connectors) {
    for (const endpoint of [connector.sourceId, connector.targetId]) {
      if (endpoint !== '' && !elementIds.has(endpoint)) {
        reader.errors.push(`Connector '${connector.id}' points to '${endpoint}', which is not on the map.`);
      }
    }
    if (connector.sourceId !== '' && connector.sourceId === connector.targetId) {
      reader.errors.push(`Connector '${connector.id}' starts and ends at '${connector.sourceId}'.`);
    }
  }
}

function readHeader(reader: LandscapeMapReader, root: JsonRecord): boolean {
  if (root.format !== LANDSCAPE_MAP_FORMAT) {
    reader.errors.push(`The file is not a landscape map: "format" must be "${LANDSCAPE_MAP_FORMAT}".`);
    return false;
  }
  if (isFiniteNumber(root.version) && root.version > LANDSCAPE_MAP_VERSION) {
    reader.errors.push(
      `The map has format version ${root.version}; this Studio reads version ${LANDSCAPE_MAP_VERSION}. Update the Studio to open it.`,
    );
    return false;
  }
  if (root.version !== LANDSCAPE_MAP_VERSION) {
    reader.errors.push(`The map needs "version" ${LANDSCAPE_MAP_VERSION}.`);
    return false;
  }
  return true;
}

/** Reads a `.bfwmap` file; returns every problem found as a diagnostic sentence instead of throwing. */
export function parseLandscapeMap(text: string): LandscapeMapParseResult {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [`The file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
  if (!isRecord(root)) {
    return { ok: false, errors: ['The file is not a landscape map: the top level must be a JSON object.'] };
  }
  const reader = new LandscapeMapReader();
  if (!readHeader(reader, root)) {
    return { ok: false, errors: reader.errors };
  }

  const hiddenRelations = reader.array(root, 'hiddenRelations', 'The map').filter((key): key is string => {
    if (typeof key !== 'string') {
      reader.errors.push(`The hidden relation ${JSON.stringify(key)} is not a string.`);
    }
    return typeof key === 'string';
  });
  const map: LandscapeMap = {
    name: reader.string(root, 'name', 'The map'),
    levels: readLevels(reader, root),
    relationLayers: readRelationLayers(reader, root),
    elements: reader
      .array(root, 'elements', 'The map')
      .map((value, index) => readElement(reader, value, index))
      .filter((element) => element != null),
    connectors: reader
      .array(root, 'connectors', 'The map')
      .map((value, index) => readConnector(reader, value, index))
      .filter((connector) => connector != null),
    hiddenRelations,
    unknownProperties: Object.fromEntries(Object.entries(root).filter(([key]) => !KNOWN_KEYS.has(key))),
  };
  checkIdentifiers(reader, map);
  checkParents(reader, map);
  checkConnectors(reader, map);
  return reader.errors.length > 0 ? { ok: false, errors: reader.errors } : { ok: true, map };
}

function writeElement(element: LandscapeElement): JsonRecord {
  const written: JsonRecord = { id: element.id, type: element.type, parentId: element.parentId };
  switch (element.type) {
    case 'band':
      written.label = element.label;
      break;
    case 'group':
      written.label = element.label;
      written.collapsed = element.collapsed;
      break;
    case 'process':
      written.processId = element.processId;
      written.fileHint = element.fileHint;
      written.label = element.label;
      written.shape = element.shape;
      break;
    case 'placeholder':
      written.label = element.label;
      written.shape = element.shape;
      break;
    case 'mapLink':
      written.label = element.label;
      written.mapPath = element.mapPath;
      break;
    case 'note':
      written.text = element.text;
      break;
  }
  Object.assign(written, { x: element.x, y: element.y, width: element.width, height: element.height });
  if (element.style != null) {
    written.style = { fill: element.style.fill, stroke: element.style.stroke };
  }
  return written;
}

/** Writes a map with a fixed key order, two-space indentation and a trailing newline, so diffs stay small. */
export function serializeLandscapeMap(map: LandscapeMap): string {
  const written = {
    format: LANDSCAPE_MAP_FORMAT,
    version: LANDSCAPE_MAP_VERSION,
    name: map.name,
    levels: map.levels.map((level) => ({ id: level.id, name: level.name })),
    relationLayers: {
      callActivity: map.relationLayers.callActivity,
      message: map.relationLayers.message,
      signal: map.relationLayers.signal,
    },
    elements: map.elements.map(writeElement),
    connectors: map.connectors.map((connector) => ({
      id: connector.id,
      sourceId: connector.sourceId,
      targetId: connector.targetId,
      label: connector.label,
      waypoints: connector.waypoints.map((point) => ({ x: point.x, y: point.y })),
    })),
    hiddenRelations: map.hiddenRelations,
    ...map.unknownProperties,
  };
  return `${JSON.stringify(written, null, 2)}\n`;
}
