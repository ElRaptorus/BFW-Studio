import { fetchEngineSnapshot } from '#modules/engine-deploy/analysis/fetchEngineSnapshot';
import type { SnapshotClient } from '#modules/engine-deploy/analysis/fetchEngineSnapshot';
import { sha256Hex } from '#modules/solution-models/scanSolutionModels';
import { describe, expect, it } from 'vitest';

function createClient(overrides: Partial<SnapshotClient> = {}): { client: SnapshotClient; requested: string[] } {
  const requested: string[] = [];
  const client: SnapshotClient = {
    engine: { health: async () => undefined },
    processes: {
      getAll: async () => [{ id: 'order-process' }, { id: 'other-process' }],
      getVersions: async (id) => {
        requested.push(`process:${id}`);
        return [{ version: '1.0.0', bpmnXml: '<a/>' }, { bpmnXml: '<ignored/>' }];
      },
    },
    decisions: {
      getAll: async () => [{ id: 'discount-rules' }],
      getVersions: async (id) => {
        requested.push(`decision:${id}`);
        return [{ version: 'abcdef123456' }, {}];
      },
    },
    ...overrides,
  };
  return { client, requested };
}

describe('fetchEngineSnapshot', () => {
  it('hashes the deployed BPMN XML and keeps the decision version strings', async () => {
    const { client } = createClient();

    const snapshot = await fetchEngineSnapshot(client, ['order-process'], ['discount-rules']);

    expect(snapshot.health).toEqual({ ok: true, message: null });
    expect(snapshot.processes).toEqual({ 'order-process': [{ version: '1.0.0', sha256: await sha256Hex('<a/>') }] });
    expect(snapshot.decisions).toEqual({ 'discount-rules': ['abcdef123456'] });
  });

  it('only asks for ids that the Engine knows and requests each once', async () => {
    const { client, requested } = createClient();

    const snapshot = await fetchEngineSnapshot(client, ['order-process', 'order-process', 'ghost'], ['ghost-rules']);

    expect(requested).toEqual(['process:order-process']);
    expect(snapshot.processes).not.toHaveProperty('ghost');
    expect(snapshot.decisions).toEqual({});
  });

  it('turns a failing health check into health.ok = false without throwing', async () => {
    const { client } = createClient({
      engine: {
        health: async () => {
          throw new Error('connection refused');
        },
      },
    });

    const snapshot = await fetchEngineSnapshot(client, ['order-process'], []);

    expect(snapshot).toEqual({ health: { ok: false, message: 'connection refused' }, processes: {}, decisions: {} });
  });

  it('reports a failing version request the same way', async () => {
    const { client } = createClient();
    client.processes.getVersions = async () => {
      throw new Error('403 forbidden');
    };

    const snapshot = await fetchEngineSnapshot(client, ['order-process'], []);

    expect(snapshot.health).toEqual({ ok: false, message: '403 forbidden' });
  });
});
