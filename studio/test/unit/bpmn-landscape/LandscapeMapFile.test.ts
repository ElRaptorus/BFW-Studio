import type { LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import {
  createElementId,
  createEmptyLandscapeMap,
  parseLandscapeMap,
  relativeFileHint,
  resolveRelativeUri,
  serializeLandscapeMap,
} from '#modules/bpmn-landscape/LandscapeMapFile';
import { describe, expect, it } from 'vitest';

describe('createElementId', () => {
  it('names the type and adds seven random base-36 characters', () => {
    expect(createElementId('mapLink', () => false)).toMatch(/^MapLink_[0-9a-z]{7}$/);
    expect(createElementId('connector', () => false)).toMatch(/^Connector_[0-9a-z]{7}$/);
    expect(createElementId('level', () => false)).toMatch(/^Level_[0-9a-z]{7}$/);
  });

  it('draws again while the id is taken', () => {
    const offered: string[] = [];
    const id = createElementId('group', (candidate) => {
      offered.push(candidate);
      return offered.length < 3;
    });

    expect(offered).toHaveLength(3);
    expect(id).toBe(offered[2]);
  });
});

const NAMESPACE = 'https://bifrostforge.world/schema/landscape';
const geometry = { x: 10, y: 20.5, width: 160, height: 60 };

function fullMap(): LandscapeMap {
  return {
    ...createEmptyLandscapeMap('Order & "Cash"'),
    levels: [
      { id: 'level-domain', name: 'Domain' },
      { id: 'level-group', name: 'Process group' },
    ],
    relationLayers: { callActivity: true, message: false, signal: true },
    elements: [
      { id: 'band', type: 'band', parentId: null, label: 'Core\nDomain', style: null, ...geometry, width: 1200 },
      { id: 'sales', type: 'group', parentId: 'band', label: 'Sales', collapsed: true, style: null, ...geometry },
      {
        id: 'order',
        type: 'process',
        parentId: 'sales',
        processId: 'order-process',
        fileHint: 'processes/order.bpmn',
        label: 'Take <order>',
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
        style: { fill: null, stroke: '#333333' },
        ...geometry,
      },
      { id: 'note', type: 'note', parentId: null, text: 'Draft\n  indented & <kept>', style: null, ...geometry },
    ],
    connectors: [
      {
        id: 'link',
        sourceId: 'order',
        targetId: 'finance',
        label: 'Invoice',
        waypoints: [
          { x: 1, y: 2 },
          { x: 3.5, y: 4 },
        ],
      },
    ],
    hiddenRelations: ['message:order-process:billing-process:InvoiceRequested'],
  };
}

const errorsOf = async (text: string): Promise<string[]> => {
  const result = await parseLandscapeMap(text);
  return result.ok ? [] : result.errors;
};
/** A version 1 map in the landscape namespace with `content` as its children. */
const mapText = (content: string, rootAttributes = ''): string =>
  `<landscape:map xmlns:landscape="${NAMESPACE}" version="1" name="Test"${rootAttributes}>${content}</landscape:map>`;

describe('LandscapeMapFile', () => {
  it('round-trips every element type, nesting, connectors, layers, hidden relations and escaped text', async () => {
    const text = serializeLandscapeMap(fullMap());
    const result = await parseLandscapeMap(text);

    expect(result).toEqual({ ok: true, map: fullMap() });
    expect(result.ok && serializeLandscapeMap(result.map)).toBe(text);
  });

  it('writes nested, indented XML with a fixed attribute order and only non-default values', () => {
    const map: LandscapeMap = {
      ...createEmptyLandscapeMap('Order to Cash'),
      relationLayers: { callActivity: true, message: true, signal: false },
      elements: [
        { id: 'sales', type: 'group', parentId: null, label: 'Sales', collapsed: false, style: null, ...geometry },
        {
          id: 'order',
          type: 'process',
          parentId: 'sales',
          processId: 'order-process',
          fileHint: null,
          label: null,
          shape: 'box',
          style: null,
          ...geometry,
        },
        { id: 'empty', type: 'note', parentId: null, text: '', style: null, ...geometry },
      ],
    };

    expect(serializeLandscapeMap(map)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<landscape:map xmlns:landscape="${NAMESPACE}" version="1" name="Order to Cash">`,
        '  <landscape:relationLayers signal="false" />',
        '  <landscape:group id="sales" x="10" y="20.5" width="160" height="60" label="Sales">',
        '    <landscape:process id="order" x="10" y="20.5" width="160" height="60" processId="order-process" />',
        '  </landscape:group>',
        '  <landscape:note id="empty" x="10" y="20.5" width="160" height="60" />',
        '</landscape:map>',
        '',
      ].join('\n'),
    );
  });

  it('writes an element whose parent is not on the map at the top level', async () => {
    const map: LandscapeMap = {
      ...createEmptyLandscapeMap('Orphan'),
      elements: [{ id: 'lost', type: 'note', parentId: 'gone', text: 'x', style: null, ...geometry }],
    };
    const result = await parseLandscapeMap(serializeLandscapeMap(map));

    expect(result.ok && result.map.elements[0]?.parentId).toBeNull();
  });

  it('keeps foreign attributes and elements on the root and writes them back', async () => {
    const text = mapText('<foo:meta a="1"><foo:detail /></foo:meta>', ' xmlns:foo="http://foo" foo:owner="Sales"');
    const result = await parseLandscapeMap(text);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.map.extensions.attributes).toEqual({ 'xmlns:foo': 'http://foo', 'foo:owner': 'Sales' });
    const written = serializeLandscapeMap(result.map);
    expect(written).toContain('foo:owner="Sales"');
    expect(written).toContain('<foo:meta a="1">\n    <foo:detail />\n  </foo:meta>');
    expect(await parseLandscapeMap(written)).toEqual(result);
  });

  it('reads a minimal map, also with a default namespace, and fills the defaults', async () => {
    expect(await parseLandscapeMap(mapText('').replace('name="Test"', 'name="Minimal"'))).toEqual({
      ok: true,
      map: createEmptyLandscapeMap('Minimal'),
    });
    expect(await parseLandscapeMap(`<map xmlns="${NAMESPACE}" version="1" name="Minimal" />`)).toEqual({
      ok: true,
      map: createEmptyLandscapeMap('Minimal'),
    });
  });

  it('rejects malformed XML with a 1-based line and column', async () => {
    expect(await errorsOf(mapText('\n  <landscape:group id="a">\n'))).toEqual([
      'The file is not well-formed XML. Line 3, column 1: closing tag mismatch.',
    ]);
    expect(await errorsOf('{ "format": "bfw-landscape-map" }')).toEqual([
      'The file is not well-formed XML. Line 1, column 1: missing start tag.',
    ]);
  });

  it('rejects another root element, another namespace, a newer and a missing version', async () => {
    const notAMap = `The file is not a landscape map: the root element must be <landscape:map> in the namespace ${NAMESPACE}.`;

    expect(await errorsOf('<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" />')).toEqual([
      notAMap,
    ]);
    expect(await errorsOf('<landscape:map xmlns:landscape="http://other" version="1" />')).toEqual([notAMap]);
    expect(await errorsOf(mapText('<landscape:unknown />').replace('version="1"', 'version="2"'))).toEqual([
      'The map has format version 2; this Studio reads version 1. Update the Studio to open it.',
    ]);
    expect(await errorsOf(mapText('').replace(' version="1"', ''))).toEqual(['The map needs version 1.']);
  });

  it('rejects unknown elements and attributes of the landscape namespace and foreign elements below the root', async () => {
    const errors = await errorsOf(
      mapText(
        '<landscape:grop id="a" /><landscape:group id="b" x="0" y="0" width="1" height="1" widht="3">' +
          '<foo:bar xmlns:foo="http://foo" /></landscape:group>',
        ' owner="x"',
      ),
    );

    expect(errors).toHaveLength(4);
    expect(errors[0]).toBe('Unknown attribute <owner> on <landscape:map>.');
    expect(errors[1]).toMatch(/^Line 1, column \d+: unknown type <landscape:Grop>\.$/);
    expect(errors[2]).toBe(`Unknown attribute <widht> on <landscape:group> 'b'.`);
    expect(errors[3]).toMatch(/^Line 1, column \d+: unrecognized element <foo:bar>\.$/);
  });

  it('reports every element problem in one pass, naming the element', async () => {
    const errors = await errorsOf(
      mapText(
        '<landscape:process id="a" x="0" y="0" width="0" height="10" shape="circle" />' +
          '<landscape:placeholder x="left" y="0" width="1" height="1" />' +
          '<landscape:mapLink id="c" x="0" y="0" width="10" height="10" mapPath="/etc/away.bfwmap" />' +
          '<landscape:process id="d" x="0" y="0" width="1" height="1" processId="q" fileHint="C:\\order.bpmn" />',
      ),
    );

    expect(errors).toEqual([
      `Element 'a' needs "width" as a number greater than 0.`,
      `Element 'a' needs a non-empty "processId".`,
      `Element 'a' has shape "circle"; use "box" or "chevron".`,
      'An element <landscape:placeholder> needs a non-empty "id".',
      `Element '' needs "x" as a number.`,
      `Element 'c' has "mapPath" "/etc/away.bfwmap", which is not a path relative to the map file.`,
      `Element 'd' has "fileHint" "C:\\order.bpmn", which is not a path relative to the map file.`,
    ]);
  });

  it('rejects a connector that ends at a band', async () => {
    const box = 'x="0" y="0" width="10" height="10"';
    const errors = await errorsOf(
      mapText(
        `<landscape:band id="band" ${box} />` +
          `<landscape:note id="note" ${box} />` +
          '<landscape:connector id="link" sourceId="note" targetId="band" />',
      ),
    );

    expect(errors).toEqual([`Connector 'link' ends at the band 'band'; bands cannot be connected.`]);
  });

  it('rejects duplicate ids, a process shown twice, a nested band and dangling connectors', async () => {
    const box = 'x="0" y="0" width="10" height="10"';
    const errors = await errorsOf(
      mapText(
        `<landscape:process id="one" ${box} processId="p" />` +
          `<landscape:group id="group" ${box}>` +
          `<landscape:process id="two" ${box} processId="p" />` +
          `<landscape:band id="band" ${box} />` +
          '</landscape:group>' +
          `<landscape:note id="one" ${box} />` +
          '<landscape:connector id="loop" sourceId="two" targetId="two" />' +
          '<landscape:connector id="away" sourceId="two" targetId="ghost" />',
      ),
    );

    expect(errors).toEqual([
      `Band 'band' is inside 'group'; bands stay at the top level.`,
      `The id 'one' is used more than once.`,
      `The process 'p' appears more than once; a map shows a process once.`,
      `Connector 'loop' starts and ends at 'two'.`,
      `Connector 'away' points to 'ghost', which is not on the map.`,
    ]);
  });

  it('rejects ids that the canvas reserves for the planes of groups and for relation lines', async () => {
    const box = 'x="0" y="0" width="10" height="10"';
    const errors = await errorsOf(
      mapText(
        `<landscape:group id="plane:team" ${box} />` +
          `<landscape:note id="relation:call:a:b" ${box} />` +
          `<landscape:note id="plane" ${box} />`,
      ),
    );

    expect(errors).toEqual([
      `The id 'plane:team' is reserved for elements the canvas derives.`,
      `The id 'relation:call:a:b' is reserved for elements the canvas derives.`,
    ]);
  });

  it('rejects levels, hidden relations, connectors and waypoints without their required values', async () => {
    const errors = await errorsOf(
      mapText(
        '<landscape:level name="Domain" />' +
          '<landscape:note id="n" x="0" y="0" width="1" height="1" />' +
          '<landscape:connector id="c" targetId="n"><landscape:waypoint x="left" y="1" /></landscape:connector>' +
          '<landscape:hiddenRelation />',
      ),
    );

    expect(errors).toEqual([
      'A level needs a non-empty "id".',
      `Connector 'c' has waypoint 1 without numeric "x" and "y".`,
      `Connector 'c' needs a non-empty "sourceId".`,
      'A hidden relation needs a non-empty "key".',
    ]);
  });

  it('writes the file hint relative to the folder of the map', () => {
    const map = 'file:///work/solution/sales/landscapes/overview.bfwmap';

    expect(relativeFileHint(map, 'file:///work/solution/sales/landscapes/order.bpmn')).toBe('order.bpmn');
    expect(relativeFileHint(map, 'file:///work/solution/sales/processes/order.bpmn')).toBe('../processes/order.bpmn');
    expect(relativeFileHint(map, 'file:///work/solution/sales/order.bpmn')).toBe('../order.bpmn');
    expect(relativeFileHint(map, 'file:///work/solution/finance/billing.bpmn')).toBe('../../finance/billing.bpmn');
    expect(relativeFileHint(map, 'file:///work/solution/sales/landscapes/sub/order.bpmn')).toBe('sub/order.bpmn');
  });

  it('resolves a relative path back to the URI it was written from', () => {
    const map = 'file:///work/solution/sales/landscapes/overview.bfwmap';
    const targets = [
      'file:///work/solution/sales/landscapes/other.bfwmap',
      'file:///work/solution/sales/landscapes/sub/other.bfwmap',
      'file:///work/solution/sales/other.bfwmap',
      'file:///work/solution/finance/other.bfwmap',
    ];

    for (const target of targets) {
      expect(resolveRelativeUri(map, relativeFileHint(map, target))).toBe(target);
    }
  });
});
