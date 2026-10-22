import type { ModdleElement, PackageDefinition, PropertyDefinition } from 'moddle';
import { Moddle } from 'moddle';
import type { ParseError, ParseWarning } from 'moddle-xml';
import { Reader, Writer } from 'moddle-xml';

import type { ProcessRelationKind } from './buildProcessRelations';

const LANDSCAPE_MAP_NAMESPACE = 'https://bifrostforge.world/schema/landscape';
const LANDSCAPE_MAP_VERSION = 1;

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
  /** Foreign-namespace attributes and child elements of the root, written back unchanged. */
  extensions: { attributes: Record<string, string>; elements: unknown[] };
};

export type LandscapeMapParseResult = { ok: true; map: LandscapeMap } | { ok: false; errors: string[] };

const attribute = (name: string, type = 'String', extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({
  name,
  type,
  isAttr: true,
  ...extra,
});

const LANDSCAPE_PACKAGE: PackageDefinition = {
  name: 'Landscape',
  prefix: 'landscape',
  uri: LANDSCAPE_MAP_NAMESPACE,
  xml: { tagAlias: 'lowerCase' },
  types: [
    {
      name: 'Map',
      properties: [
        attribute('version', 'Integer'),
        attribute('name'),
        { name: 'relationLayers', type: 'RelationLayers' },
        { name: 'levels', type: 'Level', isMany: true },
        { name: 'elements', type: 'MapElement', isMany: true },
        { name: 'connectors', type: 'Connector', isMany: true },
        { name: 'hiddenRelations', type: 'HiddenRelation', isMany: true },
        { name: 'extensions', type: 'Element', isMany: true },
      ],
    },
    {
      name: 'RelationLayers',
      properties: ['callActivity', 'message', 'signal'].map((kind) => attribute(kind, 'Boolean', { default: true })),
    },
    { name: 'Level', properties: [attribute('id'), attribute('name')] },
    {
      name: 'MapElement',
      isAbstract: true,
      properties: [
        attribute('id'),
        attribute('x', 'Real'),
        attribute('y', 'Real'),
        attribute('width', 'Real'),
        attribute('height', 'Real'),
        attribute('fill'),
        attribute('stroke'),
      ],
    },
    {
      name: 'Container',
      isAbstract: true,
      superClass: ['MapElement'],
      properties: [attribute('label'), { name: 'elements', type: 'MapElement', isMany: true }],
    },
    { name: 'Band', superClass: ['Container'] },
    { name: 'Group', superClass: ['Container'], properties: [attribute('collapsed', 'Boolean', { default: false })] },
    {
      name: 'Process',
      superClass: ['MapElement'],
      properties: [attribute('processId'), attribute('fileHint'), attribute('label'), attribute('shape')],
    },
    { name: 'Placeholder', superClass: ['MapElement'], properties: [attribute('label'), attribute('shape')] },
    { name: 'MapLink', superClass: ['MapElement'], properties: [attribute('label'), attribute('mapPath')] },
    { name: 'Note', superClass: ['MapElement'], properties: [{ name: 'text', type: 'String', isBody: true }] },
    {
      name: 'Connector',
      properties: [
        attribute('id'),
        attribute('sourceId'),
        attribute('targetId'),
        attribute('label'),
        { name: 'waypoints', type: 'Waypoint', isMany: true },
      ],
    },
    { name: 'Waypoint', properties: [attribute('x', 'Real'), attribute('y', 'Real')] },
    { name: 'HiddenRelation', properties: [attribute('key')] },
  ],
};

const LANDSCAPE_MODDLE = new Moddle([LANDSCAPE_PACKAGE]);

const MODDLE_TYPE_BY_ELEMENT_TYPE: Record<LandscapeElementType, string> = {
  band: 'landscape:Band',
  group: 'landscape:Group',
  process: 'landscape:Process',
  placeholder: 'landscape:Placeholder',
  mapLink: 'landscape:MapLink',
  note: 'landscape:Note',
};
const ELEMENT_TYPE_BY_MODDLE_TYPE = new Map(
  Object.entries(MODDLE_TYPE_BY_ELEMENT_TYPE).map(([type, moddleType]) => [moddleType, type as LandscapeElementType]),
);

const NOT_A_MAP_MESSAGE = `The file is not a landscape map: the root element must be <landscape:map> in the namespace ${LANDSCAPE_MAP_NAMESPACE}.`;
/** An absolute path, a Windows drive, or a URI scheme. */
const NON_RELATIVE_PATH_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|[\\/])/i;
const UNPARSABLE_CONTENT_PATTERN =
  /^unparsable content .* detected\n\tline: (\d+)\n\tcolumn: (\d+)\n\tnested error: (.*)$/s;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** `landscape:MapLink` → `<landscape:mapLink>`, the tag the element has in the file. */
const tagOf = (node: ModdleElement): string => {
  const [prefix, name] = node.$type.split(':');
  return `<${prefix}:${name.charAt(0).toLowerCase()}${name.slice(1)}>`;
};

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_RANDOM_LENGTH = 7;
const ID_PREFIX_BY_TYPE: Record<LandscapeElementType | 'connector', string> = {
  band: 'Band',
  group: 'Group',
  process: 'Process',
  placeholder: 'Placeholder',
  mapLink: 'MapLink',
  note: 'Note',
  connector: 'Connector',
};

/**
 * A new id in the pattern bpmn-js uses: type, underscore, seven random base-36 characters (`Group_0k3x9vb`).
 * A taken id is drawn again, because the reader rejects a map that uses an id twice.
 */
export function createElementId(type: LandscapeElementType | 'connector', isTaken: (id: string) => boolean): string {
  let id: string;
  do {
    const randomValues = crypto.getRandomValues(new Uint8Array(ID_RANDOM_LENGTH));
    id = `${ID_PREFIX_BY_TYPE[type]}_${Array.from(randomValues, (value) => ID_ALPHABET[value % ID_ALPHABET.length]).join('')}`;
  } while (isTaken(id));
  return id;
}

export function createEmptyLandscapeMap(name: string): LandscapeMap {
  return {
    name,
    levels: [],
    relationLayers: { callActivity: true, message: true, signal: true },
    elements: [],
    connectors: [],
    hiddenRelations: [],
    extensions: { attributes: {}, elements: [] },
  };
}

/** The path of `fileUri` relative to the folder of the map at `mapUri`, with `/` separators, as `fileHint` stores it. */
export function relativeFileHint(mapUri: string, fileUri: string): string {
  const mapFolderSegments = mapUri.split('/').slice(0, -1);
  const fileSegments = fileUri.split('/');
  let sharedCount = 0;
  while (
    sharedCount < mapFolderSegments.length &&
    sharedCount < fileSegments.length - 1 &&
    mapFolderSegments[sharedCount] === fileSegments[sharedCount]
  ) {
    sharedCount++;
  }
  const upwards = mapFolderSegments.slice(sharedCount).map(() => '..');
  return [...upwards, ...fileSegments.slice(sharedCount)].join('/');
}

/** Turns a moddle-xml warning into a diagnostic sentence with a 1-based position. */
function describeParseProblem(warning: ParseWarning & { element?: ModdleElement }): string {
  const unparsable = UNPARSABLE_CONTENT_PATTERN.exec(warning.message);
  if (unparsable != null) {
    const nestedError = unparsable[3].replace(/\s*\[\]$/, '');
    return `Line ${Number(unparsable[1]) + 1}, column ${Number(unparsable[2]) + 1}: ${nestedError}.`;
  }
  const message = `${warning.message.charAt(0).toUpperCase()}${warning.message.slice(1)}`;
  if (warning.element == null) {
    return `${message}.`;
  }
  const id = warning.element.get('id');
  return `${message} on ${tagOf(warning.element)}${typeof id === 'string' && id !== '' ? ` '${id}'` : ''}.`;
}

/** Collects every problem of one file, so the user can fix them in one pass. */
class LandscapeMapReader {
  readonly errors: string[] = [];

  /** A missing attribute reads as an empty string; `non-empty` reports it. */
  string(node: ModdleElement, key: string, where: string, required: 'non-empty' | 'any' = 'any'): string {
    const value: unknown = node.get(key);
    const text = typeof value === 'string' ? value : '';
    if (required === 'non-empty' && text.trim() === '') {
      this.errors.push(`${where} needs a non-empty "${key}".`);
    }
    return text;
  }

  optionalString(node: ModdleElement, key: string): string | null {
    const value: unknown = node.get(key);
    return typeof value === 'string' && value !== '' ? value : null;
  }

  relativePath(node: ModdleElement, key: string, where: string, required: boolean): string | null {
    const value = required ? this.string(node, key, where, 'non-empty') : this.optionalString(node, key);
    if (value != null && NON_RELATIVE_PATH_PATTERN.test(value)) {
      this.errors.push(`${where} has "${key}" "${value}", which is not a path relative to the map file.`);
    }
    return value;
  }

  number(node: ModdleElement, key: string, where: string, minimumExclusive?: number): number {
    const value: unknown = node.get(key);
    if (!isFiniteNumber(value) || (minimumExclusive != null && value <= minimumExclusive)) {
      const bound = minimumExclusive == null ? '' : ` greater than ${minimumExclusive}`;
      this.errors.push(`${where} needs "${key}" as a number${bound}.`);
      return minimumExclusive == null ? 0 : minimumExclusive + 1;
    }
    return value;
  }

  shape(node: ModdleElement, where: string): LandscapeShape {
    const value: unknown = node.get('shape') ?? 'box';
    if (value !== 'box' && value !== 'chevron') {
      this.errors.push(`${where} has shape "${String(value)}"; use "box" or "chevron".`);
      return 'box';
    }
    return value;
  }

  style(node: ModdleElement): LandscapeElementStyle | null {
    const fill = this.optionalString(node, 'fill');
    const stroke = this.optionalString(node, 'stroke');
    return fill == null && stroke == null ? null : { fill, stroke };
  }
}

function readElement(
  reader: LandscapeMapReader,
  node: ModdleElement,
  parentId: string | null,
): LandscapeElement | null {
  const type = ELEMENT_TYPE_BY_MODDLE_TYPE.get(node.$type);
  if (type == null) {
    reader.errors.push(`${tagOf(node)} cannot be placed on a map.`);
    return null;
  }
  const id = reader.string(node, 'id', `An element ${tagOf(node)}`, 'non-empty');
  const where = `Element '${id}'`;
  const base: LandscapeElementBase = {
    id,
    parentId,
    x: reader.number(node, 'x', where),
    y: reader.number(node, 'y', where),
    width: reader.number(node, 'width', where, 0),
    height: reader.number(node, 'height', where, 0),
    style: reader.style(node),
  };
  switch (type) {
    case 'band':
      if (parentId != null) {
        reader.errors.push(`Band '${id}' is inside '${parentId}'; bands stay at the top level.`);
      }
      return { ...base, type, label: reader.string(node, 'label', where) };
    case 'group':
      return { ...base, type, label: reader.string(node, 'label', where), collapsed: node.get('collapsed') === true };
    case 'process':
      return {
        ...base,
        type,
        processId: reader.string(node, 'processId', where, 'non-empty'),
        fileHint: reader.relativePath(node, 'fileHint', where, false),
        label: reader.optionalString(node, 'label'),
        shape: reader.shape(node, where),
      };
    case 'placeholder':
      return { ...base, type, label: reader.string(node, 'label', where), shape: reader.shape(node, where) };
    case 'mapLink':
      return {
        ...base,
        type,
        label: reader.string(node, 'label', where),
        mapPath: reader.relativePath(node, 'mapPath', where, true) ?? '',
      };
    case 'note':
      return { ...base, type, text: reader.string(node, 'text', where) };
  }
}

/** Depth-first, parents before their children, as the canvas import needs them. */
function readElements(
  reader: LandscapeMapReader,
  container: ModdleElement,
  parentId: string | null,
  elements: LandscapeElement[],
): void {
  for (const node of container.get('elements') as ModdleElement[]) {
    const element = readElement(reader, node, parentId);
    if (element == null) {
      continue;
    }
    elements.push(element);
    if (element.type === 'band' || element.type === 'group') {
      readElements(reader, node, element.id, elements);
    }
  }
}

function readConnector(reader: LandscapeMapReader, node: ModdleElement): LandscapeConnector {
  const id = reader.string(node, 'id', 'A connector', 'non-empty');
  const where = `Connector '${id}'`;
  const waypoints = (node.get('waypoints') as ModdleElement[]).flatMap((point, pointIndex): LandscapePoint[] => {
    const x: unknown = point.get('x');
    const y: unknown = point.get('y');
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      reader.errors.push(`${where} has waypoint ${pointIndex + 1} without numeric "x" and "y".`);
      return [];
    }
    return [{ x, y }];
  });
  return {
    id,
    sourceId: reader.string(node, 'sourceId', where, 'non-empty'),
    targetId: reader.string(node, 'targetId', where, 'non-empty'),
    label: reader.string(node, 'label', where),
    waypoints,
  };
}

function readRelationLayers(root: ModdleElement): Record<ProcessRelationKind, boolean> {
  const layers: ModdleElement | undefined = root.get('relationLayers');
  return {
    callActivity: layers?.get('callActivity') !== false,
    message: layers?.get('message') !== false,
    signal: layers?.get('signal') !== false,
  };
}

/** The root's own namespace declaration is written by moddle; everything else on the root is kept. */
function readExtensionAttributes(root: ModdleElement): Record<string, string> {
  return Object.fromEntries(
    Object.entries(root.$attrs).filter(
      ([name, value]) => !((name === 'xmlns' || name.startsWith('xmlns:')) && value === LANDSCAPE_MAP_NAMESPACE),
    ),
  );
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

function checkConnectors(reader: LandscapeMapReader, map: LandscapeMap): void {
  const typeById = new Map(map.elements.map((element) => [element.id, element.type]));
  for (const connector of map.connectors) {
    for (const endpoint of [connector.sourceId, connector.targetId]) {
      if (endpoint !== '' && !typeById.has(endpoint)) {
        reader.errors.push(`Connector '${connector.id}' points to '${endpoint}', which is not on the map.`);
      } else if (typeById.get(endpoint) === 'band') {
        reader.errors.push(`Connector '${connector.id}' ends at the band '${endpoint}'; bands cannot be connected.`);
      }
    }
    if (connector.sourceId !== '' && connector.sourceId === connector.targetId) {
      reader.errors.push(`Connector '${connector.id}' starts and ends at '${connector.sourceId}'.`);
    }
  }
}

/** Returns the problem that stops reading, or `null` when the map has the version this Studio reads. */
function checkVersion(root: ModdleElement): string | null {
  const version: unknown = root.get('version');
  if (isFiniteNumber(version) && version > LANDSCAPE_MAP_VERSION) {
    return `The map has format version ${version}; this Studio reads version ${LANDSCAPE_MAP_VERSION}. Update the Studio to open it.`;
  }
  return version === LANDSCAPE_MAP_VERSION ? null : `The map needs version ${LANDSCAPE_MAP_VERSION}.`;
}

/** Reads a `.bfwmap` file; returns every problem found as a diagnostic sentence instead of throwing. */
export async function parseLandscapeMap(text: string): Promise<LandscapeMapParseResult> {
  let root: ModdleElement;
  let warnings: ParseWarning[];
  try {
    ({ rootElement: root, warnings } = await new Reader({ model: LANDSCAPE_MODDLE, lax: true }).fromXML(
      text,
      'landscape:Map',
    ));
  } catch (error) {
    const parseError = error as ParseError;
    if (parseError.message.startsWith('failed to parse document')) {
      return { ok: false, errors: [NOT_A_MAP_MESSAGE] };
    }
    return {
      ok: false,
      errors: [
        `The file is not well-formed XML. ${describeParseProblem({ message: parseError.message })}`,
        ...(parseError.warnings ?? []).map(describeParseProblem),
      ],
    };
  }

  const versionProblem = checkVersion(root);
  if (versionProblem != null) {
    return { ok: false, errors: [versionProblem] };
  }
  const reader = new LandscapeMapReader();
  reader.errors.push(...warnings.map(describeParseProblem));

  const elements: LandscapeElement[] = [];
  readElements(reader, root, null, elements);
  const map: LandscapeMap = {
    name: reader.string(root, 'name', 'The map'),
    levels: (root.get('levels') as ModdleElement[]).map((level) => ({
      id: reader.string(level, 'id', 'A level', 'non-empty'),
      name: reader.string(level, 'name', 'A level'),
    })),
    relationLayers: readRelationLayers(root),
    elements,
    connectors: (root.get('connectors') as ModdleElement[]).map((node) => readConnector(reader, node)),
    hiddenRelations: (root.get('hiddenRelations') as ModdleElement[]).map((node) =>
      reader.string(node, 'key', 'A hidden relation', 'non-empty'),
    ),
    extensions: { attributes: readExtensionAttributes(root), elements: [...root.get('extensions')] },
  };
  checkIdentifiers(reader, map);
  checkConnectors(reader, map);
  return reader.errors.length > 0 ? { ok: false, errors: reader.errors } : { ok: true, map };
}

/** Leaves out every property that is `null`, `undefined` or empty, so defaults are not written. */
function createNode(type: string, properties: Record<string, unknown>): ModdleElement {
  return LANDSCAPE_MODDLE.create(
    type,
    Object.fromEntries(Object.entries(properties).filter(([, value]) => value != null && value !== '')),
  );
}

function writeElement(
  element: LandscapeElement,
  childrenByParentId: Map<string | null, LandscapeElement[]>,
): ModdleElement {
  const properties: Record<string, unknown> = {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    fill: element.style?.fill,
    stroke: element.style?.stroke,
  };
  switch (element.type) {
    case 'band':
      properties.label = element.label;
      break;
    case 'group':
      properties.label = element.label;
      properties.collapsed = element.collapsed || null;
      break;
    case 'process':
      properties.processId = element.processId;
      properties.fileHint = element.fileHint;
      properties.label = element.label;
      properties.shape = element.shape === 'box' ? null : element.shape;
      break;
    case 'placeholder':
      properties.label = element.label;
      properties.shape = element.shape === 'box' ? null : element.shape;
      break;
    case 'mapLink':
      properties.label = element.label;
      properties.mapPath = element.mapPath;
      break;
    case 'note':
      properties.text = element.text;
      break;
  }
  const node = createNode(MODDLE_TYPE_BY_ELEMENT_TYPE[element.type], properties);
  if (element.type === 'band' || element.type === 'group') {
    node
      .get('elements')
      .push(...(childrenByParentId.get(element.id) ?? []).map((child) => writeElement(child, childrenByParentId)));
  }
  return node;
}

/** Writes a map as indented XML with a fixed attribute order and only non-default values, so diffs stay small. */
export function serializeLandscapeMap(map: LandscapeMap): string {
  const containerIds = new Set(
    map.elements.flatMap((element) => (element.type === 'band' || element.type === 'group' ? [element.id] : [])),
  );
  const childrenByParentId = new Map<string | null, LandscapeElement[]>();
  for (const element of map.elements) {
    const parentId = element.parentId != null && containerIds.has(element.parentId) ? element.parentId : null;
    childrenByParentId.set(parentId, [...(childrenByParentId.get(parentId) ?? []), element]);
  }

  const root = createNode('landscape:Map', { version: LANDSCAPE_MAP_VERSION, name: map.name });
  Object.assign(root.$attrs, map.extensions.attributes);
  const { callActivity, message, signal } = map.relationLayers;
  if (!callActivity || !message || !signal) {
    root.set(
      'relationLayers',
      createNode('landscape:RelationLayers', {
        callActivity: callActivity ? null : false,
        message: message ? null : false,
        signal: signal ? null : false,
      }),
    );
  }
  root.get('levels').push(...map.levels.map((level) => createNode('landscape:Level', level)));
  root
    .get('elements')
    .push(...(childrenByParentId.get(null) ?? []).map((element) => writeElement(element, childrenByParentId)));
  root.get('connectors').push(
    ...map.connectors.map((connector) => {
      const node = createNode('landscape:Connector', {
        id: connector.id,
        sourceId: connector.sourceId,
        targetId: connector.targetId,
        label: connector.label,
      });
      node.get('waypoints').push(...connector.waypoints.map((point) => createNode('landscape:Waypoint', point)));
      return node;
    }),
  );
  root
    .get('hiddenRelations')
    .push(...map.hiddenRelations.map((key) => createNode('landscape:HiddenRelation', { key })));
  root.get('extensions').push(...map.extensions.elements);
  return new Writer({ format: true }).toXML(root);
}
