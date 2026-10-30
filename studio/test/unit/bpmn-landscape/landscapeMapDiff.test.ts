import type { LandscapeConnector, LandscapeElement, LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import { createEmptyLandscapeMap, serializeLandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import {
  diffLandscapeMaps,
  diffLandscapeMapTexts,
  formatLandscapeDiffAsMarkdown,
} from '#modules/bpmn-landscape/diff/landscapeMapDiff';
import { describe, expect, it } from 'vitest';

const geometry = { x: 10, y: 20, width: 160, height: 60 };

function baseMap(): LandscapeMap {
  return {
    ...createEmptyLandscapeMap('Order to Cash'),
    levels: [
      { id: 'level-domain', name: 'Domain' },
      { id: 'level-group', name: 'Process group' },
    ],
    elements: [
      { id: 'band', type: 'band', parentId: null, label: 'Core', style: null, ...geometry, width: 1200 },
      { id: 'sales', type: 'group', parentId: 'band', label: 'Sales', collapsed: false, style: null, ...geometry },
      {
        id: 'order',
        type: 'process',
        parentId: 'sales',
        processId: 'order-process',
        fileHint: 'processes/order.bpmn',
        label: null,
        shape: 'box',
        style: null,
        ...geometry,
      },
      { id: 'returns', type: 'placeholder', parentId: null, label: 'Returns', shape: 'box', style: null, ...geometry },
      {
        id: 'finance',
        type: 'mapLink',
        parentId: null,
        label: 'Finance',
        mapPath: 'finance.bfwmap',
        style: null,
        ...geometry,
      },
      { id: 'note', type: 'note', parentId: null, text: 'Draft', style: null, ...geometry },
    ],
    connectors: [
      {
        id: 'link',
        sourceId: 'order',
        targetId: 'finance',
        label: '',
        waypoints: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
      },
    ],
    hiddenRelations: ['message:a:b:Invoice'],
  };
}

function withElement(id: string, patch: Partial<LandscapeElement>): LandscapeMap {
  const map = baseMap();
  map.elements = map.elements.map((element) =>
    element.id === id ? ({ ...element, ...patch } as LandscapeElement) : element,
  );
  return map;
}

function withConnector(patch: Partial<LandscapeConnector>): LandscapeMap {
  const map = baseMap();
  map.connectors = map.connectors.map((connector) => ({ ...connector, ...patch }));
  return map;
}

const propertyChangesOf = (before: LandscapeMap, after: LandscapeMap) =>
  diffLandscapeMaps(before, after).modified.map((item) => ({
    id: item.id,
    changes: item.propertyChanges.map(({ property, before: from, after: to }) => ({ property, from, to })),
  }));

describe('diffLandscapeMaps', () => {
  it('finds nothing between equal maps', () => {
    expect(diffLandscapeMaps(baseMap(), baseMap())).toEqual({
      added: [],
      removed: [],
      modified: [],
      layoutChanged: [],
      mapProperties: [],
    });
  });

  it.each([
    ['band', { label: 'Support' }, 'label', 'Core', 'Support'],
    ['sales', { label: 'Selling' }, 'label', 'Sales', 'Selling'],
    ['sales', { collapsed: true }, 'collapsed', 'false', 'true'],
    ['order', { processId: 'order-v2' }, 'processId', 'order-process', 'order-v2'],
    ['order', { fileHint: null }, 'fileHint', 'processes/order.bpmn', null],
    ['order', { label: 'Take order' }, 'label', null, 'Take order'],
    ['order', { shape: 'chevron' }, 'shape', 'box', 'chevron'],
    ['returns', { label: 'Refunds' }, 'label', 'Returns', 'Refunds'],
    ['returns', { shape: 'chevron' }, 'shape', 'box', 'chevron'],
    ['finance', { label: 'Accounting' }, 'label', 'Finance', 'Accounting'],
    ['finance', { mapPath: '../accounting.bfwmap' }, 'mapPath', 'finance.bfwmap', '../accounting.bfwmap'],
    ['note', { text: 'Final' }, 'text', 'Draft', 'Final'],
  ] as const)('reports %s %o as a change of %s', (id, patch, property, from, to) => {
    expect(propertyChangesOf(baseMap(), withElement(id, patch as Partial<LandscapeElement>))).toEqual([
      { id, changes: [{ property, from, to }] },
    ]);
  });

  it.each(['band', 'sales', 'order', 'returns', 'finance', 'note'])(
    'reports the parent, colours and extension attributes of %s',
    (id) => {
      const after = withElement(id, {
        parentId: 'elsewhere',
        style: { fill: '#ffeecc', stroke: '#333333' },
        extensionAttributes: { 'team:owner': 'Sales', 'team:area': 'North' },
      });
      const before = baseMap().elements.find((element) => element.id === id)!;

      expect(propertyChangesOf(baseMap(), after)).toEqual([
        {
          id,
          changes: [
            { property: 'parentId', from: before.parentId, to: 'elsewhere' },
            { property: 'style.fill', from: null, to: '#ffeecc' },
            { property: 'style.stroke', from: null, to: '#333333' },
            { property: 'extensionAttributes', from: null, to: 'team:area="North" team:owner="Sales"' },
          ],
        },
      ]);
    },
  );

  it.each([
    [{ label: 'Invoice' }, 'label', '', 'Invoice'],
    [{ sourceId: 'returns' }, 'sourceId', 'order', 'returns'],
    [{ targetId: 'note' }, 'targetId', 'finance', 'note'],
    [{ extensionAttributes: { 'team:kind': 'billing' } }, 'extensionAttributes', null, 'team:kind="billing"'],
  ] as const)('reports connector %o as a change of %s', (patch, property, from, to) => {
    expect(propertyChangesOf(baseMap(), withConnector(patch))).toEqual([
      { id: 'link', changes: [{ property, from, to }] },
    ]);
  });

  it('reports a renamed level', () => {
    const after = baseMap();
    after.levels[1] = { id: 'level-group', name: 'Capability' };

    expect(diffLandscapeMaps(baseMap(), after).modified).toEqual([
      {
        id: 'level-group',
        itemType: 'level',
        displayName: 'Capability',
        propertyChanges: [{ property: 'name', label: 'Name', before: 'Process group', after: 'Capability' }],
        layoutChanged: false,
      },
    ]);
  });

  it('lists moved, resized and rerouted items as layout-only changes', () => {
    const after = withElement('order', { x: 400, height: 80 });
    after.connectors[0] = {
      ...after.connectors[0],
      waypoints: [
        { x: 1, y: 2 },
        { x: 3, y: 9 },
      ],
    };
    const diff = diffLandscapeMaps(baseMap(), after);

    expect(diff.modified).toEqual([]);
    expect(diff.layoutChanged).toEqual([
      { id: 'order', itemType: 'process', displayName: 'order-process', propertyChanges: [], layoutChanged: true },
      {
        id: 'link',
        itemType: 'connector',
        displayName: 'order-process → Finance',
        propertyChanges: [],
        layoutChanged: true,
      },
    ]);
  });

  it('lists an item whose content and layout changed once, as modified with a layout change', () => {
    const diff = diffLandscapeMaps(baseMap(), withElement('returns', { label: 'Refunds', y: 300 }));

    expect(diff.layoutChanged).toEqual([]);
    expect(diff.modified).toEqual([
      {
        id: 'returns',
        itemType: 'placeholder',
        displayName: 'Refunds',
        propertyChanges: [{ property: 'label', label: 'Label', before: 'Returns', after: 'Refunds' }],
        layoutChanged: true,
      },
    ]);
  });

  it('lists added and removed elements, connectors and levels with their display names', () => {
    const after = baseMap();
    after.elements = after.elements.filter((element) => element.id !== 'note');
    after.elements.push(
      { id: 'memo', type: 'note', parentId: null, text: 'x'.repeat(50), style: null, ...geometry },
      { id: 'Group_1', type: 'group', parentId: null, label: '', collapsed: false, style: null, ...geometry },
    );
    after.connectors = [{ id: 'invoice', sourceId: 'returns', targetId: 'finance', label: 'Invoice', waypoints: [] }];
    after.levels = [{ id: 'level-area', name: 'Area' }];
    const diff = diffLandscapeMaps(baseMap(), after);

    expect(diff.added.map(({ id, itemType, displayName }) => ({ id, itemType, displayName }))).toEqual([
      { id: 'memo', itemType: 'note', displayName: 'x'.repeat(40) },
      { id: 'Group_1', itemType: 'group', displayName: 'group Group_1' },
      { id: 'invoice', itemType: 'connector', displayName: 'Invoice' },
      { id: 'level-area', itemType: 'level', displayName: 'Area' },
    ]);
    expect(diff.removed.map(({ id, itemType, displayName }) => ({ id, itemType, displayName }))).toEqual([
      { id: 'note', itemType: 'note', displayName: 'Draft' },
      { id: 'link', itemType: 'connector', displayName: 'order-process → Finance' },
      { id: 'level-domain', itemType: 'level', displayName: 'Domain' },
      { id: 'level-group', itemType: 'level', displayName: 'Process group' },
    ]);
    expect([...diff.added, ...diff.removed].every((item) => item.propertyChanges.length === 0)).toBe(true);
  });

  it('reports the map name, relation layers, hidden relations added and removed, and changed extensions', () => {
    const after: LandscapeMap = {
      ...baseMap(),
      name: 'Order to Cash v2',
      relationLayers: { callActivity: true, message: false, signal: true },
      hiddenRelations: ['signal:a:c:Closed'],
      extensions: { attributes: { 'xmlns:team': 'http://team', 'team:owner': 'Sales' }, elements: [] },
    };
    const changes = diffLandscapeMaps(baseMap(), after).mapProperties;

    expect(changes.map(({ property, before, after: to }) => ({ property, before, after: to }))).toEqual([
      { property: 'name', before: 'Order to Cash', after: 'Order to Cash v2' },
      { property: 'relationLayers.message', before: 'true', after: 'false' },
      { property: 'hiddenRelations', before: null, after: 'signal:a:c:Closed' },
      { property: 'hiddenRelations', before: 'message:a:b:Invoice', after: null },
      { property: 'extensions', before: null, after: expect.stringContaining('team:owner="Sales"') },
    ]);
  });

  it('ignores a reordering of elements, connectors, levels, hidden relations and extension attributes', () => {
    const before: LandscapeMap = {
      ...baseMap(),
      connectors: [
        ...baseMap().connectors,
        { id: 'second', sourceId: 'returns', targetId: 'note', label: '', waypoints: [] },
      ],
      hiddenRelations: ['message:a:b:Invoice', 'signal:a:c:Closed'],
      extensions: { attributes: { 'xmlns:team': 'http://team', 'team:owner': 'Sales' }, elements: [] },
    };
    const after: LandscapeMap = {
      ...before,
      levels: [...before.levels].reverse(),
      elements: [...before.elements].reverse(),
      connectors: [...before.connectors].reverse(),
      hiddenRelations: [...before.hiddenRelations].reverse(),
      extensions: { attributes: { 'team:owner': 'Sales', 'xmlns:team': 'http://team' }, elements: [] },
    };

    expect(diffLandscapeMaps(before, after)).toEqual(diffLandscapeMaps(baseMap(), baseMap()));
  });
});

describe('diffLandscapeMapTexts', () => {
  it('diffs two map files', async () => {
    const diff = await diffLandscapeMapTexts(
      serializeLandscapeMap(baseMap()),
      serializeLandscapeMap(withElement('note', { text: 'Final' })),
    );

    expect(diff.modified.map((item) => item.id)).toEqual(['note']);
  });

  it('rejects an unreadable side with the reader diagnostics', async () => {
    const duplicate = baseMap();
    duplicate.elements.push({ ...duplicate.elements[5] });
    duplicate.connectors[0] = { ...duplicate.connectors[0], targetId: 'gone' };

    await expect(
      diffLandscapeMapTexts(serializeLandscapeMap(baseMap()), serializeLandscapeMap(duplicate)),
    ).rejects.toThrow(
      "The id 'note' is used more than once.\nConnector 'link' points to 'gone', which is not on the map.",
    );
    await expect(diffLandscapeMapTexts('<not-a-map />', serializeLandscapeMap(baseMap()))).rejects.toThrow(
      'The file is not a landscape map',
    );
  });
});

describe('formatLandscapeDiffAsMarkdown', () => {
  it('writes the sections in the change summary style', () => {
    const after = withElement('returns', { label: 'Refunds' });
    after.name = 'Order to Cash v2';
    after.elements = after.elements.filter((element) => element.id !== 'note');
    after.elements.push({ id: 'memo', type: 'note', parentId: null, text: 'New', style: null, ...geometry });
    after.elements[0] = { ...after.elements[0], x: 0 };

    expect(formatLandscapeDiffAsMarkdown(diffLandscapeMaps(baseMap(), after), 'order.bfwmap')).toBe(
      [
        '### Changes in order.bfwmap\n',
        '#### Map properties (1)',
        "  - Name: 'Order to Cash' → 'Order to Cash v2'",
        '',
        '#### Added (1)',
        '- New',
        '',
        '#### Removed (1)',
        '- Draft',
        '',
        '#### Modified (1)',
        '- Refunds',
        "  - Label: 'Returns' → 'Refunds'",
        '',
        '#### Layout changed (1)',
        '- Core',
        '',
      ].join('\n'),
    );
  });

  it('leaves out the heading on request and says when nothing changed', () => {
    expect(
      formatLandscapeDiffAsMarkdown(diffLandscapeMaps(baseMap(), baseMap()), 'order.bfwmap', { includeHeading: false }),
    ).toBe('No semantic changes detected.');
  });
});
