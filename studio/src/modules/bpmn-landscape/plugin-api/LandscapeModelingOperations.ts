import type { Bifrost } from '#bifrost/Bifrost';

import type {
  LandscapeCreateConnectionResult,
  LandscapeCreateElementDescriptor,
  LandscapeCreateElementResult,
  LandscapeMoveDelta,
} from '@elraptorus/bfw_studio_sdk';

import type { LandscapeElement } from '../LandscapeMapFile';
import { createElementId, isPlainColour, isRelativePath, relativeFileHint } from '../LandscapeMapFile';
import type LandscapeCollapse from '../modeler/LandscapeCollapse';
import type LandscapeModeler from '../modeler/LandscapeModeler';
import { UPDATE_ELEMENT_COMMAND } from '../modeler/LandscapeUpdates';
import { shapeAttributesOf } from '../modeler/landscapeCanvasMapping';
import { isCollapsedGroup } from '../modeler/landscapeHierarchy';

const CREATABLE_TYPES = ['band', 'group', 'process', 'placeholder', 'mapLink', 'note'] as const;
type CreatableType = (typeof CREATABLE_TYPES)[number];

const DEFAULT_SIZE: Record<CreatableType, { width: number; height: number }> = {
  band: { width: 1200, height: 240 },
  group: { width: 400, height: 240 },
  process: { width: 140, height: 60 },
  placeholder: { width: 140, height: 60 },
  mapLink: { width: 140, height: 60 },
  note: { width: 160, height: 80 },
};

/** The space between an element and the one appended below it. */
const APPEND_GAP = 60;

/** The properties a plugin may change per element type; `mapUri` is stored as `mapPath`, `collapsed` by toggling. */
const WRITABLE_PROPERTIES: Record<CreatableType, string[]> = {
  band: ['label', 'style'],
  group: ['label', 'style', 'collapsed'],
  process: ['label', 'style', 'shape', 'processId', 'fileHint'],
  placeholder: ['label', 'style', 'shape'],
  mapLink: ['label', 'style', 'mapUri'],
  note: ['text', 'style'],
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

function invalidProperty(name: string, expectation: string): Error {
  return new Error(`Property '${name}' must be ${expectation}`);
}

function readColour(value: unknown, name: string): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string' || !isPlainColour(value)) {
    throw invalidProperty(name, `null or a plain colour such as '#ffcdd2'`);
  }
  return value;
}

function readStyle(value: unknown): { fill: string | null; stroke: string | null } | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw invalidProperty('style', 'null or an object with fill and stroke');
  }
  const { fill, stroke } = value as Record<string, unknown>;
  return { fill: readColour(fill, 'style.fill'), stroke: readColour(stroke, 'style.stroke') };
}

/**
 * Programmatic edits of an open landscape map for the `api.landscape.modeling` plugin API. Every change goes through
 * the diagram-js command stack, so it can be undone, and is checked against the rules the editor applies to the user.
 */
export class LandscapeModelingOperations {
  constructor(private readonly bifrost: Bifrost) {}

  updateProperties(
    mapUri: string,
    modeler: LandscapeModeler,
    elementId: string,
    properties: Record<string, unknown>,
  ): void {
    const element = this.requireElement(modeler, elementId, 'Element');
    if (element.type === 'relation' || element.type === 'connector') {
      throw new Error(`Properties of the ${element.type} '${elementId}' cannot be changed`);
    }
    const allowed = WRITABLE_PROPERTIES[element.type as CreatableType];
    for (const name of Object.keys(properties)) {
      if (!allowed.includes(name)) {
        throw new Error(`Property '${name}' cannot be set on the ${element.type} '${elementId}'`);
      }
    }
    const { collapsed, ...fileProperties } = this.toFileProperties(mapUri, modeler, element, properties);
    if (Object.keys(fileProperties).length > 0) {
      modeler.get('commandStack').execute(UPDATE_ELEMENT_COMMAND, { element, properties: fileProperties });
    }
    if (typeof collapsed === 'boolean' && collapsed !== isCollapsedGroup(element)) {
      modeler.get<LandscapeCollapse>('landscapeCollapse').toggle(element);
    }
  }

  removeElement(modeler: LandscapeModeler, elementId: string): void {
    const element = this.requireElement(modeler, elementId, 'Element');
    if (modeler.get('rules').allowed('elements.delete', { elements: [element] }) === false) {
      throw new Error(`The ${element.type} '${elementId}' cannot be removed: it is derived or hidden`);
    }
    modeler.get('modeling').removeElements([element]);
  }

  createElement(
    mapUri: string,
    modeler: LandscapeModeler,
    descriptor: LandscapeCreateElementDescriptor,
  ): LandscapeCreateElementResult {
    this.assertCreatable(descriptor);
    this.assertPosition(descriptor.position);
    if (descriptor.type === 'band' && modeler.get('canvas').getRootElement().group != null) {
      throw new Error('A band can only be created on the map itself, not inside a group that is open');
    }
    if (descriptor.type === 'process' && modeler.findProcessShape(descriptor.processId as string) != null) {
      throw new Error(`The map already shows the process '${descriptor.processId}'`);
    }
    const element = this.buildElement(mapUri, modeler, descriptor);
    const center = {
      x: descriptor.position.x + element.width / 2,
      y: descriptor.position.y + element.height / 2,
    };
    return { elementId: modeler.addElementShape(element, center).id };
  }

  appendElement(
    mapUri: string,
    modeler: LandscapeModeler,
    sourceElementId: string,
    newElement: Omit<LandscapeCreateElementDescriptor, 'position'>,
  ): LandscapeCreateElementResult {
    const source = this.requireElement(modeler, sourceElementId, 'Source element');
    if (modeler.get('rules').allowed('connection.start', { source }) === false) {
      throw new Error(`The ${source.type} '${sourceElementId}' cannot have a connector`);
    }
    const position = { x: source.x, y: source.y + source.height + APPEND_GAP };
    const descriptor = { ...newElement, position };
    this.assertCreatable(descriptor);
    if (descriptor.type === 'band') {
      throw new Error('A band cannot be connected, so it cannot be appended');
    }
    const element = this.buildElement(mapUri, modeler, descriptor);
    const shape = modeler.get('elementFactory').createShape(shapeAttributesOf(element));
    if (modeler.get('rules').allowed('shape.create', { shape, target: source.parent }) === false) {
      throw new Error(`A ${element.type} cannot be created next to '${sourceElementId}'`);
    }
    const center = { x: position.x + element.width / 2, y: position.y + element.height / 2 };
    const created = modeler.get('modeling').createShape(shape, center, source.parent);
    this.connect(modeler, source, created);
    return { elementId: created.id };
  }

  createConnection(modeler: LandscapeModeler, sourceId: string, targetId: string): LandscapeCreateConnectionResult {
    const source = this.requireElement(modeler, sourceId, 'Source element');
    const target = this.requireElement(modeler, targetId, 'Target element');
    return { connectionId: this.connect(modeler, source, target).id };
  }

  moveElement(modeler: LandscapeModeler, elementId: string, delta: LandscapeMoveDelta): void {
    const element = this.requireElement(modeler, elementId, 'Element');
    if (element.waypoints != null) {
      throw new Error(`The ${element.type} '${elementId}' is a line and cannot be moved; move the elements it joins`);
    }
    if (!Number.isFinite(delta?.x) || !Number.isFinite(delta?.y)) {
      throw new Error('Delta must contain finite numbers for x and y');
    }
    modeler.get('modeling').moveElements([element], delta);
  }

  private connect(modeler: LandscapeModeler, source: any, target: any): any {
    const attributes = modeler.get('rules').allowed('connection.create', { source, target });
    if (attributes === false) {
      throw new Error(`'${source.id}' and '${target.id}' cannot be connected`);
    }
    return modeler.get('modeling').connect(source, target, attributes);
  }

  private requireElement(modeler: LandscapeModeler, elementId: string, role: string): any {
    const element = modeler.get('elementRegistry').get(elementId);
    if (element == null || element.parent == null || element.businessObject == null) {
      throw new Error(`${role} '${elementId}' not found in document`);
    }
    return element;
  }

  private assertCreatable(descriptor: LandscapeCreateElementDescriptor): void {
    if (!CREATABLE_TYPES.includes(descriptor?.type)) {
      throw new Error(`'type' must be one of ${CREATABLE_TYPES.join(', ')}`);
    }
    if (descriptor.label != null && typeof descriptor.label !== 'string') {
      throw invalidProperty('label', 'a string');
    }
    if (descriptor.text != null && typeof descriptor.text !== 'string') {
      throw invalidProperty('text', 'a string');
    }
    if (descriptor.type === 'process' && !isNonEmptyString(descriptor.processId)) {
      throw new Error(`'processId' is required for a process`);
    }
    if (
      descriptor.fileHint != null &&
      (typeof descriptor.fileHint !== 'string' || !isRelativePath(descriptor.fileHint))
    ) {
      throw invalidProperty('fileHint', 'a path relative to the map file');
    }
    if (descriptor.type === 'mapLink' && !isNonEmptyString(descriptor.mapUri)) {
      throw new Error(`'mapUri' is required for a map link`);
    }
  }

  private assertPosition(position: { x: number; y: number } | undefined): void {
    if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) {
      throw new Error(`'position' must contain finite numbers for x and y`);
    }
  }

  private buildElement(
    mapUri: string,
    modeler: LandscapeModeler,
    descriptor: LandscapeCreateElementDescriptor,
  ): LandscapeElement {
    const base = {
      id: createElementId(descriptor.type, (id) => modeler.get('elementRegistry').get(id) != null),
      parentId: null,
      x: 0,
      y: 0,
      ...DEFAULT_SIZE[descriptor.type],
      style: null,
    };
    switch (descriptor.type) {
      case 'band':
        return { ...base, type: 'band', label: descriptor.label ?? 'Band' };
      case 'group':
        return { ...base, type: 'group', label: descriptor.label ?? 'Group', collapsed: false };
      case 'process':
        return {
          ...base,
          type: 'process',
          processId: descriptor.processId as string,
          fileHint: descriptor.fileHint ?? null,
          label: descriptor.label ?? null,
          shape: 'box',
        };
      case 'placeholder':
        return { ...base, type: 'placeholder', label: descriptor.label ?? 'Placeholder', shape: 'box' };
      case 'mapLink':
        return {
          ...base,
          type: 'mapLink',
          label: descriptor.label ?? this.bifrost.files.getLocalBasename(descriptor.mapUri as string, true),
          mapPath: relativeFileHint(mapUri, descriptor.mapUri as string),
        };
      case 'note':
        return { ...base, type: 'note', text: descriptor.text ?? 'Note' };
    }
  }

  /** Checks every value and turns the plugin's names into the file element's: `mapUri` becomes `mapPath`. */
  private toFileProperties(
    mapUri: string,
    modeler: LandscapeModeler,
    element: any,
    properties: Record<string, unknown>,
  ): Record<string, unknown> {
    const fileProperties: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(properties)) {
      switch (name) {
        case 'label':
          // A process label may be null: the process name is shown then.
          if (typeof value !== 'string' && !(value === null && element.type === 'process')) {
            throw invalidProperty('label', element.type === 'process' ? 'a string or null' : 'a string');
          }
          fileProperties.label = value;
          break;
        case 'text':
          if (typeof value !== 'string') {
            throw invalidProperty('text', 'a string');
          }
          fileProperties.text = value;
          break;
        case 'style':
          fileProperties.style = readStyle(value);
          break;
        case 'shape':
          if (value !== 'box' && value !== 'chevron') {
            throw invalidProperty('shape', `'box' or 'chevron'`);
          }
          fileProperties.shape = value;
          break;
        case 'collapsed':
          if (typeof value !== 'boolean') {
            throw invalidProperty('collapsed', 'a boolean');
          }
          fileProperties.collapsed = value;
          break;
        case 'processId': {
          const otherShape = isNonEmptyString(value) ? modeler.findProcessShape(value) : undefined;
          if (!isNonEmptyString(value) || (otherShape != null && otherShape !== element)) {
            throw invalidProperty('processId', 'a process id that the map does not show yet');
          }
          fileProperties.processId = value;
          break;
        }
        case 'fileHint':
          if (value !== null && (typeof value !== 'string' || !isRelativePath(value))) {
            throw invalidProperty('fileHint', 'null or a path relative to the map file');
          }
          fileProperties.fileHint = value;
          break;
        case 'mapUri':
          if (!isNonEmptyString(value)) {
            throw invalidProperty('mapUri', 'a map file URI');
          }
          fileProperties.mapPath = relativeFileHint(mapUri, value);
          break;
      }
    }
    return fileProperties;
  }
}
