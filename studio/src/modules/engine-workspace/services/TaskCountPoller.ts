import type { Bifrost } from '#bifrost/Bifrost';
import type { EngineConnectionManager } from '#modules/engine-core';
import { FlowNodeInstanceState, FlowNodeType } from '@elraptorus/daemonengine_sdk';

import { TASK_INBOX_PENDING_COUNTS_KEY } from '../constants/sharedResourceKeys';

const POLL_INTERVAL_MS = 30_000;

export function startTaskCountPoller(bifrost: Bifrost, connectionManager: EngineConnectionManager): () => void {
  const poll = async (): Promise<void> => {
    const engines = connectionManager.getAllEngines().filter((engine) => engine.state === 'connected');
    const counts: Record<string, number> = {};

    await Promise.all(
      engines.map(async (engine) => {
        const client = connectionManager.getClient(engine.engineId);
        if (!client) {
          return;
        }
        try {
          const lanes = connectionManager.identity.getLanes(engine.url);
          const filter = {
            state: { eq: FlowNodeInstanceState.Waiting },
            flowNodeType: { eq: FlowNodeType.UserTask },
            ...(lanes.length > 0 ? { laneName: { in: lanes } } : {}),
          };
          const result = await client.graphql.queryFlowNodeInstances({
            fields: ['id'],
            filter,
            pagination: { mode: 'offset', limit: 100, offset: 0 },
          });
          counts[engine.engineId] = result.pageInfo.type === 'offset' ? result.pageInfo.totalCount : result.data.length;
        } catch (countError) {
          console.warn('[TaskCountPoller] Failed to fetch task count for engine', engine.engineId, countError);
          counts[engine.engineId] = 0;
        }
      }),
    );

    bifrost.registerSharedRessource(TASK_INBOX_PENDING_COUNTS_KEY, counts, true);
  };

  void poll();
  const timerId = setInterval(() => void poll(), POLL_INTERVAL_MS);

  const connectedSubscription = connectionManager.on('engine:connected', () => void poll());
  const reconnectedSubscription = connectionManager.on('engine:reconnected', () => void poll());
  const connectionLostSubscription = connectionManager.on('engine:connection-lost', () => void poll());

  return () => {
    clearInterval(timerId);
    connectedSubscription.dispose();
    reconnectedSubscription.dispose();
    connectionLostSubscription.dispose();
  };
}
