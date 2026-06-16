import type { DaemonEngineClient, Subscription } from '@elraptorus/daemonengine_client';
import type { EngineEventEnvelope } from '@elraptorus/daemonengine_sdk';

import type { EngineConnectionManager } from './EngineConnectionManager';

/**
 * Bridges engine-level WebSocket events from all connected engines into the
 * EngineConnectionManager's emitter. PI-scoped events are NOT received here —
 * they only flow through `process_instance:<id>` channels (see SubscribeThenSnapshot).
 *
 * Engine-level events: EngineStarted, EngineShutdown, EngineOverloaded,
 * EngineRecovered, PluginQuarantined, DecisionDefinitionDeployed/Undeployed.
 *
 * Additionally registers socket lifecycle callbacks (onSocketOpen / onSocketClose /
 * onSocketError) on each engine's NotificationClient to drive near-instant
 * connection-loss and reconnection detection — replacing the old REST health poll.
 *
 * Other modules subscribe to engine events via:
 *   connectionManager.on('engine:event', (payload) => { ... })
 */
export class WebSocketBridge {
  private readonly connectionManager: EngineConnectionManager;
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly lifecycleSubscriptions = new Map<string, Subscription[]>();
  private readonly failedEngines = new Set<string>();

  constructor(connectionManager: EngineConnectionManager) {
    this.connectionManager = connectionManager;

    connectionManager.on('engine:connected', (event: { engineId: string }) => {
      void this.subscribeEngine(event.engineId);
    });

    connectionManager.on('engine:disconnected', (event: { engineId: string }) => {
      this.unsubscribeEngine(event.engineId);
    });

    connectionManager.on('engine:reconnected', (event: { engineId: string }) => {
      this.unsubscribeEngine(event.engineId);
      void this.subscribeEngine(event.engineId);
    });

    connectionManager.on('engine:auth-token-changed', (event: { engineId: string }) => {
      this.reconnectEngine(event.engineId);
    });
  }

  private async subscribeEngine(engineId: string): Promise<void> {
    const connection = this.connectionManager.getConnection(engineId);
    if (!connection) {
      return;
    }

    this.attachLifecycleCallbacks(engineId, connection.client);

    try {
      await connection.client.notifications.connect();
      const subscription = await connection.client.notifications.onEngineEvent((envelope: EngineEventEnvelope) => {
        this.connectionManager.emitEngineEvent(engineId, connection.url, envelope);
      });
      this.subscriptions.set(engineId, subscription);
      this.failedEngines.delete(engineId);
    } catch {
      if (!this.failedEngines.has(engineId)) {
        console.warn(
          `[engine-core] WebSocket connection failed for ${connection.url}. ` +
            'Real-time engine events will not be available. REST API is unaffected.',
        );
        this.failedEngines.add(engineId);
      }
      connection.client.notifications.disconnect();
    }
  }

  /**
   * Registers socket lifecycle callbacks on the engine's NotificationClient.
   * These fire on raw socket open/close/error and drive the connection manager's
   * state transitions without REST polling.
   */
  private attachLifecycleCallbacks(engineId: string, client: DaemonEngineClient): void {
    this.disposeLifecycleCallbacks(engineId);

    const disposables: Subscription[] = [];

    disposables.push(
      client.notifications.onSocketOpen(() => {
        this.connectionManager.handleSocketOpen(engineId);
      }),
    );

    disposables.push(
      client.notifications.onSocketClose(() => {
        if (!this.connectionManager.getConnection(engineId)) {
          return;
        }
        this.connectionManager.handleSocketClose(engineId);
      }),
    );

    disposables.push(
      client.notifications.onSocketError(() => {
        const connection = this.connectionManager.getConnection(engineId);
        if (connection) {
          console.warn(`[engine-core] Socket error for engine ${connection.url}`);
        }
      }),
    );

    this.lifecycleSubscriptions.set(engineId, disposables);
  }

  private disposeLifecycleCallbacks(engineId: string): void {
    const disposables = this.lifecycleSubscriptions.get(engineId);
    if (disposables) {
      for (const subscription of disposables) {
        subscription.dispose();
      }
      this.lifecycleSubscriptions.delete(engineId);
    }
  }

  private reconnectEngine(engineId: string): void {
    this.unsubscribeEngine(engineId);
    const connection = this.connectionManager.getConnection(engineId);
    if (connection && connection.state === 'connected') {
      connection.client.notifications.disconnect();
      void this.subscribeEngine(engineId);
    }
  }

  private unsubscribeEngine(engineId: string): void {
    const subscription = this.subscriptions.get(engineId);
    if (subscription) {
      subscription.dispose();
      this.subscriptions.delete(engineId);
    }
    this.disposeLifecycleCallbacks(engineId);
    this.failedEngines.delete(engineId);
  }

  dispose(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.dispose();
    }
    this.subscriptions.clear();
    for (const disposables of this.lifecycleSubscriptions.values()) {
      for (const subscription of disposables) {
        subscription.dispose();
      }
    }
    this.lifecycleSubscriptions.clear();
    this.failedEngines.clear();
  }
}
