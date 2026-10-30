import type { LandscapeLayout, LandscapeLayoutInput } from '#modules/bpmn-landscape/layoutLandscape';
import { layoutLandscape, PROCESS_SHAPE_HEIGHT, PROCESS_SHAPE_WIDTH } from '#modules/bpmn-landscape/layoutLandscape';
import ElkBundled from 'elkjs/lib/elk.bundled.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The real worker script only runs in Electron; the bundled build runs the same algorithm in Node.
// The bundled class runs the algorithm in-process; the browser worker factory needs a web `Worker`.
vi.mock('elkjs/lib/elk-api', async () => {
  const ElkInProcess = (await import('elkjs/lib/elk.bundled.js')).default;
  return {
    default: class extends ElkInProcess {
      constructor({ workerUrl }: { workerUrl?: string }) {
        super({ workerUrl });
      }
    },
  };
});

type Rectangle = { x: number; y: number; width: number; height: number };

function nodeRectangle(layout: LandscapeLayout, key: string): Rectangle {
  const position = layout.nodes.get(key);
  if (position == null) {
    throw new Error(`The layout has no node ${key}.`);
  }
  return { ...position, width: PROCESS_SHAPE_WIDTH, height: PROCESS_SHAPE_HEIGHT };
}

const overlaps = (first: Rectangle, second: Rectangle): boolean =>
  first.x < second.x + second.width &&
  second.x < first.x + first.width &&
  first.y < second.y + second.height &&
  second.y < first.y + first.height;

function node(key: string, group?: string): LandscapeLayoutInput['nodes'][number] {
  return { key, groupKey: group ?? null, groupLabel: group == null ? null : `Group ${group}` };
}

const callEdge = (sourceKey: string, targetKey: string): LandscapeLayoutInput['edges'][number] => ({
  sourceKey,
  targetKey,
  kind: 'callActivity',
});

describe('layoutLandscape', () => {
  beforeAll(() => {
    vi.stubGlobal('document', { baseURI: 'file:///studio/electron-renderer.html' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives the same result for the same processes in any order', async () => {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => node(key, key < 'd' ? 'one' : 'two'));
    const edges = [callEdge('a', 'b'), callEdge('a', 'c'), callEdge('c', 'd'), callEdge('e', 'f')];
    const options = { callHierarchy: true };

    const first = await layoutLandscape({ nodes, edges, options });
    const second = await layoutLandscape({ nodes: [...nodes].reverse(), edges: [...edges].reverse(), options });

    expect([...second.nodes.entries()].sort()).toEqual([...first.nodes.entries()].sort());
    expect(second.groups).toEqual(first.groups);
  });

  it('keeps node rectangles and group rectangles apart', async () => {
    const nodes = Array.from({ length: 12 }, (_, index) => node(`p${index}`, `g${index % 3}`));
    const edges = [callEdge('p0', 'p1'), callEdge('p1', 'p5'), callEdge('p2', 'p3'), callEdge('p0', 'p8')];

    const layout = await layoutLandscape({ nodes, edges, options: { callHierarchy: false } });

    const rectangles = nodes.map((candidate) => nodeRectangle(layout, candidate.key));
    rectangles.forEach((rectangle, index) => {
      rectangles.slice(index + 1).forEach((other) => expect(overlaps(rectangle, other)).toBe(false));
    });
    layout.groups.forEach((group, index) => {
      layout.groups.slice(index + 1).forEach((other) => expect(overlaps(group, other)).toBe(false));
    });
  });

  it('terminates on a call cycle and places every node', async () => {
    const nodes = ['a', 'b', 'c'].map((key) => node(key));
    const edges = [callEdge('a', 'b'), callEdge('b', 'c'), callEdge('c', 'a'), callEdge('a', 'a')];

    const layout = await layoutLandscape({ nodes, edges, options: { callHierarchy: true } });

    expect([...layout.nodes.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('puts a callee below its caller, and a message edge changes no row with the call hierarchy on', async () => {
    const nodes = ['caller', 'callee', 'sender', 'receiver'].map((key) => node(key));
    const edges: LandscapeLayoutInput['edges'] = [
      callEdge('caller', 'callee'),
      { sourceKey: 'sender', targetKey: 'receiver', kind: 'message' },
    ];

    const layout = await layoutLandscape({ nodes, edges, options: { callHierarchy: true } });

    expect(layout.nodes.get('callee')!.y).toBeGreaterThan(layout.nodes.get('caller')!.y);
    expect(layout.nodes.get('receiver')!.y).toBe(layout.nodes.get('sender')!.y);
  });

  it('puts a message receiver below its sender when every relation counts', async () => {
    const nodes = ['sender', 'receiver'].map((key) => node(key));
    const edges: LandscapeLayoutInput['edges'] = [{ sourceKey: 'sender', targetKey: 'receiver', kind: 'message' }];

    const layout = await layoutLandscape({ nodes, edges, options: { callHierarchy: false } });

    expect(layout.nodes.get('receiver')!.y).toBeGreaterThan(layout.nodes.get('sender')!.y);
  });

  it('keeps grouped processes inside their group, below its 40 pixel header', async () => {
    const nodes = [node('a', 'one'), node('b', 'one'), node('c', 'two'), node('d')];
    const edges = [callEdge('a', 'b'), callEdge('b', 'c'), callEdge('c', 'd')];

    const layout = await layoutLandscape({ nodes, edges, options: { callHierarchy: true } });

    expect(layout.groups.map((group) => group.label)).toEqual(['Group one', 'Group two']);
    for (const [key, groupKey] of [
      ['a', 'one'],
      ['b', 'one'],
      ['c', 'two'],
    ] as const) {
      const group = layout.groups.find((candidate) => candidate.key === groupKey)!;
      const rectangle = nodeRectangle(layout, key);
      expect(rectangle.x).toBeGreaterThanOrEqual(group.x);
      expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(group.x + group.width);
      expect(rectangle.y).toBeGreaterThanOrEqual(group.y + 40);
      expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(group.y + group.height);
    }
  });

  it('ignores edges to processes that are not in the layout', async () => {
    const layout = await layoutLandscape({
      nodes: [node('a')],
      edges: [callEdge('a', 'missing')],
      options: { callHierarchy: false },
    });

    expect([...layout.nodes.keys()]).toEqual(['a']);
  });

  it('rejects with a message when the layout fails', async () => {
    vi.spyOn(ElkBundled.prototype, 'layout').mockRejectedValueOnce(new Error('out of memory'));

    await expect(layoutLandscape({ nodes: [node('a')], edges: [], options: { callHierarchy: false } })).rejects.toThrow(
      'The layout of 1 processes failed: out of memory',
    );
  });
});
