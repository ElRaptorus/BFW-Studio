import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EngineConnectionManager } from '#modules/engine-core';
import { EventDrivenRefresh, SETTINGS_KEYS } from '#modules/engine-core';
import type { DaemonEngineClient } from '@elraptorus/daemonengine_client';
import type {
  DecisionDefinition,
  DecisionDefinitionField,
  DecisionDefinitionFilter,
  OffsetPageInfo,
  SortClause,
} from '@elraptorus/daemonengine_sdk';

const CONNECTION_GRACE_PERIOD_MS = 60_000;
const PAGE_SIZE = 50;

export interface DecisionCatalogModelData {
  decisions: DecisionDefinition[];
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

const DECISION_FIELDS: DecisionDefinitionField[] = ['id', 'decisionDefinitionId', 'name', 'enabled', 'createdAt'];

export class DecisionCatalogDocumentModel extends EditorDocumentModel {
  private studio: Bifrost;
  private connectionManager: EngineConnectionManager;
  private client: DaemonEngineClient | null;
  private engineId: string;
  private selectedDecision: DecisionDefinition | null = null;
  private selectionRevision = 0;
  private selectedDecisionIds = new Set<string>();
  private nameFilter: string | null = null;
  private decisionDefinitionIdFilter: string | null = null;
  private enabledFilter: boolean | null = null;
  private versionFilter: string | null = null;
  private resolvedDecisionIdsForVersionFilter: string[] | null = null;
  private sortClauses: SortClause<DecisionDefinitionField>[] = [{ field: 'name', direction: 'asc' }];
  private pageIndex = 0;
  private autoRefresh: EventDrivenRefresh | null = null;
  private authTokenSubscription: { dispose: () => void } | null = null;
  private connectionLifecycleSubscriptions: { dispose: () => void }[] = [];
  private connectionGracePeriodTimer: ReturnType<typeof setTimeout> | null = null;
  private filterRevision = 0;

  private decisions: DecisionDefinition[] = [];
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
  ): Promise<DecisionCatalogDocumentModel> {
    return new DecisionCatalogDocumentModel(uri, studio);
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
      settingsKey: SETTINGS_KEYS.decisionCatalogAutoRefresh,
      relevantEventTypes: ['DecisionDefinitionDeployed', 'DecisionDefinitionUndeployed'],
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

  getDecisions(): DecisionDefinition[] {
    return this.decisions;
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
    this.updateLabel(`Decisions: ${name}`);
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

  getDecisionDefinitionIdFilter(): string | null {
    return this.decisionDefinitionIdFilter;
  }

  setDecisionDefinitionIdFilter(value: string | null): void {
    this.decisionDefinitionIdFilter = value;
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
    this.resolvedDecisionIdsForVersionFilter = null;
    this.resetPagination();
    this.publishFilterState();
    void this.refresh();
  }

  applyColumnFilter(columnId: string, value: string): void {
    if (columnId === 'name') {
      this.setNameFilter(value);
    } else if (columnId === 'decisionDefinitionId') {
      this.setDecisionDefinitionIdFilter(value);
    } else if (columnId === 'version') {
      this.setVersionFilter(value);
    }
  }

  private publishFilterState(): void {
    this.filterRevision++;
    this.updateMetadata({ filterRevision: this.filterRevision });
  }

  getSortClauses(): SortClause<DecisionDefinitionField>[] {
    return this.sortClauses;
  }

  setSortClauses(clauses: SortClause<DecisionDefinitionField>[]): void {
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
      await this.resolveVersionFilter();
      const filter = this.buildFilter();

      if (this.versionFilter && this.resolvedDecisionIdsForVersionFilter?.length === 0) {
        this.decisions = [];
        this.pruneStaleSelections();
        this.loading = false;
        this.error = null;
        this.lastUpdated = new Date();
        this.hasNextPage = false;
        this.hasPreviousPage = false;
        this.totalCount = 0;
        this.pageCount = 1;
        this.publishDataRevision();
        return;
      }

      const pagination = { mode: 'offset' as const, limit: PAGE_SIZE, offset: this.pageIndex * PAGE_SIZE };

      const result = await this.client.graphql.queryDecisionDefinitions({
        fields: DECISION_FIELDS,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        pagination,
        sort: this.sortClauses,
        include: {
          versions: {
            fields: ['id', 'version', 'deployedAt'],
          },
        },
      });

      const pageInfo = result.pageInfo as OffsetPageInfo;
      const fetchedDecisions = result.data as DecisionDefinition[];

      this.enrichDecisionsWithVersionData(fetchedDecisions);
      this.decisions = fetchedDecisions;
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

  private enrichDecisionsWithVersionData(decisions: DecisionDefinition[]): void {
    for (const decision of decisions) {
      const versions = (decision as any).versions as { version?: string; deployedAt?: string }[] | undefined;
      if (!versions || versions.length === 0) {
        continue;
      }

      const sorted = [...versions].sort((left, right) => {
        const dateLeft = left.deployedAt ? new Date(left.deployedAt).getTime() : 0;
        const dateRight = right.deployedAt ? new Date(right.deployedAt).getTime() : 0;
        return dateRight - dateLeft;
      });
      const latest = sorted[0]!;
      decision.version = latest.version;
      decision.deployedAt = latest.deployedAt;
    }
  }

  private buildFilter(): DecisionDefinitionFilter {
    const filter: DecisionDefinitionFilter = {};
    if (this.nameFilter) {
      filter.name = { ilike: `%${this.nameFilter}%` };
    }
    if (this.decisionDefinitionIdFilter) {
      filter.decisionDefinitionId = { ilike: `%${this.decisionDefinitionIdFilter}%` };
    }
    if (this.enabledFilter !== null) {
      filter.enabled = { eq: this.enabledFilter };
    }
    if (this.resolvedDecisionIdsForVersionFilter && this.resolvedDecisionIdsForVersionFilter.length > 0) {
      filter.id = { in: this.resolvedDecisionIdsForVersionFilter };
    }
    return filter;
  }

  private async resolveVersionFilter(): Promise<void> {
    if (!this.client || !this.versionFilter) {
      this.resolvedDecisionIdsForVersionFilter = null;
      return;
    }

    if (this.resolvedDecisionIdsForVersionFilter != null) {
      return;
    }

    try {
      const versionResult = await this.client.graphql.queryDecisionVersions({
        fields: ['id', 'decisionDefinitionId'],
        filter: { version: { ilike: `%${this.versionFilter}%` } },
        pagination: { mode: 'offset', limit: 100, offset: 0 },
      });

      const decisionIds = new Set(versionResult.data.map((version) => version.decisionDefinitionId));
      this.resolvedDecisionIdsForVersionFilter = [...decisionIds];
    } catch (resolveError) {
      console.error('[DecisionCatalog] Version filter resolution failed:', resolveError);
      throw resolveError;
    }
  }

  private pruneStaleSelections(): void {
    const validIds = new Set(this.decisions.map((decision) => decision.id));
    this.selectedDecisionIds = new Set([...this.selectedDecisionIds].filter((id) => validIds.has(id)));
    if (this.selectedDecision && !validIds.has(this.selectedDecision.id)) {
      this.selectedDecision = null;
    }
  }

  selectDecision(decision: DecisionDefinition | null): void {
    if (decision?.id === this.selectedDecision?.id) {
      this.selectedDecision = null;
    } else {
      this.selectedDecision = decision;
    }
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  clearSelection(): void {
    this.selectedDecision = null;
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  getSelectedDecision(): DecisionDefinition | null {
    return this.selectedDecision;
  }

  getSelectedDecisionId(): string | null {
    return this.selectedDecision?.id ?? null;
  }

  toggleRowSelection(decisionId: string, selected: boolean): void {
    if (selected) {
      this.selectedDecisionIds.add(decisionId);
    } else {
      this.selectedDecisionIds.delete(decisionId);
    }
  }

  toggleAllSelection(decisionIds: string[], selected: boolean): void {
    if (selected) {
      for (const decisionId of decisionIds) {
        this.selectedDecisionIds.add(decisionId);
      }
    } else {
      for (const decisionId of decisionIds) {
        this.selectedDecisionIds.delete(decisionId);
      }
    }
  }

  getSelectedDecisionIds(): string[] {
    return [...this.selectedDecisionIds];
  }

  setSelectedDecisionIds(decisionIds: string[]): void {
    this.selectedDecisionIds = new Set(decisionIds);
  }

  getSelectedDecisions(): DecisionDefinition[] {
    return this.decisions.filter((decision) => this.selectedDecisionIds.has(decision.id));
  }

  clearBulkSelection(): void {
    this.selectedDecisionIds.clear();
  }

  async bulkRemoveSelected(): Promise<void> {
    const selected = this.getSelectedDecisions();
    if (selected.length === 0) {
      return;
    }
    for (const decision of selected) {
      const modelId = decision.decisionDefinitionId ?? decision.id;
      await this.toggleDecisionEnabled(modelId, false);
      await this.removeDecision(modelId);
    }
    this.clearBulkSelection();
    await this.refresh();
  }

  async bulkToggleSelected(enabled: boolean): Promise<void> {
    const selected = this.getSelectedDecisions();
    if (selected.length === 0) {
      return;
    }
    for (const decision of selected) {
      const modelId = decision.decisionDefinitionId ?? decision.id;
      await this.toggleDecisionEnabled(modelId, enabled);
    }
    await this.refresh();
  }

  private async toggleDecisionEnabled(decisionId: string, enabled: boolean): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected');
    }
    if (enabled) {
      await this.client.decisions.enable(decisionId);
    } else {
      await this.client.decisions.disable(decisionId);
    }
  }

  private async removeDecision(decisionId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected');
    }
    await this.client.decisions.undeploy(decisionId);
  }
}

function extractEngineId(uri: string): string {
  const match = uri.match(/engine:\/\/decisions\/([^?]+)/);
  return match?.[1] ?? '';
}
