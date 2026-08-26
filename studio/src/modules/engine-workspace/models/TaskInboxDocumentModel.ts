import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EngineConnectionManager } from '#modules/engine-core';
import { EventDrivenRefresh, SETTINGS_KEYS } from '#modules/engine-core';
import type { DaemonEngineClient } from '@elraptorus/daemonengine_client';
import { FlowNodeInstanceState, FlowNodeType } from '@elraptorus/daemonengine_sdk';
import type {
  FlowNodeInstance,
  FlowNodeInstanceField,
  FlowNodeInstanceFilter,
  OffsetPageInfo,
  SortClause,
} from '@elraptorus/daemonengine_sdk';

import { TASK_INBOX_PENDING_COUNTS_KEY } from '../constants/sharedResourceKeys';

export interface TaskInboxModelData {
  tasks: FlowNodeInstance[];
  pendingCount: number;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
  pageIndex: number;
  pageCount: number;
  engineIsOnline: boolean;
  connectionGracePeriodExpired: boolean;
}

const TASK_FIELDS: FlowNodeInstanceField[] = [
  'id',
  'processInstanceId',
  'flowNodeId',
  'flowNodeType',
  'state',
  'startedAt',
  'laneName',
  'typeProperties',
];

const CONNECTION_GRACE_PERIOD_MS = 60_000;
const PAGE_SIZE = 50;

export class TaskInboxDocumentModel extends EditorDocumentModel {
  private studio: Bifrost;
  private connectionManager: EngineConnectionManager;
  private client: DaemonEngineClient | null;
  private engineId: string;
  private selectedTask: FlowNodeInstance | null = null;
  private selectionRevision = 0;
  private selectedTaskIds = new Set<string>();
  private flowNodeIdFilter: string | null = null;
  private processInstanceIdFilter: string | null = null;
  private laneNameFilter: string | null = null;
  private startedAtAfter: string | null = null;
  private startedAtBefore: string | null = null;
  private sortClauses: SortClause<FlowNodeInstanceField>[] = [{ field: 'startedAt', direction: 'asc' }];
  private pageIndex = 0;
  private autoRefresh: EventDrivenRefresh | null = null;
  private authTokenSubscription: { dispose: () => void } | null = null;
  private connectionLifecycleSubscriptions: { dispose: () => void }[] = [];
  private connectionGracePeriodTimer: ReturnType<typeof setTimeout> | null = null;
  private filterRevision = 0;

  private tasks: FlowNodeInstance[] = [];
  private pendingCount = 0;
  private loading = true;
  private error: string | null = null;
  private lastUpdated: Date | null = null;
  private hasNextPage = false;
  private hasPreviousPage = false;
  private totalCount = 0;
  private pageCount = 1;
  private engineIsOnline = true;
  private connectionGracePeriodExpired = false;
  private dataRevision = 0;

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
  ): Promise<TaskInboxDocumentModel> {
    return new TaskInboxDocumentModel(uri, studio);
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
      settingsKey: SETTINGS_KEYS.taskInboxAutoRefresh,
      relevantEventTypes: [
        'UserTaskCreated',
        'UserTaskFinished',
        'FlowNodeInstanceStarted',
        'FlowNodeInstanceFinished',
      ],
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

  getTasks(): FlowNodeInstance[] {
    return this.tasks;
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

  getHasNextPage(): boolean {
    return this.hasNextPage;
  }

  getHasPreviousPage(): boolean {
    return this.hasPreviousPage;
  }

  getTotalCount(): number {
    return this.totalCount;
  }

  getPageCount(): number {
    return this.pageCount;
  }

  isEngineOnline(): boolean {
    return this.engineIsOnline;
  }

  isConnectionGracePeriodExpired(): boolean {
    return this.connectionGracePeriodExpired;
  }

  private publishDataRevision(): void {
    this.dataRevision++;
    this.updateMetadata({ dataRevision: this.dataRevision });
  }

  private refreshLabel(): void {
    const connection = this.connectionManager.getConnection(this.engineId);
    const name = connection?.displayName || connection?.url || this.engineId;
    this.updateLabel(`Task Inbox: ${name}`);
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

  getFlowNodeIdFilter(): string | null {
    return this.flowNodeIdFilter;
  }

  setFlowNodeIdFilter(value: string | null): void {
    this.flowNodeIdFilter = value;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  getProcessInstanceIdFilter(): string | null {
    return this.processInstanceIdFilter;
  }

  setProcessInstanceIdFilter(value: string | null): void {
    this.processInstanceIdFilter = value;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  getLaneNameFilter(): string | null {
    return this.laneNameFilter;
  }

  setLaneNameFilter(value: string | null): void {
    this.laneNameFilter = value;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  getStartedAtFilter(): { after: string | null; before: string | null } {
    return { after: this.startedAtAfter, before: this.startedAtBefore };
  }

  setStartedAtFilter(after: string | null, before: string | null): void {
    this.startedAtAfter = after;
    this.startedAtBefore = before;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  applyColumnFilter(columnId: string, value: string): void {
    if (columnId === 'flowNodeId') {
      this.setFlowNodeIdFilter(value);
    } else if (columnId === 'processInstanceId') {
      this.setProcessInstanceIdFilter(value);
    } else if (columnId === 'laneName') {
      this.setLaneNameFilter(value);
    }
  }

  private publishFilterState(): void {
    this.filterRevision++;
    this.updateMetadata({ filterRevision: this.filterRevision });
  }

  getSortClauses(): SortClause<FlowNodeInstanceField>[] {
    return this.sortClauses;
  }

  setSortClauses(clauses: SortClause<FlowNodeInstanceField>[]): void {
    this.sortClauses = clauses.length > 0 ? clauses : [{ field: 'startedAt', direction: 'asc' }];
    this.resetPagination();
    void this.refresh();
  }

  getPageIndex(): number {
    return this.pageIndex;
  }

  getPageSize(): number {
    return PAGE_SIZE;
  }

  goToNextPage(): void {
    if (!this.hasNextPage) {
      return;
    }
    this.pageIndex++;
    void this.fetchPage();
  }

  goToPreviousPage(): void {
    if (this.pageIndex <= 0) {
      return;
    }
    this.pageIndex--;
    void this.fetchPage();
  }

  goToPage(index: number): void {
    if (index < 0) {
      return;
    }
    this.pageIndex = index;
    void this.fetchPage();
  }

  private resetPagination(): void {
    this.pageIndex = 0;
  }

  async refresh(): Promise<void> {
    this.resetPagination();
    await this.fetchPage();
  }

  private async fetchPage(): Promise<void> {
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
      const connection = this.connectionManager.getConnection(this.engineId);
      const lanes = connection ? this.connectionManager.identity.getLanes(connection.url) : [];

      const filter = this.buildFilter(lanes);

      const pagination = { mode: 'offset' as const, limit: PAGE_SIZE, offset: this.pageIndex * PAGE_SIZE };

      const result = await this.client.graphql.queryFlowNodeInstances({
        fields: TASK_FIELDS,
        filter,
        pagination,
        sort: this.sortClauses,
      });

      const pageInfo = result.pageInfo as OffsetPageInfo;
      const fetchedTasks = result.data as FlowNodeInstance[];
      const fetchedPendingCount = pageInfo.totalCount ?? fetchedTasks.length;

      this.updatePendingCount(fetchedPendingCount);
      this.tasks = fetchedTasks;
      this.pendingCount = fetchedPendingCount;
      this.loading = false;
      this.error = null;
      this.lastUpdated = new Date();
      this.hasNextPage = pageInfo.hasNextPage ?? false;
      this.hasPreviousPage = pageInfo.hasPreviousPage ?? false;
      this.totalCount = pageInfo.totalCount ?? 0;
      this.pageCount = pageInfo.lastPage ?? 1;
      this.publishDataRevision();
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      this.loading = false;
      this.error = message;
      this.publishDataRevision();
    }
  }

  private buildFilter(lanes: string[]): FlowNodeInstanceFilter {
    const filter: FlowNodeInstanceFilter = {
      state: { eq: FlowNodeInstanceState.Waiting as string },
      flowNodeType: { eq: FlowNodeType.UserTask as string },
    };

    if (lanes.length > 0 && !this.laneNameFilter) {
      filter.laneName = { in: lanes };
    }

    if (this.flowNodeIdFilter) {
      filter.flowNodeId = { ilike: `%${this.flowNodeIdFilter}%` };
    }
    if (this.processInstanceIdFilter) {
      filter.processInstanceId = { ilike: `%${this.processInstanceIdFilter}%` };
    }
    if (this.laneNameFilter) {
      filter.laneName = { ilike: `%${this.laneNameFilter}%` };
    }
    if (this.startedAtAfter || this.startedAtBefore) {
      const startedAtFilter: Record<string, string> = {};
      if (this.startedAtAfter) {
        startedAtFilter.greaterThanOrEqual = new Date(this.startedAtAfter).toISOString();
      }
      if (this.startedAtBefore) {
        startedAtFilter.lessThanOrEqual = new Date(this.startedAtBefore).toISOString();
      }
      filter.startedAt = startedAtFilter;
    }
    return filter;
  }

  selectTask(task: FlowNodeInstance | null): void {
    if (task?.id === this.selectedTask?.id) {
      this.selectedTask = null;
    } else {
      this.selectedTask = task;
    }
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  clearSelection(): void {
    this.selectedTask = null;
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  getSelectedTask(): FlowNodeInstance | null {
    return this.selectedTask;
  }

  getSelectedTaskId(): string | null {
    return this.selectedTask?.id ?? null;
  }

  getPendingCount(): number {
    return this.pendingCount;
  }

  setSelectedTaskIds(taskIds: string[]): void {
    this.selectedTaskIds = new Set(taskIds);
  }

  getSelectedTaskIds(): string[] {
    return [...this.selectedTaskIds];
  }

  getSelectedTasks(): FlowNodeInstance[] {
    return this.tasks.filter((task) => this.selectedTaskIds.has(task.id));
  }

  async bulkCompleteSelected(result?: Record<string, unknown>): Promise<void> {
    const selected = this.getSelectedTasks();
    if (selected.length === 0 || !this.client) {
      return;
    }
    for (const task of selected) {
      await this.client.userTasks.finish(task.id, { result });
    }
    this.selectedTaskIds.clear();
    await this.refresh();
  }

  async completeSelectedTask(result?: Record<string, unknown>): Promise<void> {
    if (!this.selectedTask || !this.client) {
      return;
    }
    await this.client.userTasks.finish(this.selectedTask.id, { result });
    this.clearSelection();
    await this.refresh();
  }

  private updatePendingCount(count: number): void {
    let counts: Record<string, number>;
    try {
      counts = this.studio.getSharedRessource<Record<string, number>>(TASK_INBOX_PENDING_COUNTS_KEY) ?? {};
    } catch (sharedResourceError) {
      console.warn('[TaskInbox] Failed to read pending counts from shared resource:', sharedResourceError);
      counts = {};
    }
    counts[this.engineId] = count;
    this.studio.registerSharedRessource(TASK_INBOX_PENDING_COUNTS_KEY, counts, true);
  }
}

function extractEngineId(uri: string): string {
  const match = uri.match(/engine-task-inbox:\/\/([^?]+)/);
  return match?.[1] ?? '';
}
