import type { LandscapeSolutionSnapshot } from '#modules/bpmn-landscape/LandscapeSolutionScan';
import { MapsDecorationProvider } from '#modules/bpmn-landscape/mapsExplorerDecorations';
import { describe, expect, it } from 'vitest';

const FOLDER = 'file:///work/app/landscapes';

const orderFile = {
  kind: 'bpmn',
  uri: 'file:///work/app/order.bpmn',
  sha256: 'hash',
  storedLinterScores: [],
  processes: [{ id: 'order' }],
};

function snapshotOf(maps: unknown[]): LandscapeSolutionSnapshot {
  return { catalog: [orderFile], maps, relations: [] } as unknown as LandscapeSolutionSnapshot;
}

describe('MapsDecorationProvider', () => {
  it('counts the broken references of a map and marks an unreadable map', () => {
    const provider = new MapsDecorationProvider();
    const changes: string[][] = [];
    provider.onDidChange((uris) => changes.push(uris));

    provider.apply(
      snapshotOf([
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
      ]),
    );

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
    expect(changes[0]?.sort()).toEqual([`${FOLDER}/Broken.bfwmap`, `${FOLDER}/Sales.bfwmap`]);
  });

  it('reports only the maps whose badge changed, and clears a badge that is no longer needed', () => {
    const sales = {
      uri: `${FOLDER}/Sales.bfwmap`,
      name: 'Sales',
      error: null,
      processReferences: [{ processId: 'gone', fileHint: null }],
    };
    const provider = new MapsDecorationProvider();
    provider.apply(snapshotOf([sales]));
    const changes: string[][] = [];
    provider.onDidChange((uris) => changes.push(uris));

    provider.apply(snapshotOf([sales]));
    expect(changes).toEqual([]);

    provider.apply(snapshotOf([{ ...sales, processReferences: [{ processId: 'order', fileHint: null }] }]));
    expect(changes).toEqual([[sales.uri]]);
    expect(provider.provideDecoration(sales.uri)).toBeNull();
  });
});
