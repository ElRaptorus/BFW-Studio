import type { Bifrost } from '#bifrost/Bifrost';
import { DaemonEngineClient } from '@elraptorus/daemonengine_client';
import type { EngineInfoResponse } from '@elraptorus/daemonengine_sdk';

import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import { JwtIdentityManager } from './JwtIdentityManager';
import { SETTINGS_KEYS } from './settings/registerSettings';
import type {
  EngineConnection,
  EngineConnectionConfig,
  EngineConnectionState,
  EngineManagerEvent,
  EngineManagerEventType,
} from './types';

const RECONNECT_BASE_DELAY = 2_000;
const RECONNECT_MAX_DELAY = 60_000;

interface ManagedEngine {
  engineId: string;
  url: string;
  displayName: string;
  state: EngineConnectionState;
  client: DaemonEngineClient;
  info: EngineInfoResponse | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
}

export type HealthOverrideLevel = 'elevated' | 'critical' | null;

export class EngineConnectionManager extends AbstractEmitter {
  private readonly bifrost: Bifrost;
  readonly identity: JwtIdentityManager;
  private readonly engines = new Map<string, ManagedEngine>();
  private readonly healthOverrides = new Map<string, HealthOverrideLevel>();

  constructor(bifrost: Bifrost) {
    super();
    this.bifrost = bifrost;
    this.identity = new JwtIdentityManager(bifrost);
    this.restorePersistedConnections();
  }

  async connect(config: EngineConnectionConfig): Promise<EngineConnection> {
    const url = normalizeUrl(config.url);
    const existingEngine = this.findByUrl(url);

    if (existingEngine && existingEngine.state === 'connected') {
      return this.toPublicConnection(existingEngine);
    }

    const engineId = existingEngine?.engineId ?? config.engineId ?? generateEngineId();
    const displayName = config.displayName ?? url;

    const client = new DaemonEngineClient(url, this.identity.createTokenFactory(url));

    const managed: ManagedEngine = {
      engineId,
      url,
      displayName,
      state: 'connecting',
      client,
      info: null,
      reconnectTimer: null,
      reconnectAttempts: 0,
    };

    this.engines.set(engineId, managed);
    this.emitEvent('engine:state-changed', managed);

    try {
      const info = await client.engine.info();
      managed.info = info;
      managed.displayName = config.displayName ?? info.engineName ?? url;
      managed.state = 'connected';
      managed.reconnectAttempts = 0;

      this.persistConnectionList();
      this.updateInfoCache(managed);
      this.addToUrlHistory(url);

      this.emitEvent('engine:connected', managed);
      this.emitEvent('engine:list-changed', managed);

      return this.toPublicConnection(managed);
    } catch {
      managed.state = 'error';
      this.emitEvent('engine:state-changed', managed);
      this.scheduleReconnect(managed);
      return this.toPublicConnection(managed);
    }
  }

  disconnect(engineId: string): void {
    const managed = this.engines.get(engineId);
    if (!managed) {
      return;
    }

    this.cancelReconnect(managed);

    try {
      managed.client.dispose();
    } catch {
      // best-effort cleanup
    }

    this.engines.delete(engineId);
    this.persistConnectionList();
    this.emitEvent('engine:disconnected', managed);
    this.emitEvent('engine:list-changed', managed);
  }

  disconnectByUrl(url: string): void {
    const managed = this.findByUrl(normalizeUrl(url));
    if (managed) {
      this.disconnect(managed.engineId);
    }
  }

  getConnection(engineId: string): EngineConnection | null {
    const managed = this.engines.get(engineId);
    return managed ? this.toPublicConnection(managed) : null;
  }

  getConnectionByUrl(url: string): EngineConnection | null {
    const managed = this.findByUrl(normalizeUrl(url));
    return managed ? this.toPublicConnection(managed) : null;
  }

  getConnectedEngines(): EngineConnection[] {
    return Array.from(this.engines.values())
      .filter((engine) => engine.state === 'connected')
      .map((engine) => this.toPublicConnection(engine));
  }

  getAllEngines(): EngineConnection[] {
    return Array.from(this.engines.values()).map((engine) => this.toPublicConnection(engine));
  }

  getClient(engineId: string): DaemonEngineClient | null {
    return this.engines.get(engineId)?.client ?? null;
  }

  getClientByUrl(url: string): DaemonEngineClient | null {
    const managed = this.findByUrl(normalizeUrl(url));
    return managed?.client ?? null;
  }

  isConnected(engineId: string): boolean {
    return this.engines.get(engineId)?.state === 'connected';
  }

  getUrlHistory(): string[] {
    return this.bifrost.settings.get(SETTINGS_KEYS.urlHistory) ?? [];
  }

  removeFromHistory(url: string): void {
    const normalized = normalizeUrl(url);
    const managed = this.findByUrl(normalized);
    if (managed) {
      this.disconnect(managed.engineId);
    }

    const history: string[] = this.getUrlHistory();
    const filtered = history.filter((entry) => normalizeUrl(entry) !== normalized);
    this.bifrost.settings.set(SETTINGS_KEYS.urlHistory, filtered);

    const cache: Record<string, unknown> = this.bifrost.settings.get(SETTINGS_KEYS.infoCache) ?? {};
    delete cache[normalized];
    this.bifrost.settings.set(SETTINGS_KEYS.infoCache, cache);

    this.emit('engine:list-changed', [
      { type: 'engine:list-changed' as EngineManagerEventType, engineId: '', url: normalized },
    ]);
  }

  getActiveEngineId(): string | null {
    const activeId: string = this.bifrost.settings.get(SETTINGS_KEYS.activeEngine) ?? '';
    if (activeId && this.engines.has(activeId)) {
      return activeId;
    }
    const first = this.engines.values().next();
    return first.done ? null : first.value.engineId;
  }

  setActiveEngine(engineId: string): void {
    if (!this.engines.has(engineId)) {
      return;
    }
    this.bifrost.settings.set(SETTINGS_KEYS.activeEngine, engineId);
  }

  getLastDeployTargetUrl(): string {
    return this.bifrost.settings.get(SETTINGS_KEYS.lastDeployTarget) ?? '';
  }

  setLastDeployTargetUrl(url: string): void {
    this.bifrost.settings.set(SETTINGS_KEYS.lastDeployTarget, url);
  }

  setAuthToken(engineUrl: string, token?: string): void {
    this.identity.setToken(engineUrl, token);
    const managed = this.findByUrl(normalizeUrl(engineUrl));
    if (managed) {
      this.emit('engine:auth-token-changed', [
        {
          type: 'engine:auth-token-changed' as EngineManagerEventType,
          engineId: managed.engineId,
          url: managed.url,
        },
      ]);
    }
  }

  getHealthOverride(engineId: string): HealthOverrideLevel {
    return this.healthOverrides.get(engineId) ?? null;
  }

  setHealthOverride(engineId: string, level: HealthOverrideLevel): void {
    this.healthOverrides.set(engineId, level);
    const managed = this.engines.get(engineId);
    if (managed) {
      this.emitEvent('engine:state-changed', managed);
    }
  }

  getCachedInfo(url: string): EngineInfoResponse | null {
    const cache: Record<string, EngineInfoResponse> = this.bifrost.settings.get(SETTINGS_KEYS.infoCache) ?? {};
    return cache[normalizeUrl(url)] ?? null;
  }

  dispose(): void {
    for (const managed of this.engines.values()) {
      this.cancelReconnect(managed);
      try {
        managed.client.dispose();
      } catch {
        // best-effort
      }
    }
    this.engines.clear();
  }

  private findByUrl(normalizedUrl: string): ManagedEngine | undefined {
    for (const engine of this.engines.values()) {
      if (engine.url === normalizedUrl) {
        return engine;
      }
    }
    return undefined;
  }

  private toPublicConnection(managed: ManagedEngine): EngineConnection {
    return {
      engineId: managed.engineId,
      url: managed.url,
      displayName: managed.displayName,
      state: managed.state,
      info: managed.info,
      client: managed.client,
    };
  }

  private scheduleReconnect(managed: ManagedEngine): void {
    this.cancelReconnect(managed);
    const delay = Math.min(RECONNECT_BASE_DELAY * 2 ** managed.reconnectAttempts, RECONNECT_MAX_DELAY);
    managed.reconnectAttempts++;

    managed.reconnectTimer = setTimeout(async () => {
      try {
        const info = await managed.client.engine.info();
        managed.info = info;
        managed.state = 'connected';
        managed.reconnectAttempts = 0;
        this.updateInfoCache(managed);
        this.emitEvent('engine:reconnected', managed);
      } catch {
        this.scheduleReconnect(managed);
      }
    }, delay);
  }

  private cancelReconnect(managed: ManagedEngine): void {
    if (managed.reconnectTimer) {
      clearTimeout(managed.reconnectTimer);
      managed.reconnectTimer = null;
    }
  }

  private async refreshEngineInfo(managed: ManagedEngine): Promise<void> {
    try {
      const info = await managed.client.engine.info();
      managed.info = info;
      this.updateInfoCache(managed);
    } catch {
      // Non-critical — the connection is already marked as connected
    }
  }

  private persistConnectionList(): void {
    const configs = Array.from(this.engines.values()).map((engine) => ({
      url: engine.url,
      displayName: engine.displayName,
      engineId: engine.engineId,
    }));
    this.bifrost.settings.set(SETTINGS_KEYS.connectedEngines, configs);
  }

  private updateInfoCache(managed: ManagedEngine): void {
    if (!managed.info) {
      return;
    }
    const cache: Record<string, EngineInfoResponse> = this.bifrost.settings.get(SETTINGS_KEYS.infoCache) ?? {};
    cache[managed.url] = managed.info;
    this.bifrost.settings.set(SETTINGS_KEYS.infoCache, cache);
    this.emitEvent('engine:info-updated', managed);
  }

  private addToUrlHistory(url: string): void {
    const history: string[] = this.getUrlHistory();
    if (!history.includes(url)) {
      this.bifrost.settings.set(SETTINGS_KEYS.urlHistory, [...history, url]);
    }
  }

  private restorePersistedConnections(): void {
    const configs: { url: string; displayName?: string; engineId?: string }[] =
      this.bifrost.settings.get(SETTINGS_KEYS.connectedEngines) ?? [];

    for (const config of configs) {
      if (!config.url) {
        continue;
      }
      this.connect({ url: config.url, displayName: config.displayName, engineId: config.engineId }).catch(() => {
        // Silent reconnect failure — health polling will retry
      });
    }
  }

  /**
   * Called by WebSocketBridge when the Phoenix Socket opens.
   * If the engine was in a reconnecting/error state, this means the
   * connection has been restored — emit engine:reconnected.
   */
  handleSocketOpen(engineId: string): void {
    const managed = this.engines.get(engineId);
    if (!managed) {
      return;
    }
    if (managed.state === 'reconnecting' || managed.state === 'error') {
      managed.state = 'connected';
      managed.reconnectAttempts = 0;
      this.cancelReconnect(managed);
      void this.refreshEngineInfo(managed);
      this.emitEvent('engine:reconnected', managed);
    }
  }

  /**
   * Called by WebSocketBridge when the Phoenix Socket closes.
   * If the engine was connected (not manually disconnected), transition
   * to reconnecting state and start the reconnect timer.
   */
  handleSocketClose(engineId: string): void {
    const managed = this.engines.get(engineId);
    if (!managed) {
      return;
    }
    if (managed.state === 'connected') {
      managed.state = 'reconnecting';
      this.emitEvent('engine:connection-lost', managed);
      this.scheduleReconnect(managed);
    }
  }

  /**
   * Emits an engine WebSocket event. Called by WebSocketBridge to forward
   * real-time events from connected engines through the shared emitter.
   */
  emitEngineEvent(engineId: string, engineUrl: string, envelope: unknown): void {
    this.emit('engine:event', [{ engineId, engineUrl, ...(envelope as Record<string, unknown>) }]);
  }

  private emitEvent(type: EngineManagerEventType, managed: ManagedEngine): void {
    const event: EngineManagerEvent = {
      type,
      engineId: managed.engineId,
      url: managed.url,
    };
    this.emit(type, [event]);
    this.emitEvent_stateChanged(managed);
  }

  private emitEvent_stateChanged(managed: ManagedEngine): void {
    if (managed.state !== 'connecting') {
      this.emit('engine:state-changed', [
        {
          type: 'engine:state-changed' as const,
          engineId: managed.engineId,
          url: managed.url,
        },
      ]);
    }
  }
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').trim();
}

function generateEngineId(): string {
  return `engine-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
