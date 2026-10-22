import type { LandscapeElement, LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import { createEmptyLandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import type { CanvasShapeLike } from '#modules/bpmn-landscape/modeler/landscapeCanvasMapping';
import { canvasToMap, mapToCanvasDescriptors } from '#modules/bpmn-landscape/modeler/landscapeCanvasMapping';
import { describe, expect, it } from 'vitest';

const geometry = { x: 10, y: 20, width: 160, height: 60 };

function fullMap(): LandscapeMap {
  return {
    ...createEmptyLandscapeMap('Order to Cash'),
    levels: [{ id: 'level-domain', name: 'Domain' }],
    relationLayers: { callActivity: true, message: false, signal: true },
    elements: [
      { id: 'band', type: 'band', parentId: null, label: 'Core', style: null, ...geometry, width: 1200 },
      { id: 'sales', type: 'group', parentId: 'band', label: 'Sales', collapsed: false, style: null, ...geometry },
      { id: 'inner', type: 'group', parentId: 'sales', label: 'Inner', collapsed: true, style: null, ...geometry },
      {
        id: 'order',
        type: 'process',
        parentId: 'inner',
        processId: 'order-process',
        fileHint: 'processes/order.bpmn',
        label: null,
        shape: 'chevron',
        style: { fill: '#ffeecc', stroke: null },
        ...geometry,
      },
      { id: 'note', type: 'note', parentId: 'band', text: 'Draft', style: null, ...geometry },
      { id: 'returns', type: 'placeholder', parentId: null, label: 'Returns', shape: 'box', style: null, ...geometry },
      {
        id: 'finance',
        type: 'mapLink',
        parentId: null,
        label: 'Finance',
        mapPath: '../f.bfwmap',
        style: null,
        ...geometry,
      },
    ],
    connectors: [{ id: 'link', sourceId: 'order', targetId: 'finance', label: 'Invoice', waypoints: [{ x: 1, y: 2 }] }],
    hiddenRelations: ['message:a:b:Invoice'],
    extensions: { attributes: { 'xmlns:team': 'http://team', 'team:owner': 'Sales' }, elements: [] },
  };
}

/** Builds the shape tree diagram-js would hold after importing `shapes` in the given order. */
function buildCanvas(map: LandscapeMap): { children: any[] } {
  const { shapes, connections } = mapToCanvasDescriptors(map);
  const root = { children: [] as any[] };
  const shapesById = new Map<string, CanvasShapeLike & { children: any[] }>();
  for (const element of shapes) {
    const parent = element.parentId == null ? root : shapesById.get(element.parentId);
    if (parent == null) {
      throw new Error(`parent of ${element.id} was not created first`);
    }
    const shape = { ...pickGeometry(element), businessObject: element, children: [] };
    shapesById.set(element.id, shape);
    parent.children.push(shape);
  }
  for (const connector of connections) {
    root.children.push({
      waypoints: connector.waypoints,
      businessObject: connector,
      source: shapesById.get(connector.sourceId),
      target: shapesById.get(connector.targetId),
    });
  }
  return root;
}

const pickGeometry = (element: LandscapeElement) => ({
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
});

describe('landscapeCanvasMapping', () => {
  it('round-trips every element type, nesting, styles, connectors and extensions', () => {
    const map = fullMap();

    expect(canvasToMap(buildCanvas(map), map)).toEqual(map);
  });

  it('creates parents before children when the file lists a child first', () => {
    const map = fullMap();
    const reversed = { ...map, elements: [...map.elements].reverse() };

    const order = mapToCanvasDescriptors(reversed).shapes.map((element) => element.id);

    expect(order.indexOf('band')).toBeLessThan(order.indexOf('sales'));
    expect(order.indexOf('sales')).toBeLessThan(order.indexOf('inner'));
    expect(order.indexOf('inner')).toBeLessThan(order.indexOf('order'));
    expect(order.indexOf('band')).toBeLessThan(order.indexOf('note'));
    expect(order).toHaveLength(map.elements.length);
  });

  it('puts bands and groups before their other siblings and keeps the file order otherwise', () => {
    const element = (id: string, type: 'group' | 'note', parentId: string | null): LandscapeElement =>
      type === 'group'
        ? { id, type, parentId, label: id, collapsed: false, style: null, ...geometry }
        : { id, type, parentId, text: id, style: null, ...geometry };
    const map = {
      ...createEmptyLandscapeMap('Order'),
      elements: [
        element('first-note', 'note', null),
        element('outer', 'group', null),
        element('second-note', 'note', null),
        element('inner-note', 'note', 'outer'),
        element('inner', 'group', 'outer'),
        element('second-group', 'group', null),
      ],
    };

    expect(mapToCanvasDescriptors(map).shapes.map((shape) => shape.id)).toEqual([
      'outer',
      'inner',
      'inner-note',
      'second-group',
      'first-note',
      'second-note',
    ]);
  });

  it('takes geometry and parent from the canvas and rounds it', () => {
    const map = fullMap();
    const canvas = buildCanvas(map);
    const returns = canvas.children.find((node) => node.businessObject.id === 'returns');
    Object.assign(returns, { x: 40.4, y: 80.6, width: 150.5, height: 70 });
    const band = canvas.children.find((node) => node.businessObject.id === 'band');
    canvas.children.splice(canvas.children.indexOf(returns), 1);
    band.children.push(returns);
    const link = canvas.children.find((node) => node.businessObject.id === 'link');
    link.waypoints = [
      { x: 1.2, y: 2.7, original: { x: 0, y: 0 } },
      { x: 9, y: 9 },
    ];

    const exported = canvasToMap(canvas, map);

    expect(exported.elements.find((element) => element.id === 'returns')).toMatchObject({
      parentId: 'band',
      x: 40,
      y: 81,
      width: 151,
      height: 70,
    });
    expect(exported.connectors[0].waypoints).toEqual([
      { x: 1, y: 3 },
      { x: 9, y: 9 },
    ]);
  });

  it('does not save the derived relation lines', () => {
    const map = fullMap();
    const canvas = buildCanvas(map);
    const link = canvas.children.find((node) => node.businessObject.id === 'link');
    canvas.children.push({
      type: 'relation',
      waypoints: [{ x: 0, y: 0 }],
      businessObject: { id: 'relation:message:order:finance', kind: 'message', relations: [], hiddenKeys: [] },
      source: link.source,
      target: link.target,
    });

    expect(canvasToMap(canvas, map).connectors.map((connector) => connector.id)).toEqual(['link']);
  });
});
