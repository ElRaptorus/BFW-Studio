import type { LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import {
  createEmptyLandscapeMap,
  parseLandscapeMap,
  serializeLandscapeMap,
} from '#modules/bpmn-landscape/LandscapeMapFile';
import { describe, expect, it } from 'vitest';

const geometry = { x: 10, y: 20, width: 160, height: 60 };

function fullMap(): LandscapeMap {
  return {
    ...createEmptyLandscapeMap('Order to Cash'),
    levels: [
      { id: 'level-domain', name: 'Domain' },
      { id: 'level-group', name: 'Process group' },
    ],
    relationLayers: { callActivity: true, message: false, signal: true },
    elements: [
      { id: 'band', type: 'band', parentId: null, label: 'Core', style: null, ...geometry, width: 1200 },
      { id: 'sales', type: 'group', parentId: 'band', label: 'Sales', collapsed: true, style: null, ...geometry },
      {
        id: 'order',
        type: 'process',
        parentId: 'sales',
        processId: 'order-process',
        fileHint: 'processes/order.bpmn',
        label: null,
        shape: 'chevron',
        style: { fill: '#ffeecc', stroke: null },
        ...geometry,
      },
      { id: 'returns', type: 'placeholder', parentId: null, label: 'Returns', shape: 'box', style: null, ...geometry },
      {
        id: 'finance',
        type: 'mapLink',
        parentId: null,
        label: 'Finance',
        mapPath: '../finance.bfwmap',
        style: null,
        ...geometry,
      },
      { id: 'note', type: 'note', parentId: null, text: 'Draft', style: null, ...geometry },
    ],
    connectors: [{ id: 'link', sourceId: 'order', targetId: 'finance', label: 'Invoice', waypoints: [{ x: 1, y: 2 }] }],
    hiddenRelations: ['message:order-process:billing-process:InvoiceRequested'],
  };
}

const errorsOf = (text: string): string[] => {
  const result = parseLandscapeMap(text);
  return result.ok ? [] : result.errors;
};
const mapText = (overrides: Record<string, unknown>): string =>
  JSON.stringify({ ...JSON.parse(serializeLandscapeMap(fullMap())), ...overrides });

describe('LandscapeMapFile', () => {
  it('round-trips every element type, connectors, layers and hidden relations', () => {
    const text = serializeLandscapeMap(fullMap());
    const result = parseLandscapeMap(text);

    expect(result).toEqual({ ok: true, map: fullMap() });
    expect(result.ok && serializeLandscapeMap(result.map)).toBe(text);
  });

  it('writes keys in a fixed order with two-space indentation and a trailing newline', () => {
    const text = serializeLandscapeMap(fullMap());

    expect(Object.keys(JSON.parse(text))).toEqual([
      'format',
      'version',
      'name',
      'levels',
      'relationLayers',
      'elements',
      'connectors',
      'hiddenRelations',
    ]);
    expect(Object.keys(JSON.parse(text).elements[2])).toEqual([
      'id',
      'type',
      'parentId',
      'processId',
      'fileHint',
      'label',
      'shape',
      'x',
      'y',
      'width',
      'height',
      'style',
    ]);
    expect(text.startsWith('{\n  "format": "bfw-landscape-map",\n  "version": 1,')).toBe(true);
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('keeps unknown top-level keys and writes them back after the known ones', () => {
    const result = parseLandscapeMap(mapText({ owner: { team: 'Sales' } }));

    expect(result.ok && result.map.unknownProperties).toEqual({ owner: { team: 'Sales' } });
    expect(result.ok && Object.keys(JSON.parse(serializeLandscapeMap(result.map))).at(-1)).toBe('owner');
  });

  it('fills defaults for a minimal hand-written map', () => {
    const result = parseLandscapeMap('{"format":"bfw-landscape-map","version":1,"name":"Minimal"}');

    expect(result).toEqual({ ok: true, map: createEmptyLandscapeMap('Minimal') });
  });

  it('rejects text that is not JSON, not an object, another format or a newer version', () => {
    expect(errorsOf('{ not json')[0]).toMatch(/^The file is not valid JSON: /);
    expect(errorsOf('[]')).toEqual(['The file is not a landscape map: the top level must be a JSON object.']);
    expect(errorsOf('{"format":"bpmn"}')).toEqual([
      'The file is not a landscape map: "format" must be "bfw-landscape-map".',
    ]);
    expect(errorsOf(mapText({ version: 2 }))).toEqual([
      'The map has format version 2; this Studio reads version 1. Update the Studio to open it.',
    ]);
    expect(errorsOf(mapText({ version: '1' }))).toEqual(['The map needs "version" 1.']);
  });

  it('reports every element problem in one pass, naming the element', () => {
    const errors = errorsOf(
      mapText({
        elements: [
          { id: 'a', type: 'process', parentId: null, x: 0, y: 0, width: 0, height: 10, shape: 'circle' },
          { id: 'b', type: 'hexagon', x: 0, y: 0, width: 10, height: 10 },
          {
            id: 'c',
            type: 'mapLink',
            parentId: null,
            label: 'Away',
            mapPath: '/etc/away.bfwmap',
            x: 0,
            y: 0,
            width: 10,
            height: 10,
          },
          'not an object',
        ],
        connectors: [],
      }),
    );

    expect(errors).toEqual([
      `Element 'a' needs "width" as a number greater than 0.`,
      `Element 'a' needs "processId" as a non-empty string.`,
      `Element 'a' has shape "circle"; use "box" or "chevron".`,
      `Element 'b' has the unknown type "hexagon".`,
      `Element 'c' has "mapPath" "/etc/away.bfwmap", which is not a path relative to the map file.`,
      'Element 4 is not an object.',
    ]);
  });

  it('rejects duplicate ids, a process shown twice, bad parents, nesting cycles and dangling connectors', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const errors = errorsOf(
      mapText({
        elements: [
          { id: 'one', type: 'process', parentId: null, processId: 'p', ...box },
          { id: 'two', type: 'process', parentId: 'one', processId: 'p', ...box },
          { id: 'one', type: 'note', parentId: null, text: '', ...box },
          { id: 'group-a', type: 'group', parentId: 'group-b', label: '', ...box },
          { id: 'group-b', type: 'group', parentId: 'group-a', label: '', ...box },
          { id: 'band', type: 'band', parentId: 'group-a', label: '', ...box },
        ],
        connectors: [
          { id: 'loop', sourceId: 'two', targetId: 'two' },
          { id: 'away', sourceId: 'two', targetId: 'ghost' },
        ],
      }),
    );

    expect(errors).toEqual([
      `The id 'one' is used more than once.`,
      `The process 'p' appears more than once; a map shows a process once.`,
      `Element 'two' has the parent 'one', which is no band or group.`,
      `Band 'band' is inside 'group-a'; bands stay at the top level.`,
      `Element 'group-a' is nested inside itself through 'group-a'.`,
      `Element 'group-b' is nested inside itself through 'group-b'.`,
      `Element 'band' is nested inside itself through 'group-a'.`,
      `Connector 'loop' starts and ends at 'two'.`,
      `Connector 'away' points to 'ghost', which is not on the map.`,
    ]);
  });

  it('rejects malformed levels, layers, hidden relations, styles and waypoints', () => {
    const errors = errorsOf(
      mapText({
        levels: [{ id: '', name: 'Domain' }, 'flat'],
        relationLayers: { message: 'yes' },
        hiddenRelations: [42],
        elements: [{ id: 'n', type: 'note', parentId: null, text: 'x', x: 0, y: 0, width: 1, height: 1, style: 'red' }],
        connectors: [{ id: 'c', sourceId: 'n', targetId: 'n', waypoints: [{ x: 'left' }] }],
      }),
    );

    expect(errors).toEqual([
      'The hidden relation 42 is not a string.',
      'Level 1 needs "id" as a non-empty string.',
      'Level 2 is not an object.',
      'The relation layer "message" must be true or false.',
      `Element 'n' needs "style" as an object.`,
      `Connector 'c' has waypoint 1 without numeric "x" and "y".`,
      `Connector 'c' starts and ends at 'n'.`,
    ]);
  });
});
