import { MapsDecorationProvider } from '#modules/bpmn-landscape/mapsExplorerDecorations';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const FOLDER = 'file:///work/app/landscapes';

const { scanCatalog, scanMaps } = vi.hoisted(() => ({ scanCatalog: vi.fn(), scanMaps: vi.fn() }));
vi.mock('#modules/bpmn-core/scanSolutionBpmnModels', () => ({ scanSolutionBpmnModels: scanCatalog }));
vi.mock('#modules/bpmn-landscape/scanSolutionLandscapeMaps', () => ({ scanSolutionLandscapeMaps: scanMaps }));

const orderFile = {
  kind: 'bpmn',
  uri: 'file:///work/app/order.bpmn',
  sha256: 'hash',
  storedLinterScores: [],
  processes: [{ id: 'order' }],
};

describe('MapsDecorationProvider', () => {
  beforeEach(() => {
    scanCatalog.mockReset().mockResolvedValue([orderFile]);
    scanMaps.mockReset();
  });

  it('counts the broken references of a map and marks an unreadable map', async () => {
    scanMaps.mockResolvedValue([
      {
        uri: `${FOLDER}/Sales.bfwmap`,
        name: 'Sales',
        error: null,
        processReferences: [
          { processId: 'order', fileHint: '../order.bpmn' },
          { processId: 'gone', fileHint: null },
          { processId: 'removed', fileHint: null },
        ],
      },
      {
        uri: `${FOLDER}/Clean.bfwmap`,
        name: 'Clean',
        error: null,
        processReferences: [{ processId: 'order', fileHint: null }],
      },
      { uri: `${FOLDER}/Broken.bfwmap`, name: 'Broken', error: 'bad xml', processReferences: [] },
    ]);
    const provider = new MapsDecorationProvider();
    const changes: string[][] = [];
    provider.onDidChange((uris) => changes.push(uris));

    await provider.refresh({} as any);

    expect(provider.provideDecoration(`${FOLDER}/Sales.bfwmap`)?.badges).toEqual([
      {
        type: 'number',
        number: 2,
        tooltip: '2 processes on this map are not found in the solution or defined in several files.',
      },
    ]);
    expect(provider.provideDecoration(`${FOLDER}/Broken.bfwmap`)?.badges).toEqual([
      { type: 'character', character: '!', tooltip: 'This map cannot be read: bad xml' },
    ]);
    expect(provider.provideDecoration(`${FOLDER}/Clean.bfwmap`)).toBeNull();
    expect(changes).toHaveLength(1);
    expect(changes[0].sort()).toEqual([`${FOLDER}/Broken.bfwmap`, `${FOLDER}/Sales.bfwmap`]);
  });

  it('reports only the maps whose badge changed, and clears a badge that is no longer needed', async () => {
    const sales = {
      uri: `${FOLDER}/Sales.bfwmap`,
      name: 'Sales',
      error: null,
      processReferences: [{ processId: 'gone', fileHint: null }],
    };
    scanMaps.mockResolvedValue([sales]);
    const provider = new MapsDecorationProvider();
    await provider.refresh({} as any);
    const changes: string[][] = [];
    provider.onDidChange((uris) => changes.push(uris));

    await provider.refresh({} as any);
    expect(changes).toEqual([]);

    scanMaps.mockResolvedValue([{ ...sales, processReferences: [{ processId: 'order', fileHint: null }] }]);
    await provider.refresh({} as any);
    expect(changes).toEqual([[sales.uri]]);
    expect(provider.provideDecoration(sales.uri)).toBeNull();
  });

  it('keeps its badges when a scan fails', async () => {
    scanMaps.mockResolvedValueOnce([
      { uri: `${FOLDER}/Broken.bfwmap`, name: 'Broken', error: 'bad xml', processReferences: [] },
    ]);
    const provider = new MapsDecorationProvider();
    await provider.refresh({} as any);
    scanMaps.mockRejectedValueOnce(new Error('disk gone'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await provider.refresh({} as any);

    expect(provider.provideDecoration(`${FOLDER}/Broken.bfwmap`)).not.toBeNull();
  });
});
