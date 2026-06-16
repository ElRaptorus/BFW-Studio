import type { EngineConnectionManager } from '#modules/engine-core';
import { EventDrivenRefresh, SETTINGS_KEYS } from '#modules/engine-core';
import type { DaemonEngineClient } from '@elraptorus/daemonengine_client';
import type { OffsetPageInfo, ProcessModel, ProcessModelField, SortClause } from '@elraptorus/daemonengine_sdk';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { EditorDocumentModel } from '@evil/bifrost_fw_sdk';

import { bulkRemoveProcesses, bulkToggleProcesses } from '../helpers/workspaceNavigation';

const CONNECTION_GRACE_PERIOD_MS = 60_000;
const PAGE_SIZE = 50;

export interface ProcessExplorerModelData {
  models: ProcessModel[];
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

const PROCESS_FIELDS: ProcessModelField[] = ['id', 'processModelId', 'name', 'enabled', 'createdAt'];

export class ProcessExplorerDocumentModel extends EditorDocumentModel {
  private studio: Studio;
  private connectionManager: EngineConnectionManager;
  private client: DaemonEngineClient | null;
  private engineId: string;
  private selectedModel: ProcessModel | null = null;
  private selectionRevision = 0;
  private selectedModelIds = new Set<string>();
  private nameFilter: string | null = null;
  private processModelIdFilter: string | null = null;
  private enabledFilter: boolean | null = null;
  private versionFilter: string | null = null;
  private deployedAtAfter: string | null = null;
  private deployedAtBefore: string | null = null;
  private sortClauses: SortClause<ProcessModelField>[] = [{ field: 'name', direction: 'asc' }];
  private pageIndex = 0;
  private autoRefresh: EventDrivenRefresh | null = null;
  private authTokenSubscription: { dispose: () => void } | null = null;
  private connectionLifecycleSubscriptions: { dispose: () => void }[] = [];
  private connectionGracePeriodTimer: ReturnType<typeof setTimeout> | null = null;
  private filterRevision = 0;

  private models: ProcessModel[] = [];
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

  private constructor(uri: string, studio: Studio) {
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
    studio: Studio,
  ): Promise<ProcessExplorerDocumentModel> {
    return new ProcessExplorerDocumentModel(uri, studio);
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
      settingsKey: SETTINGS_KEYS.processExplorerAutoRefresh,
      relevantEventTypes: [
        'ProcessDefinitionDeployed',
        'ProcessDefinitionUndeployed',
        'ProcessDefinitionEnabled',
        'ProcessDefinitionDisabled',
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

  getModels(): ProcessModel[] {
    return this.models;
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
    this.updateLabel(`Processes: ${name}`);
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

  getNameFilter(): string | null {
    return this.nameFilter;
  }

  setNameFilter(value: string | null): void {
    this.nameFilter = value;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  getProcessModelIdFilter(): string | null {
    return this.processModelIdFilter;
  }

  setProcessModelIdFilter(value: string | null): void {
    this.processModelIdFilter = value;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  getEnabledFilter(): boolean | null {
    return this.enabledFilter;
  }

  setEnabledFilter(value: boolean | null): void {
    this.enabledFilter = value;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  getVersionFilter(): string | null {
    return this.versionFilter;
  }

  setVersionFilter(value: string | null): void {
    this.versionFilter = value;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  getDeployedAtFilter(): { after: string | null; before: string | null } {
    return { after: this.deployedAtAfter, before: this.deployedAtBefore };
  }

  setDeployedAtFilter(after: string | null, before: string | null): void {
    this.deployedAtAfter = after;
    this.deployedAtBefore = before;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  applyColumnFilter(columnId: string, value: string): void {
    if (columnId === 'name') {
      this.setNameFilter(value);
    } else if (columnId === 'processModelId') {
      this.setProcessModelIdFilter(value);
    } else if (columnId === 'version') {
      this.setVersionFilter(value);
    }
  }

  private publishFilterState(): void {
    this.filterRevision++;
    this.updateMetadata({ filterRevision: this.filterRevision });
  }

  getSortClauses(): SortClause<ProcessModelField>[] {
    return this.sortClauses;
  }

  setSortClauses(clauses: SortClause<ProcessModelField>[]): void {
    this.sortClauses = clauses.length > 0 ? clauses : [{ field: 'name', direction: 'asc' }];
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
      const filter = this.buildFilter();
      const pagination = { mode: 'offset' as const, limit: PAGE_SIZE, offset: this.pageIndex * PAGE_SIZE };

      const result = await this.client.graphql.queryProcessModels({
        fields: PROCESS_FIELDS,
        filter: Object.keys(filter).length > 0 ? (filter as any) : undefined,
        pagination,
        sort: this.sortClauses,
        include: {
          versions: {
            fields: ['id', 'version', 'deployedAt'],
          },
        },
      });

      const pageInfo = result.pageInfo as OffsetPageInfo;
      const fetchedModels = result.data as ProcessModel[];

      this.enrichModelsWithVersionData(fetchedModels);
      this.models = fetchedModels;
      this.pruneStaleSelections();

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

  private enrichModelsWithVersionData(models: ProcessModel[]): void {
    for (const model of models) {
      const versions = (model as any).versions as { version?: string; deployedAt?: string }[] | undefined;
      if (!versions || versions.length === 0) {
        continue;
      }

      const sorted = [...versions].sort((left, right) => {
        const dateLeft = left.deployedAt ? new Date(left.deployedAt).getTime() : 0;
        const dateRight = right.deployedAt ? new Date(right.deployedAt).getTime() : 0;
        return dateRight - dateLeft;
      });
      const latest = sorted[0]!;
      model.version = latest.version;
      model.deployedAt = latest.deployedAt;
    }
  }

  private buildFilter(): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (this.nameFilter) {
      filter.name = { ilike: `%${this.nameFilter}%` };
    }
    if (this.processModelIdFilter) {
      filter.processModelId = { ilike: `%${this.processModelIdFilter}%` };
    }
    if (this.enabledFilter !== null) {
      filter.enabled = { eq: this.enabledFilter };
    }

    const versionsFilter: Record<string, unknown> = {};
    if (this.versionFilter) {
      versionsFilter.version = { ilike: `%${this.versionFilter}%` };
    }
    if (this.deployedAtAfter || this.deployedAtBefore) {
      const deployedAtFilter: Record<string, string> = {};
      if (this.deployedAtAfter) {
        deployedAtFilter.greaterThanOrEqual = new Date(this.deployedAtAfter).toISOString();
      }
      if (this.deployedAtBefore) {
        deployedAtFilter.lessThanOrEqual = new Date(this.deployedAtBefore).toISOString();
      }
      versionsFilter.deployedAt = deployedAtFilter;
    }
    if (Object.keys(versionsFilter).length > 0) {
      filter.versions = versionsFilter;
    }

    return filter;
  }

  private pruneStaleSelections(): void {
    const validIds = new Set(this.models.map((model) => model.id));
    this.selectedModelIds = new Set([...this.selectedModelIds].filter((id) => validIds.has(id)));
    if (this.selectedModel && !validIds.has(this.selectedModel.id)) {
      this.selectedModel = null;
    }
  }

  selectModel(model: ProcessModel | null): void {
    if (model?.id === this.selectedModel?.id) {
      this.selectedModel = null;
    } else {
      this.selectedModel = model;
    }
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  clearSelection(): void {
    this.selectedModel = null;
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  getSelectedModel(): ProcessModel | null {
    return this.selectedModel;
  }

  getSelectedModelId(): string | null {
    return this.selectedModel?.id ?? null;
  }

  toggleRowSelection(modelId: string, selected: boolean): void {
    if (selected) {
      this.selectedModelIds.add(modelId);
    } else {
      this.selectedModelIds.delete(modelId);
    }
  }

  toggleAllSelection(modelIds: string[], selected: boolean): void {
    if (selected) {
      for (const modelId of modelIds) {
        this.selectedModelIds.add(modelId);
      }
    } else {
      for (const modelId of modelIds) {
        this.selectedModelIds.delete(modelId);
      }
    }
  }

  getSelectedModelIds(): string[] {
    return [...this.selectedModelIds];
  }

  setSelectedModelIds(modelIds: string[]): void {
    this.selectedModelIds = new Set(modelIds);
  }

  getSelectedModels(): ProcessModel[] {
    return this.models.filter((model) => this.selectedModelIds.has(model.id));
  }

  clearBulkSelection(): void {
    this.selectedModelIds.clear();
  }

  async bulkRemoveSelected(): Promise<void> {
    const selected = this.getSelectedModels();
    if (selected.length === 0) {
      return;
    }
    await bulkRemoveProcesses(this.connectionManager, this.engineId, selected);
    this.clearBulkSelection();
    await this.refresh();
  }

  async bulkToggleSelected(enabled: boolean): Promise<void> {
    const selected = this.getSelectedModels();
    if (selected.length === 0) {
      return;
    }
    await bulkToggleProcesses(this.connectionManager, this.engineId, selected, enabled);
    await this.refresh();
  }
}

function extractEngineId(uri: string): string {
  const match = uri.match(/engine:\/\/processes\/([^?]+)/);
  return match?.[1] ?? '';
}
