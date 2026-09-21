import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EngineConnectionManager } from '#modules/engine-core';
import { ENGINE_COMMANDS, EventDrivenRefresh, SETTINGS_KEYS } from '#modules/engine-core';

import type { BfwEngineClient } from '@elraptorus/bfw_engine_client';
import type {
  OffsetPageInfo,
  ProcessInstance,
  ProcessInstanceField,
  ProcessInstanceFilter,
  RetryRequest,
  SortClause,
} from '@elraptorus/bfw_engine_sdk';

import { parseEngineUri } from '../helpers/parseEngineUri';

const CONNECTION_GRACE_PERIOD_MS = 60_000;
const PAGE_SIZE = 50;

export interface InstanceSearchModelData {
  instances: ProcessInstance[];
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

const INSTANCE_FIELDS = [
  'id',
  'processVersionId',
  'state',
  'startedAt',
  'finishedAt',
  'parentProcessInstanceId',
  'businessKey',
  'startedBy',
  'errorInfo',
] as ProcessInstanceField[];

export class InstanceSearchDocumentModel extends EditorDocumentModel {
  private studio: Bifrost;
  private connectionManager: EngineConnectionManager;
  private client: BfwEngineClient | null;
  private versionToModelIdCache = new Map<string, string>();
  private versionToVersionStringCache = new Map<string, string>();
  private engineId: string;
  private selectedInstance: ProcessInstance | null = null;
  private selectionRevision = 0;
  private selectedInstanceIds = new Set<string>();
  private idFilter: string | null = null;
  private processModelIdFilter: string | null = null;
  private versionFilter: string | null = null;
  private stateFilter: ProcessInstance['state'][] = [];
  private businessKeyFilter: string | null = null;
  private startedAtAfter: string | null = null;
  private startedAtBefore: string | null = null;
  private processVersionIdsForFilter: string[] | null = null;
  private sortClauses: SortClause<ProcessInstanceField>[] = [{ field: 'startedAt', direction: 'desc' }];
  private pageIndex = 0;
  private autoRefresh: EventDrivenRefresh | null = null;
  private authTokenSubscription: { dispose: () => void } | null = null;
  private connectionLifecycleSubscriptions: { dispose: () => void }[] = [];
  private connectionGracePeriodTimer: ReturnType<typeof setTimeout> | null = null;
  private filterRevision = 0;
  private fetchSequence = 0;

  private instances: ProcessInstance[] = [];
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
    const parsed = parseEngineUri(uri, /^engine:\/\/instances\/([^?]+)/);
    this.engineId = parsed.engineId;
    this.client = this.connectionManager.getClient(this.engineId);
  }

  static async create(
    uri: string,
    _restoredCurrentData: any,
    _restoredMetadata: any,
    _fileLoader: any,
    studio: Bifrost,
  ): Promise<InstanceSearchDocumentModel> {
    return new InstanceSearchDocumentModel(uri, studio);
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
      settingsKey: SETTINGS_KEYS.instanceSearchAutoRefresh,
      relevantEventTypes: ['ProcessInstanceStateChanged', 'FlowNodeInstanceStarted', 'FlowNodeInstanceFinished'],
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

  getInstances(): ProcessInstance[] {
    return this.instances;
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
    this.updateLabel(`Instances: ${name}`);
  }

  private publishFilterState(): void {
    this.filterRevision++;
    this.updateMetadata({ filterRevision: this.filterRevision });
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

  getIdFilter(): string | null {
    return this.idFilter;
  }

  setIdFilter(value: string | null): void {
    this.idFilter = value;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  getProcessModelIdFilter(): string | null {
    return this.processModelIdFilter;
  }

  getVersionFilter(): string | null {
    return this.versionFilter;
  }

  getStateFilter(): ProcessInstance['state'][] {
    return this.stateFilter;
  }

  setStateFilter(states: ProcessInstance['state'][]): void {
    this.stateFilter = states;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  setProcessModelIdFilter(processModelId: string | null): void {
    this.processModelIdFilter = processModelId;
    this.processVersionIdsForFilter = null;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  setVersionFilter(version: string | null): void {
    this.versionFilter = version;
    this.processVersionIdsForFilter = null;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  getBusinessKeyFilter(): string | null {
    return this.businessKeyFilter;
  }

  setBusinessKeyFilter(value: string | null): void {
    this.businessKeyFilter = value;
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

  getSortClauses(): SortClause<ProcessInstanceField>[] {
    return this.sortClauses;
  }

  setSortClauses(clauses: SortClause<ProcessInstanceField>[]): void {
    this.sortClauses = clauses.length > 0 ? clauses : [{ field: 'startedAt', direction: 'desc' }];
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

  clearAllFilters(): void {
    this.idFilter = null;
    this.processModelIdFilter = null;
    this.versionFilter = null;
    this.stateFilter = [];
    this.businessKeyFilter = null;
    this.startedAtAfter = null;
    this.startedAtBefore = null;
    this.processVersionIdsForFilter = null;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  private resetPagination(): void {
    this.pageIndex = 0;
  }

  async refresh(): Promise<void> {
    this.resetPagination();
    await this.fetchPage();
  }

  private async fetchPage(): Promise<void> {
    const mySequence = ++this.fetchSequence;
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
      await this.resolveProcessVersionFilter();

      if (mySequence !== this.fetchSequence) {
        return;
      }

      const filter = this.buildFilter();
      console.debug('[InstanceSearch] Built PI filter:', JSON.stringify(filter));

      const pagination = { mode: 'offset' as const, limit: PAGE_SIZE, offset: this.pageIndex * PAGE_SIZE };

      const result = await this.client.graphql.queryProcessInstances({
        fields: INSTANCE_FIELDS,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        pagination,
        sort: this.sortClauses,
      });
      console.debug(
        '[InstanceSearch] PI query returned',
        result.data.length,
        'instances, total:',
        (result.pageInfo as OffsetPageInfo).totalCount,
      );

      if (mySequence !== this.fetchSequence) {
        return;
      }

      const pageInfo = result.pageInfo as OffsetPageInfo;
      let fetchedInstances = result.data as ProcessInstance[];

      const versionResolutionEmpty =
        (this.processModelIdFilter || this.versionFilter) && !this.processVersionIdsForFilter?.length;

      if (versionResolutionEmpty) {
        fetchedInstances = [];
      }

      await this.enrichInstances(fetchedInstances);

      if (mySequence !== this.fetchSequence) {
        return;
      }

      this.instances = fetchedInstances;
      this.loading = false;
      this.error = null;
      this.lastUpdated = new Date();
      this.hasNextPage = versionResolutionEmpty ? false : (pageInfo.hasNextPage ?? false);
      this.hasPreviousPage = versionResolutionEmpty ? false : (pageInfo.hasPreviousPage ?? false);
      this.totalCount = versionResolutionEmpty ? 0 : (pageInfo.totalCount ?? 0);
      this.pageCount = versionResolutionEmpty ? 1 : (pageInfo.lastPage ?? 1);
      this.publishDataRevision();
    } catch (fetchError) {
      if (mySequence !== this.fetchSequence) {
        return;
      }
      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      this.loading = false;
      this.error = message;
      this.publishDataRevision();
    }
  }

  private async enrichInstances(instances: ProcessInstance[]): Promise<void> {
    if (!this.client) {
      return;
    }
    const unknownVersionIds = new Set<string>();
    for (const instance of instances) {
      if (instance.processVersionId && !this.versionToModelIdCache.has(instance.processVersionId)) {
        unknownVersionIds.add(instance.processVersionId);
      }
    }
    if (unknownVersionIds.size === 0) {
      this.applyEnrichment(instances);
      return;
    }
    try {
      const allProcesses = await this.client.processes.getAll();
      const modelIdsToFetchVersions = new Set<string>();
      for (const process of allProcesses) {
        if (process.versionId) {
          this.versionToModelIdCache.set(process.versionId, process.id);
          if (process.version) {
            this.versionToVersionStringCache.set(process.versionId, process.version);
          }
          const stillUnknown = [...unknownVersionIds].some((unknownId) => !this.versionToModelIdCache.has(unknownId));
          if (stillUnknown) {
            modelIdsToFetchVersions.add(process.id);
          }
        }
      }

      if ([...unknownVersionIds].some((id) => !this.versionToModelIdCache.has(id))) {
        for (const modelId of modelIdsToFetchVersions) {
          try {
            const versions = await this.client.processes.getVersions(modelId);
            for (const entry of versions) {
              if (entry.versionId) {
                this.versionToModelIdCache.set(entry.versionId, modelId);
                if (entry.version) {
                  this.versionToVersionStringCache.set(entry.versionId, entry.version);
                }
              }
            }
          } catch (versionFetchError) {
            console.warn('[InstanceSearch] Failed to fetch versions for model', modelId, versionFetchError);
          }
        }
      }
    } catch (enrichmentError) {
      console.warn('[InstanceSearch] Enrichment failed, proceeding without enrichment:', enrichmentError);
    }
    this.applyEnrichment(instances);
  }

  private applyEnrichment(instances: ProcessInstance[]): void {
    for (const instance of instances) {
      if (instance.processVersionId) {
        (instance as any).processModelId = this.versionToModelIdCache.get(instance.processVersionId);
        (instance as any).version = this.versionToVersionStringCache.get(instance.processVersionId);
      }
    }
  }

  private buildFilter(): ProcessInstanceFilter {
    const filter: ProcessInstanceFilter = {};
    if (this.idFilter) {
      filter.idText = { ilike: `%${this.idFilter}%` };
    }
    if (this.stateFilter.length > 0) {
      filter.state = { in: this.stateFilter };
    }
    if (this.processVersionIdsForFilter && this.processVersionIdsForFilter.length > 0) {
      filter.processVersionId = { in: this.processVersionIdsForFilter };
    }
    if (this.businessKeyFilter) {
      filter.businessKey = { ilike: `%${this.businessKeyFilter}%` };
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

  private async resolveProcessVersionFilter(): Promise<void> {
    if (!this.client || (!this.processModelIdFilter && !this.versionFilter)) {
      this.processVersionIdsForFilter = null;
      return;
    }

    if (this.processVersionIdsForFilter != null) {
      return;
    }

    try {
      let processIds: string[] | null = null;

      if (this.processModelIdFilter) {
        const processFilter = { processModelId: { ilike: `%${this.processModelIdFilter}%` } };
        console.debug('[InstanceSearch] Querying process models with filter:', JSON.stringify(processFilter));
        const processResult = await this.client.graphql.queryProcessModels({
          fields: ['id'],
          filter: processFilter,
          pagination: { mode: 'offset', limit: 100, offset: 0 },
        });
        processIds = processResult.data.map((process) => process.id);
        console.debug('[InstanceSearch] Process model query returned', processIds.length, 'IDs:', processIds);
        if (processIds.length === 0) {
          this.processVersionIdsForFilter = [];
          return;
        }
      }

      const versionFilter: Record<string, unknown> = {};
      if (processIds) {
        versionFilter.processId = { in: processIds };
      }
      if (this.versionFilter) {
        versionFilter.version = { ilike: `%${this.versionFilter}%` };
      }

      console.debug('[InstanceSearch] Querying process versions with filter:', JSON.stringify(versionFilter));
      const versionResult = await this.client.graphql.queryProcessVersions({
        fields: ['id'],
        filter: versionFilter as any,
        pagination: { mode: 'offset', limit: 100, offset: 0 },
      });

      this.processVersionIdsForFilter = versionResult.data.map((version) => version.id);
      console.debug(
        '[InstanceSearch] Version query returned',
        this.processVersionIdsForFilter.length,
        'version IDs:',
        this.processVersionIdsForFilter,
      );
    } catch (resolveError) {
      console.error('[InstanceSearch] Process/version filter resolution failed:', resolveError);
      throw resolveError;
    }
  }

  selectInstance(instance: ProcessInstance | null): void {
    if (instance?.id === this.selectedInstance?.id) {
      this.selectedInstance = null;
    } else {
      this.selectedInstance = instance;
    }
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  clearSelection(): void {
    this.selectedInstance = null;
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  getSelectedInstance(): ProcessInstance | null {
    return this.selectedInstance;
  }

  getSelectedInstanceId(): string | null {
    return this.selectedInstance?.id ?? null;
  }

  toggleRowSelection(instanceId: string, selected: boolean): void {
    if (selected) {
      this.selectedInstanceIds.add(instanceId);
    } else {
      this.selectedInstanceIds.delete(instanceId);
    }
  }

  toggleAllSelection(instanceIds: string[], selected: boolean): void {
    if (selected) {
      for (const instanceId of instanceIds) {
        this.selectedInstanceIds.add(instanceId);
      }
    } else {
      for (const instanceId of instanceIds) {
        this.selectedInstanceIds.delete(instanceId);
      }
    }
  }

  getSelectedInstanceIds(): string[] {
    return [...this.selectedInstanceIds];
  }

  setSelectedInstanceIds(instanceIds: string[]): void {
    this.selectedInstanceIds = new Set(instanceIds);
  }

  getSelectedInstances(): ProcessInstance[] {
    return this.instances.filter((instance) => this.selectedInstanceIds.has(instance.id));
  }

  async bulkAbortSelected(abortableInstances: ProcessInstance[]): Promise<void> {
    let succeeded = 0;
    let failed = 0;

    for (const instance of abortableInstances) {
      try {
        await this.studio.commands.executeCommand(ENGINE_COMMANDS.abortProcessInstance, [this.engineId, instance.id]);
        succeeded++;
      } catch {
        failed++;
      }
    }

    if (failed > 0) {
      this.studio.notifications.open({
        type: 'warning',
        content: `${succeeded} of ${abortableInstances.length} instances aborted, ${failed} failed.`,
        source: 'Engine',
      });
    } else {
      this.studio.notifications.open({
        type: 'info',
        content: `${succeeded} instance${succeeded === 1 ? '' : 's'} aborted.`,
        source: 'Engine',
      });
    }

    this.selectedInstanceIds.clear();
    await this.refresh();
  }

  applyColumnFilter(columnId: string, value: string): void {
    if (columnId === 'id') {
      this.setIdFilter(value);
    } else if (columnId === 'processModelId') {
      this.setProcessModelIdFilter(value);
    } else if (columnId === 'version') {
      this.setVersionFilter(value);
    } else if (columnId === 'businessKey') {
      this.setBusinessKeyFilter(value);
    }
  }

  async bulkRetrySelected(retryableInstances: ProcessInstance[], retryRequest?: RetryRequest): Promise<void> {
    let succeeded = 0;
    let failed = 0;

    for (const instance of retryableInstances) {
      try {
        await this.studio.commands.executeCommand(ENGINE_COMMANDS.retryProcessInstance, [
          this.engineId,
          instance.id,
          retryRequest,
        ]);
        succeeded++;
      } catch {
        failed++;
      }
    }

    if (failed > 0) {
      this.studio.notifications.open({
        type: 'warning',
        content: `${succeeded} of ${retryableInstances.length} instances retried, ${failed} failed.`,
        source: 'Engine',
      });
    } else {
      this.studio.notifications.open({
        type: 'info',
        content: `${succeeded} instance${succeeded === 1 ? '' : 's'} retried.`,
        source: 'Engine',
      });
    }

    this.selectedInstanceIds.clear();
    await this.refresh();
  }

  async bulkDeleteSelected(deletableInstances: ProcessInstance[]): Promise<void> {
    let succeeded = 0;
    let failed = 0;

    for (const instance of deletableInstances) {
      try {
        await this.studio.commands.executeCommand(ENGINE_COMMANDS.deleteProcessInstance, [this.engineId, instance.id]);
        succeeded++;
      } catch {
        failed++;
      }
    }

    if (failed > 0) {
      this.studio.notifications.open({
        type: 'warning',
        content: `${succeeded} of ${deletableInstances.length} instances deleted, ${failed} failed.`,
        source: 'Engine',
      });
    } else {
      this.studio.notifications.open({
        type: 'info',
        content: `${succeeded} instance${succeeded === 1 ? '' : 's'} deleted.`,
        source: 'Engine',
      });
    }

    this.selectedInstanceIds.clear();
    await this.refresh();
  }
}
