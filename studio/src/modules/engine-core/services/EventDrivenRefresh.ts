import type { Bifrost } from '#bifrost/Bifrost';

import type { EngineConnectionManager } from '../EngineConnectionManager';
import { AUTO_REFRESH_INTERVALS } from '../types';
import type { AutoRefreshInterval } from '../types';

export class EventDrivenRefresh {
  private connectionManager: EngineConnectionManager;
  private studio: Bifrost;
  private settingsKey: string;
  private relevantEventTypes: string[];
  private onRefresh: () => void;
  private cooldownTimerId: ReturnType<typeof setTimeout> | null = null;
  private cooldownActive = false;
  private dirtyDuringCooldown = false;
  private active = false;
  private eventHandler: ((payload: any) => void) | null = null;
  private eventSubscription: { dispose(): void } | null = null;
  private settingsSubscription: { dispose(): void } | null = null;

  private engineId: string | undefined;

  constructor(options: {
    connectionManager: EngineConnectionManager;
    studio: Bifrost;
    settingsKey: string;
    relevantEventTypes: string[];
    onRefresh: () => void;
    engineId?: string;
  }) {
    this.connectionManager = options.connectionManager;
    this.studio = options.studio;
    this.settingsKey = options.settingsKey;
    this.relevantEventTypes = options.relevantEventTypes;
    this.onRefresh = options.onRefresh;
    this.engineId = options.engineId;

    this.settingsSubscription = this.studio.events.on('settingsUpdate', (name: string) => {
      if (name === this.settingsKey) {
        this.cancelPendingCooldown();
      }
    });
  }

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;

    this.eventHandler = (payload: any) => {
      if (this.engineId && payload?.engineId !== this.engineId) {
        return;
      }
      const eventType: string | undefined = payload?.type;
      if (!eventType || !this.relevantEventTypes.includes(eventType)) {
        return;
      }
      this.scheduleRefresh();
    };

    this.eventSubscription = this.connectionManager.on('engine:event', this.eventHandler);
  }

  startWithCatchUp(): void {
    this.start();
    const interval = this.getInterval();
    const cooldownMs = AUTO_REFRESH_INTERVALS[interval];
    if (cooldownMs > 0) {
      this.scheduleRefresh();
    }
  }

  stop(): void {
    this.active = false;
    this.cancelPendingCooldown();
    this.eventSubscription?.dispose();
    this.eventSubscription = null;
    this.eventHandler = null;
  }

  dispose(): void {
    this.stop();
    this.settingsSubscription?.dispose();
    this.settingsSubscription = null;
  }

  private scheduleRefresh(): void {
    const interval = this.getInterval();
    const cooldownMs = AUTO_REFRESH_INTERVALS[interval];
    if (cooldownMs <= 0) {
      return;
    }

    if (this.cooldownActive) {
      this.dirtyDuringCooldown = true;
      return;
    }

    this.onRefresh();

    this.cooldownActive = true;
    this.dirtyDuringCooldown = false;
    this.cooldownTimerId = setTimeout(() => {
      this.cooldownTimerId = null;
      this.cooldownActive = false;

      if (this.dirtyDuringCooldown) {
        this.dirtyDuringCooldown = false;
        this.scheduleRefresh();
      }
    }, cooldownMs);
  }

  private cancelPendingCooldown(): void {
    if (this.cooldownTimerId != null) {
      clearTimeout(this.cooldownTimerId);
      this.cooldownTimerId = null;
    }
    this.cooldownActive = false;
    this.dirtyDuringCooldown = false;
  }

  private getInterval(): AutoRefreshInterval {
    return this.studio.settings.get(this.settingsKey) ?? '30s';
  }
}
