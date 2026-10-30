import { parseLandscapeMap, serializeLandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import type { ProcessRelation } from '#modules/bpmn-landscape/buildProcessRelations';
import type { CreateLandscapeMapRequest } from '#modules/bpmn-landscape/createLandscapeMap';
import { createLandscapeMap } from '#modules/bpmn-landscape/createLandscapeMap';
import { beforeAll, describe, expect, it, vi } from 'vitest';

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

const MAP_URI = 'file:///work/app/landscapes/New.bfwmap';

function catalogOf(files: Record<string, string[]>): CreateLandscapeMapRequest['catalog'] {
  return Object.entries(files).map(([uri, processIds]) => ({
    kind: 'bpmn',
    uri,
    sha256: 'hash',
    storedLinterScores: [],
    processes: processIds.map((id) => ({ id })),
  })) as unknown as CreateLandscapeMapRequest['catalog'];
}

function callRelation(source: [string, string], target: [string, string]): ProcessRelation {
  return {
    key: `callActivity:${source[1]}:${target[1]}`,
    kind: 'callActivity',
    source: { uri: source[0], processId: source[1] },
    target: { uri: target[0], processId: target[1] },
    name: null,
    sourceFlowNodeIds: [],
    targetFlowNodeIds: [],
  };
}

const SALES_A_URI = 'file:///work/app/sales/a.bpmn';
const SALES_B_URI = 'file:///work/app/sales/b.bpmn';
const BILLING_C_URI = 'file:///work/app/billing/c.bpmn';
const BILLING_D_URI = 'file:///work/app/billing/d.bpmn';

const chain = {
  catalog: catalogOf({ [SALES_A_URI]: ['a'], [SALES_B_URI]: ['b'], [BILLING_C_URI]: ['c'], [BILLING_D_URI]: ['d'] }),
  relations: [
    callRelation([SALES_A_URI, 'a'], [SALES_B_URI, 'b']),
    callRelation([SALES_B_URI, 'b'], [BILLING_C_URI, 'c']),
    callRelation([BILLING_C_URI, 'c'], [BILLING_D_URI, 'd']),
  ],
};

function request(overrides: Partial<CreateLandscapeMapRequest>): CreateLandscapeMapRequest {
  return {
    ...chain,
    seeds: [{ uri: SALES_B_URI, processId: 'b' }],
    neighbourSteps: 0,
    grouping: 'none',
    callHierarchy: true,
    name: 'New',
    mapUri: MAP_URI,
    ...overrides,
  };
}

const processIdsOf = (map: Awaited<ReturnType<typeof createLandscapeMap>>): string[] =>
  map.elements.flatMap((element) => (element.type === 'process' ? [element.processId] : [])).sort();

describe('createLandscapeMap', () => {
  beforeAll(() => {
    vi.stubGlobal('document', { baseURI: 'file:///studio/electron-renderer.html' });
  });

  it('shows only the selected processes with zero neighbour steps', async () => {
    expect(processIdsOf(await createLandscapeMap(request({ neighbourSteps: 0 })))).toEqual(['b']);
  });

  it('adds the processes within two relation steps, in both directions', async () => {
    expect(processIdsOf(await createLandscapeMap(request({ neighbourSteps: 1 })))).toEqual(['a', 'b', 'c']);
    expect(processIdsOf(await createLandscapeMap(request({ neighbourSteps: 2 })))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('shows a process id once, from the seed file, with a file hint relative to the map', async () => {
    const otherB = 'file:///work/app/archive/b.bpmn';
    const map = await createLandscapeMap(
      request({
        catalog: catalogOf({ [SALES_A_URI]: ['a'], [SALES_B_URI]: ['b'], [otherB]: ['b'] }),
        relations: [
          callRelation([SALES_A_URI, 'a'], [otherB, 'b']),
          callRelation([SALES_A_URI, 'a'], [SALES_B_URI, 'b']),
        ],
        seeds: [{ uri: otherB, processId: 'b' }],
        neighbourSteps: 1,
      }),
    );

    const shapes = map.elements.filter((element) => element.type === 'process');
    expect(shapes.map((shape) => (shape.type === 'process' ? [shape.processId, shape.fileHint] : []))).toEqual([
      ['b', '../archive/b.bpmn'],
      ['a', '../sales/a.bpmn'],
    ]);
  });

  it('ignores a seed that is not in the catalog', async () => {
    const map = await createLandscapeMap(request({ seeds: [{ uri: SALES_A_URI, processId: 'gone' }] }));

    expect(map.elements).toEqual([]);
  });

  it('groups by file, with the level named after the grouping', async () => {
    const map = await createLandscapeMap(request({ grouping: 'file', neighbourSteps: 3 }));

    expect(map.levels.map((level) => level.name)).toEqual(['File']);
    const groups = map.elements.flatMap((element) => (element.type === 'group' ? [element] : []));
    expect(groups.map((group) => group.label).sort()).toEqual(['a.bpmn', 'b.bpmn', 'c.bpmn', 'd.bpmn']);
    const shape = map.elements.find((element) => element.type === 'process' && element.processId === 'c');
    expect(shape?.parentId).toBe(groups.find((group) => group.label === 'c.bpmn')?.id);
  });

  it('groups by folder, and puts a lone folder process in its folder group', async () => {
    const map = await createLandscapeMap(request({ grouping: 'folder', neighbourSteps: 3 }));

    expect(map.levels.map((level) => level.name)).toEqual(['Folder']);
    const groups = map.elements.flatMap((element) => (element.type === 'group' ? [element] : []));
    expect(groups.map((group) => group.label).sort()).toEqual(['billing', 'sales']);
    const parents = map.elements.flatMap((element) => (element.type === 'process' ? [element.parentId] : []));
    expect(parents.every((parentId) => groups.some((group) => group.id === parentId))).toBe(true);
  });

  it('has no groups and no levels without grouping, and every id is unique', async () => {
    const map = await createLandscapeMap(request({ neighbourSteps: 3, grouping: 'none' }));

    expect(map.levels).toEqual([]);
    expect(map.elements.every((element) => element.type === 'process' && element.parentId === null)).toBe(true);
    const ids = map.elements.map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('places a callee below its caller', async () => {
    const map = await createLandscapeMap(request({ neighbourSteps: 3 }));

    const rowOf = (processId: string): number =>
      map.elements.find((element) => element.type === 'process' && element.processId === processId)!.y;
    expect(rowOf('a')).toBeLessThan(rowOf('b'));
    expect(rowOf('b')).toBeLessThan(rowOf('c'));
    expect(rowOf('c')).toBeLessThan(rowOf('d'));
  });

  it('writes a file the reader accepts', async () => {
    const map = await createLandscapeMap(request({ neighbourSteps: 3, grouping: 'file' }));

    const parsed = await parseLandscapeMap(serializeLandscapeMap(map));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.map.elements).toHaveLength(map.elements.length);
    }
  });
});
