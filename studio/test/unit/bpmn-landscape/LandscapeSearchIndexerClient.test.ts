import { createEmptyLandscapeMap, serializeLandscapeMap } from '#modules/bpmn-landscape/LandscapeMapFile';
import { LandscapeSearchIndexerClient } from '#modules/bpmn-landscape/LandscapeSearchIndexerClient';
import { describe, expect, it } from 'vitest';

const geometry = { parentId: null, x: 0, y: 0, width: 140, height: 60, style: null };

function mapText(): string {
  return serializeLandscapeMap({
    ...createEmptyLandscapeMap('Sales'),
    elements: [
      { ...geometry, id: 'sales', type: 'group', label: 'Sales', collapsed: true },
      {
        ...geometry,
        id: 'order',
        type: 'process',
        processId: 'order-process',
        fileHint: null,
        label: null,
        shape: 'box',
      },
      { ...geometry, id: 'link', type: 'mapLink', label: 'Billing', mapPath: 'billing.bfwmap' },
      { ...geometry, id: 'note', type: 'note', text: 'Check stock\nthen ship' },
    ],
  });
}

describe('LandscapeSearchIndexerClient', () => {
  const client = new LandscapeSearchIndexerClient();

  it('indexes every element with its name, id, reference and the id to reveal', async () => {
    const outcome = await client.index('file:///sales.bfwmap', 'bpmn-landscape-map', mapText());

    expect(outcome.success).toBe(true);
    expect(outcome.result).toEqual([
      expect.objectContaining({ label: 'Sales', type: 'group', prio1: 'Sales', prio2: 'sales', prio3: '' }),
      expect.objectContaining({
        uri: 'file:///sales.bfwmap',
        documentType: 'bpmn-landscape-map',
        label: 'order-process',
        icon: 'bpmn-landscape/search-result/types/process',
        prio2: 'order',
        prio3: 'order-process',
        metadata: { elementId: 'order' },
      }),
      expect.objectContaining({ label: 'Billing', prio3: 'billing.bfwmap', metadata: { elementId: 'link' } }),
      expect.objectContaining({ label: 'Check stock', type: 'note', metadata: { elementId: 'note' } }),
    ]);
  });

  it('reports a map that cannot be read instead of indexing it', async () => {
    const outcome = await client.index('file:///broken.bfwmap', 'bpmn-landscape-map', '<not a map');

    expect(outcome.success).toBe(false);
    expect(outcome.error).toEqual(expect.any(String));
  });
});
