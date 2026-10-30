import type { ElementResolutionStatus } from '#bifrost/contracts/MergeTypes';
import type { LandscapeElement, LandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import { createEmptyLandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import { mergeLandscapeMaps } from '#modules/bpmn-landscape/merge/landscapeMergeEngine';
import { describe, expect, it } from 'vitest';

const bounds = { x: 0, y: 0, width: 140, height: 60, style: null };

function baseMap(): LandscapeMap {
  return {
    ...createEmptyLandscapeMap('Order to Cash'),
    levels: [{ id: 'level-domain', name: 'Domain' }],
    elements: [
      { ...bounds, id: 'band', type: 'band', parentId: null, label: 'Core', width: 1200, height: 400 },
      { ...bounds, id: 'sales', type: 'group', parentId: 'band', label: 'Sales', collapsed: false, width: 600 },
      {
        ...bounds,
        id: 'order',
        type: 'process',
        parentId: 'sales',
        processId: 'order-process',
        fileHint: 'order.bpmn',
        label: null,
        shape: 'box',
      },
      {
        ...bounds,
        id: 'payment',
        type: 'process',
        parentId: null,
        processId: 'payment-process',
        fileHint: null,
        label: null,
        shape: 'box',
      },
      { ...bounds, id: 'returns', type: 'placeholder', parentId: null, label: 'Returns', shape: 'box' },
      { ...bounds, id: 'note', type: 'note', parentId: null, text: 'Draft' },
      { ...bounds, id: 'archive', type: 'group', parentId: null, label: 'Archive', collapsed: false },
    ],
    connectors: [{ id: 'pays', sourceId: 'order', targetId: 'payment', label: '', waypoints: [] }],
    hiddenRelations: ['message:a:b:Invoice'],
  };
}

type Edit = (map: LandscapeMap) => void;

function edited(...edits: Edit[]): LandscapeMap {
  const map = structuredClone(baseMap());
  edits.forEach((edit) => edit(map));
  return map;
}

const element = (map: LandscapeMap, id: string): any => map.elements.find((candidate) => candidate.id === id);
const setProperty =
  (id: string, properties: Record<string, unknown>): Edit =>
  (map) =>
    Object.assign(element(map, id), properties);
const removeElement =
  (...ids: string[]): Edit =>
  (map) => {
    map.elements = map.elements.filter((candidate) => !ids.includes(candidate.id));
    map.connectors = map.connectors.filter(
      (connector) => !ids.includes(connector.sourceId) && !ids.includes(connector.targetId),
    );
  };
const addElement =
  (added: LandscapeElement): Edit =>
  (map) =>
    map.elements.push(added);
const placeholder = (id: string, parentId: string | null = null): LandscapeElement => ({
  ...bounds,
  id,
  type: 'placeholder',
  parentId,
  label: id,
  shape: 'box',
});
const processShape = (id: string, processId: string): LandscapeElement => ({
  ...bounds,
  id,
  type: 'process',
  parentId: null,
  processId,
  fileHint: null,
  label: null,
  shape: 'box',
});

const merge = (
  starting: LandscapeMap,
  apply: LandscapeMap,
  resolutions: Record<string, ElementResolutionStatus> = {},
  operationKind: 'merge' | 'rebase' = 'merge',
) => mergeLandscapeMaps(baseMap(), starting, apply, new Map(Object.entries(resolutions)), operationKind);

describe('mergeLandscapeMaps', () => {
  describe('(a) items are elements, connectors and levels by id, plus the map properties as $map', () => {
    it('matches items by id, whatever their order', async () => {
      const apply = edited(setProperty('payment', { label: 'Pay' }), (map) => map.elements.reverse());

      const result = await merge(baseMap(), apply);

      expect(result.conflicts).toEqual([]);
      expect(element(result.map, 'payment').label).toBe('Pay');
    });

    it('reports a conflict of the map properties under $map', async () => {
      const result = await merge(
        edited((map) => (map.name = 'Ours')),
        edited((map) => (map.name = 'Theirs')),
      );

      expect(result.conflicts).toEqual(['$map']);
      expect(result.map.name).toBe('Ours');
    });

    it('treats connectors and levels as items', async () => {
      const result = await merge(
        edited((map) => (map.connectors[0].label = 'pays for')),
        edited((map) => (map.levels[0].name = 'Area')),
      );

      expect(result.conflicts).toEqual([]);
      expect(result.autoApplied).toEqual(['level-domain']);
      expect(result.map.connectors[0].label).toBe('pays for');
      expect(result.map.levels[0].name).toBe('Area');
    });
  });

  describe('(b) an item changed on one side only takes that side', () => {
    it('applies additions, removals and property changes of the apply side', async () => {
      const apply = edited(
        addElement(placeholder('billing')),
        removeElement('note'),
        setProperty('returns', { label: 'Refunds' }),
      );

      const result = await merge(baseMap(), apply);

      expect(result.conflicts).toEqual([]);
      expect(result.autoApplied).toEqual(['returns', 'note', 'billing']);
      expect(result.map.elements.map((candidate) => candidate.id)).not.toContain('note');
      expect(element(result.map, 'billing')).toBeDefined();
      expect(element(result.map, 'returns').label).toBe('Refunds');
    });

    it('keeps the starting side changes without listing them as auto-applied', async () => {
      const result = await merge(edited(setProperty('payment', { label: 'Pay' })), baseMap());

      expect(result.autoApplied).toEqual([]);
      expect(element(result.map, 'payment').label).toBe('Pay');
    });

    it('merges disjoint hidden relations', async () => {
      const result = await merge(
        edited((map) => map.hiddenRelations.push('signal:x:y:Done')),
        edited((map) => (map.hiddenRelations = ['callActivity:c:d'])),
      );

      expect(result.conflicts).toEqual([]);
      expect(result.map.hiddenRelations).toEqual(['signal:x:y:Done', 'callActivity:c:d']);
    });
  });

  describe('(c) an item changed on both sides merges per property', () => {
    it('applies disjoint property changes from both sides', async () => {
      const result = await merge(
        edited(setProperty('returns', { label: 'Refunds' })),
        edited(setProperty('returns', { style: { fill: '#ffcdd2', stroke: null } })),
      );

      expect(result.conflicts).toEqual([]);
      expect(result.autoApplied).toEqual(['returns']);
      expect(element(result.map, 'returns')).toMatchObject({
        label: 'Refunds',
        style: { fill: '#ffcdd2', stroke: null },
      });
    });

    it('applies an equal change once', async () => {
      const result = await merge(
        edited(setProperty('returns', { label: 'Refunds' })),
        edited(setProperty('returns', { label: 'Refunds' })),
      );

      expect(result.conflicts).toEqual([]);
      expect(result.autoApplied).toEqual([]);
      expect(element(result.map, 'returns').label).toBe('Refunds');
    });

    it('makes different values of one property a conflict that keeps the starting side', async () => {
      const result = await merge(
        edited(setProperty('returns', { label: 'Refunds' })),
        edited(setProperty('returns', { label: 'Reclaims', shape: 'chevron' })),
      );

      expect(result.conflicts).toEqual(['returns']);
      expect(element(result.map, 'returns')).toMatchObject({ label: 'Refunds', shape: 'box' });
    });

    it('treats the bounds as one group: a move and a resize conflict', async () => {
      const result = await merge(
        edited(setProperty('payment', { x: 300 })),
        edited(setProperty('payment', { width: 200 })),
      );

      expect(result.conflicts).toEqual(['payment']);
      expect(element(result.map, 'payment')).toMatchObject({ x: 300, width: 140 });
    });
  });

  describe('(d) removed on one side', () => {
    it('is a conflict when the other side modified the item', async () => {
      const result = await merge(edited(removeElement('note')), edited(setProperty('note', { text: 'Final' })));

      expect(result.conflicts).toEqual(['note']);
      expect(element(result.map, 'note')).toBeUndefined();
    });

    it('is removed when both sides removed it', async () => {
      const result = await merge(edited(removeElement('note')), edited(removeElement('note')));

      expect(result.conflicts).toEqual([]);
      expect(result.autoApplied).toEqual([]);
      expect(element(result.map, 'note')).toBeUndefined();
    });
  });

  describe('(e) invariants of the merged map', () => {
    it('makes a connector to an element the apply side removed and that element conflicts; open, both stay', async () => {
      const starting = edited((map) =>
        map.connectors.push({ id: 'notes', sourceId: 'payment', targetId: 'note', label: '', waypoints: [] }),
      );

      const result = await merge(starting, edited(removeElement('note')));

      expect(result.conflicts).toEqual(['note', 'notes']);
      expect(result.autoApplied).toEqual([]);
      expect(element(result.map, 'note')).toBeDefined();
      expect(result.map.connectors.map((connector) => connector.id)).toEqual(['pays', 'notes']);
      expect(result.invalidReason).toBeNull();
    });

    it('makes a group the starting side removed and an element added into it conflicts; open, both stay out', async () => {
      const result = await merge(
        edited(removeElement('archive')),
        edited(addElement(placeholder('old-orders', 'archive'))),
      );

      expect(result.conflicts).toEqual(['archive', 'old-orders']);
      expect(element(result.map, 'archive')).toBeUndefined();
      expect(element(result.map, 'old-orders')).toBeUndefined();
      expect(result.invalidReason).toBeNull();
    });

    it('makes a group the apply side removed and an element added into it conflicts; open, both stay', async () => {
      const result = await merge(
        edited(addElement(placeholder('old-orders', 'archive'))),
        edited(removeElement('archive')),
      );

      expect(result.conflicts).toEqual(['archive', 'old-orders']);
      expect(result.autoApplied).toEqual([]);
      expect(element(result.map, 'archive')).toBeDefined();
      expect(element(result.map, 'old-orders')).toMatchObject({ parentId: 'archive' });

      const accepted = await merge(
        edited(addElement(placeholder('old-orders', 'archive'))),
        edited(removeElement('archive')),
        { archive: 'accepted-theirs', 'old-orders': 'accepted-ours' },
      );
      expect(accepted.invalidReason).toBe(
        "Element 'old-orders' is inside 'archive', which is not a band or group of the merged map.",
      );
    });

    it('makes the apply-side process of a process placed twice the conflict', async () => {
      const result = await merge(
        edited(addElement(processShape('shipping-ours', 'shipping-process'))),
        edited(addElement(processShape('shipping-theirs', 'shipping-process'))),
      );

      expect(result.conflicts).toEqual(['shipping-theirs']);
      expect(element(result.map, 'shipping-ours')).toBeDefined();
      expect(element(result.map, 'shipping-theirs')).toBeUndefined();
    });

    it('makes a band that ends up inside another element a conflict', async () => {
      const result = await merge(
        edited(setProperty('archive', { type: 'band', collapsed: undefined })),
        edited(setProperty('archive', { parentId: 'band' })),
      );

      expect(result.conflicts).toEqual(['archive']);
      expect(element(result.map, 'archive')).toMatchObject({ type: 'band', parentId: null });
      expect(result.invalidReason).toBeNull();
    });
  });

  describe('(f) a resolved conflict takes the chosen side', () => {
    const starting = edited(setProperty('returns', { label: 'Refunds' }));
    const apply = edited(setProperty('returns', { label: 'Reclaims', shape: 'chevron' }));

    it('takes the whole item of the side the user accepted', async () => {
      const theirs = await merge(starting, apply, { returns: 'accepted-theirs' });
      const ours = await merge(starting, apply, { returns: 'accepted-ours' });

      expect(theirs.conflicts).toEqual(['returns']);
      expect(element(theirs.map, 'returns')).toMatchObject({ label: 'Reclaims', shape: 'chevron' });
      expect(element(ours.map, 'returns')).toMatchObject({ label: 'Refunds', shape: 'box' });
    });

    it('checks the invariants again: a kept connector to a removed element makes the result invalid', async () => {
      const withConnector = edited((map) =>
        map.connectors.push({ id: 'notes', sourceId: 'payment', targetId: 'note', label: '', waypoints: [] }),
      );

      const result = await merge(withConnector, edited(removeElement('note')), {
        note: 'accepted-theirs',
        notes: 'accepted-ours',
      });

      expect(result.conflicts).toEqual(['note', 'notes']);
      expect(result.invalidReason).toContain("Connector 'notes' points to 'note'");
    });

    it('puts a reverted auto-applied item back to the starting side', async () => {
      const result = await merge(baseMap(), edited(addElement(placeholder('billing'))), { billing: 'reverted' });

      expect(result.autoApplied).toEqual([]);
      expect(element(result.map, 'billing')).toBeUndefined();
    });

    it('swaps the sides on a rebase, where git ours is the apply side', async () => {
      const result = await merge(starting, apply, { returns: 'accepted-ours' }, 'rebase');

      expect(element(result.map, 'returns').label).toBe('Reclaims');
    });
  });

  describe('(g) result order', () => {
    it('keeps the starting-side order and appends apply-side additions after their parent’s children', async () => {
      const apply = edited(addElement(placeholder('quotes', 'sales')), (map) => map.elements.reverse());

      const result = await merge(baseMap(), apply);

      expect(result.map.elements.map((candidate) => candidate.id)).toEqual([
        'band',
        'sales',
        'order',
        'quotes',
        'payment',
        'returns',
        'note',
        'archive',
      ]);
    });
  });

  describe('(h) the result must read back as a map', () => {
    it('is valid for a clean merge', async () => {
      const result = await merge(
        edited(setProperty('payment', { label: 'Pay' })),
        edited(addElement(placeholder('billing'))),
      );

      expect(result.invalidReason).toBeNull();
    });

    it('reports the reader diagnostics when the merged map cannot be read', async () => {
      const result = await merge(
        edited((map) => (map.connectors[0].sourceId = 'returns')),
        edited((map) => (map.connectors[0].targetId = 'returns')),
      );

      expect(result.conflicts).toEqual([]);
      expect(result.invalidReason).toContain("Connector 'pays' starts and ends at 'returns'.");
    });
  });
});
