import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EngineConnectionManager } from '#modules/engine-core';
import { EventDrivenRefresh, SETTINGS_KEYS } from '#modules/engine-core';
import type { DaemonEngineClient } from '@elraptorus/daemonengine_client';

import type { TimerSchedule } from '../helpers/engineApi';
import { fetchTimerSchedules } from '../helpers/engineApi';

const CONNECTION_GRACE_PERIOD_MS = 60_000;

export class TimerSchedulesDocumentModel extends EditorDocumentModel {
  private studio: Bifrost;
  private connectionManager: EngineConnectionManager;
  private client: DaemonEngineClient | null;
  private engineId: string;
  private selectedSchedule: TimerSchedule | null = null;
  private selectionRevision = 0;
  private selectedScheduleIds = new Set<string>();
  private autoRefresh: EventDrivenRefresh | null = null;
  private authTokenSubscription: { dispose: () => void } | null = null;
  private connectionLifecycleSubscriptions: { dispose: () => void }[] = [];
  private connectionGracePeriodTimer: ReturnType<typeof setTimeout> | null = null;

  private schedules: TimerSchedule[] = [];
  private loading = true;
  private error: string | null = null;
  private lastUpdated: Date | null = null;
  private engineIsOnline = true;
  private connectionGracePeriodExpired = false;
  private dataRevision = 0;
  private appliedFilter: { columnId: string; value: string } | null = null;
  private filterRevision = 0;

  private constructor(uri: string, studio: Bifrost) {
    super(uri);
    this.studio = studio;
    this.connectionManager = studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
    this.engineId = extractEngineId(uri);
    this.client = this.connectionManager.getClient(this.engineId);
  }

  static async create(
    uri: string,
    _restoredCurrentData: any,
    _restoredMetadata: any,
    _fileLoader: any,
    studio: Bifrost,
  ): Promise<TimerSchedulesDocumentModel> {
    return new TimerSchedulesDocumentModel(uri, studio);
  }

  onEditorDocumentModelDidRegister(): void {
    this.engineIsOnline = this.connectionManager.isConnected(this.engineId);
    this.publishDataRevision();
    this.refreshLabel();

    if (this.engineIsOnline) {
      void this.refresh();
    } else {
      this.startGraceTimerForReconnecting();
    }

    this.autoRefresh = new EventDrivenRefresh({
      connectionManager: this.connectionManager,
      studio: this.studio,
      settingsKey: SETTINGS_KEYS.timerSchedulesAutoRefresh,
      relevantEventTypes: ['ProcessInstanceStateChanged'],
      onRefresh: () => void this.refresh(),
      engineId: this.engineId,
    });
    this.autoRefresh.start();

    this.authTokenSubscription = this.connectionManager.on(
      'engine:auth-token-changed',
      (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          void this.refresh();
        }
      },
    );

    this.subscribeToConnectionLifecycle();
  }

  onEditorDocumentDidFocus(): void {
    this.client = this.connectionManager.getClient(this.engineId);
    this.autoRefresh?.startWithCatchUp();
  }

  onEditorDocumentDidBlur(): void {
    this.autoRefresh?.stop();
  }

  onEditorDocumentWillClose(): void {
    this.autoRefresh?.dispose();
    this.autoRefresh = null;
    this.authTokenSubscription?.dispose();
    this.authTokenSubscription = null;
    for (const subscription of this.connectionLifecycleSubscriptions) {
      subscription.dispose();
    }
    this.connectionLifecycleSubscriptions = [];
    this.stopGraceTimer();
  }

  protected updateCurrentData(data: any): void {
    super.updateOriginalAndCurrentData(data, data);
  }

  getEngineId(): string {
    return this.engineId;
  }

  getSchedules(): TimerSchedule[] {
    return this.schedules;
  }

  isLoading(): boolean {
    return this.loading;
  }

  getError(): string | null {
    return this.error;
  }

  getLastUpdated(): Date | null {
    return this.lastUpdated;
  }

  isEngineOnline(): boolean {
    return this.engineIsOnline;
  }

  isConnectionGracePeriodExpired(): boolean {
    return this.connectionGracePeriodExpired;
  }

  getAppliedFilter(): { columnId: string; value: string } | null {
    return this.appliedFilter;
  }

  private publishDataRevision(): void {
    this.dataRevision++;
    this.updateMetadata({ dataRevision: this.dataRevision });
  }

  private refreshLabel(): void {
    const connection = this.connectionManager.getConnection(this.engineId);
    const name = connection?.displayName || connection?.url || this.engineId;
    this.updateLabel(`Timers: ${name}`);
  }

  private subscribeToConnectionLifecycle(): void {
    this.connectionLifecycleSubscriptions.push(
      this.connectionManager.on('engine:connected', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          this.stopGraceTimer();
          this.applyOnlineState();
          this.refreshLabel();
          void this.refresh();
        }
      }),
      this.connectionManager.on('engine:reconnected', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          this.stopGraceTimer();
          this.applyOnlineState();
          this.refreshLabel();
          void this.refresh();
        }
      }),
      this.connectionManager.on('engine:connection-lost', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          this.applyOfflineState();
          this.startGraceTimerForReconnecting();
        }
      }),
    );
  }

  private applyOnlineState(): void {
    this.engineIsOnline = true;
    this.connectionGracePeriodExpired = false;
    this.publishDataRevision();
  }

  private applyOfflineState(): void {
    this.engineIsOnline = false;
    this.connectionGracePeriodExpired = false;
    this.publishDataRevision();
  }

  private startGraceTimerForReconnecting(): void {
    this.stopGraceTimer();
    this.connectionGracePeriodTimer = setTimeout(() => {
      this.connectionGracePeriodExpired = true;
      this.publishDataRevision();
    }, CONNECTION_GRACE_PERIOD_MS);
  }

  private stopGraceTimer(): void {
    if (this.connectionGracePeriodTimer !== null) {
      clearTimeout(this.connectionGracePeriodTimer);
      this.connectionGracePeriodTimer = null;
    }
  }

  async refresh(): Promise<void> {
    this.client = this.connectionManager.getClient(this.engineId);

    if (!this.client) {
      this.loading = false;
      this.error = 'Not connected';
      this.publishDataRevision();
      return;
    }

    this.loading = true;
    this.error = null;
    this.publishDataRevision();

    try {
      const schedules = await fetchTimerSchedules(this.connectionManager, this.engineId);
      this.schedules = schedules;
      this.loading = false;
      this.error = null;
      this.lastUpdated = new Date();
      this.publishDataRevision();
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      this.loading = false;
      this.error = message;
      this.publishDataRevision();
    }
  }

  selectSchedule(schedule: TimerSchedule | null): void {
    if (schedule?.id === this.selectedSchedule?.id) {
      this.selectedSchedule = null;
    } else {
      this.selectedSchedule = schedule;
    }
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  clearSelection(): void {
    this.selectedSchedule = null;
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  getSelectedSchedule(): TimerSchedule | null {
    return this.selectedSchedule;
  }

  getSelectedScheduleId(): string | null {
    return this.selectedSchedule?.id ?? null;
  }

  setSelectedScheduleIds(scheduleIds: string[]): void {
    this.selectedScheduleIds = new Set(scheduleIds);
  }

  getSelectedScheduleIds(): string[] {
    return [...this.selectedScheduleIds];
  }

  getSelectedSchedules(): TimerSchedule[] {
    return this.schedules.filter((schedule) => this.selectedScheduleIds.has(schedule.id));
  }

  async bulkToggleSelected(enabled: boolean): Promise<void> {
    const selected = this.getSelectedSchedules();
    if (selected.length === 0) {
      return;
    }
    if (enabled) {
      const { enableTimerSchedule } = await import('../helpers/engineApi');
      for (const schedule of selected) {
        await enableTimerSchedule(this.connectionManager, this.engineId, schedule.id);
      }
    } else {
      const { disableTimerSchedule } = await import('../helpers/engineApi');
      for (const schedule of selected) {
        await disableTimerSchedule(this.connectionManager, this.engineId, schedule.id);
      }
    }
    await this.refresh();
  }

  applyColumnFilter(columnId: string, value: string): void {
    this.appliedFilter = { columnId, value };
    this.filterRevision++;
    this.updateMetadata({ filterRevision: this.filterRevision });
  }

  async toggleSelectedSchedule(enabled: boolean): Promise<void> {
    if (!this.selectedSchedule) {
      return;
    }
    if (enabled) {
      const { enableTimerSchedule } = await import('../helpers/engineApi');
      await enableTimerSchedule(this.connectionManager, this.engineId, this.selectedSchedule.id);
    } else {
      const { disableTimerSchedule } = await import('../helpers/engineApi');
      await disableTimerSchedule(this.connectionManager, this.engineId, this.selectedSchedule.id);
    }
    await this.refresh();
  }
}

function extractEngineId(uri: string): string {
  const match = uri.match(/engine:\/\/timers\/([^?]+)/);
  return match?.[1] ?? '';
}
