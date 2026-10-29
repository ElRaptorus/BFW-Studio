import type { Bifrost } from '#bifrost/Bifrost';
import { DashboardDocumentModel } from '#modules/engine-workspace/models/DashboardDocumentModel';
import assert from 'node:assert';
import { describe, it } from 'vitest';

import { ServiceUnavailableError } from '@elraptorus/bfw_engine_sdk';

const info = { engineName: 'Local', version: '1.0.0' };

async function createModel(stats: () => Promise<unknown>): Promise<DashboardDocumentModel> {
  const client = {
    engine: {
      info: async () => info,
      stats,
      health: async () => undefined,
    },
  };
  const connectionManager = {
    extractEngineIdFromUri: () => 'e1',
    getClient: () => client,
  };
  const studio = { getSharedRessource: () => connectionManager } as unknown as Bifrost;
  return DashboardDocumentModel.create('engine://e1/dashboard', null, null, null, studio);
}

describe('DashboardDocumentModel.refresh', () => {
  it('keeps the dashboard usable and reports "unavailable" when statistics answer 503', async () => {
    const model = await createModel(async () => {
      throw new ServiceUnavailableError('Statistics are unavailable');
    });

    await model.refresh();

    assert.strictEqual(model.getError(), null);
    assert.deepStrictEqual(model.getInfo(), info);
    assert.strictEqual(model.getStats(), null);
    assert.strictEqual(model.getStatisticsProblem()?.kind, 'unavailable');
  });

  it('reports "failed" for any other statistics error', async () => {
    const model = await createModel(async () => {
      throw new Error('boom');
    });

    await model.refresh();

    assert.strictEqual(model.getStatisticsProblem()?.kind, 'failed');
    assert.strictEqual(model.getStatisticsProblem()?.message, 'boom');
  });

  it('clears the problem once statistics load again', async () => {
    let shouldFail = true;
    const model = await createModel(async () => {
      if (shouldFail) {
        throw new Error('boom');
      }
      return { processInstances: {} };
    });

    await model.refresh();
    shouldFail = false;
    await model.refresh();

    assert.strictEqual(model.getStatisticsProblem(), null);
    assert.notStrictEqual(model.getStats(), null);
  });
});
