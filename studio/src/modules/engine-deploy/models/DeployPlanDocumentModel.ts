import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import { EVENT_EDITOR_DOCUMENT_DATA_UPDATED } from '#bifrost/contracts/internal/EditorEvents';
import { EVENT_SETTINGS_CHANGED } from '#bifrost/contracts/internal/SettingsEvents';
import type { EngineConnectionManager } from '#modules/engine-core';
import * as fs from 'fs/promises';
import * as path from 'path';

import { analyzeDeployPlan, collectReferencedIds, getDeployBlockedReason } from '../analysis/analyzeDeployPlan';
import type { DeployExplorerMode } from '../analysis/buildDeployExplorerTree';
import { toFilePath } from '../analysis/deployPackages';
import type { DeployPlanFile } from '../analysis/executeDeployPlan';
import { executeDeployPlan, toFailedResult } from '../analysis/executeDeployPlan';
import { fetchEngineSnapshot } from '../analysis/fetchEngineSnapshot';
import type { SolutionModelEntry } from '../analysis/scanSolutionModels';
import { scanSolutionModels } from '../analysis/scanSolutionModels';
import type {
  DeployAnalysis,
  DeployConnection,
  DeployDependency,
  DeployItemAnalysis,
  DeployItemResult,
  EngineSnapshot,
} from '../analysis/types';

export const DEPLOY_PLAN_URI = 'deploy://plan';

const LOCAL_RECOMPUTE_DELAY_MS = 300;
const EMPTY_ANALYSIS: DeployAnalysis = { globalBlockers: [], items: [], dependencies: [] };

/**
 * The deployment plan: the files the user wants to deploy, and their analysis against the active Engine.
 *
 * Everything lives in private fields with getters. Only revision counters go to the metadata, and nothing is persisted
 * (the plan is a session-only set).
 */
export default class DeployPlanDocumentModel extends EditorDocumentModel {
  private readonly bifrost: Bifrost;
  private readonly connectionManager: EngineConnectionManager;

  private planUris: string[] = [];
  private readonly includedUris = new Set<string>();
  private readonly defaultedUris = new Set<string>();
  /** Offline defaults were chosen without Engine state; they are chosen again once a healthy snapshot arrives. */
  private readonly defaultedWithoutEngineState = new Set<string>();
  private selectedUri: string | null = null;
  private entries: SolutionModelEntry[] = [];
  private snapshot: EngineSnapshot | null = null;
  private engineUnavailableMessage: string | null = null;
  private analysis: DeployAnalysis = EMPTY_ANALYSIS;
  private results = new Map<string, DeployItemResult>();
  private deploying = false;
  private explorerMode: DeployExplorerMode = 'file';
  private loading = false;

  private analysisRevision = 0;
  private selectionRevision = 0;
  private refreshSequence = 0;
  private recomputeTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions: { dispose: () => void }[] = [];

  private constructor(uri: string, bifrost: Bifrost) {
    super(uri);
    this.bifrost = bifrost;
    this.connectionManager = bifrost.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
  }

  static async create(
    uri: string,
    _restoredCurrentData: unknown,
    restoredMetadata: unknown,
    _fileLoader: unknown,
    bifrost: Bifrost,
  ): Promise<DeployPlanDocumentModel> {
    const model = new DeployPlanDocumentModel(uri, bifrost);
    if ((restoredMetadata as { explorerMode?: string } | null)?.explorerMode === 'project') {
      model.explorerMode = 'project';
    }
    return model;
  }

  onEditorDocumentModelDidRegister(): void {
    this.updateLabel('Deploy Plan');
    const connectionEvents = [
      'engine:connected',
      'engine:disconnected',
      'engine:connection-lost',
      'engine:reconnected',
      'engine:auth-token-changed',
    ];
    for (const eventName of connectionEvents) {
      this.subscriptions.push(this.connectionManager.on(eventName, () => void this.refresh()));
    }
    this.subscriptions.push(
      this.bifrost.settings.on(EVENT_SETTINGS_CHANGED, (key: string) => {
        if (key.toLowerCase().includes('activeengine')) {
          void this.refresh();
        }
      }),
      this.bifrost.editors.on(EVENT_EDITOR_DOCUMENT_DATA_UPDATED, () => this.scheduleLocalRecompute()),
    );
  }

  onEditorDocumentDidFocus(): void {
    if (this.planUris.length > 0) {
      void this.recomputeLocal();
    }
  }

  onEditorDocumentWillClose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.subscriptions = [];
    if (this.recomputeTimer != null) {
      clearTimeout(this.recomputeTimer);
      this.recomputeTimer = null;
    }
  }

  // ─── Getters ───────────────────────────────────────────────────────

  getPlanUris(): readonly string[] {
    return this.planUris;
  }

  getAnalysis(): DeployAnalysis {
    return this.analysis;
  }

  isIncluded(uri: string): boolean {
    return this.includedUris.has(uri);
  }

  getIncludedUris(): ReadonlySet<string> {
    return this.includedUris;
  }

  /** Whether the Deploy Explorer lists files or folders. The plan shows the same granularity. */
  /** Increases on every change to what the plan tables show; use it as a memo key. */
  getRevision(): number {
    return this.analysisRevision;
  }

  getExplorerMode(): DeployExplorerMode {
    return this.explorerMode;
  }

  getSelectedUri(): string | null {
    return this.selectedUri;
  }

  getSelectedItem(): DeployItemAnalysis | null {
    return this.analysis.items.find((item) => item.uri === this.selectedUri) ?? null;
  }

  /** The dependencies the file references directly. Dependencies of local files it pulls in are listed under those files. */
  getDependenciesOf(uri: string): DeployDependency[] {
    return this.analysis.dependencies.filter((dependency) => dependency.requiredBy.includes(uri));
  }

  getResult(uri: string): DeployItemResult | null {
    return this.results.get(uri) ?? null;
  }

  isDeploying(): boolean {
    return this.deploying;
  }

  isLoading(): boolean {
    return this.loading;
  }

  getMissingLocalDependencyUris(): string[] {
    return [
      ...new Set(
        this.analysis.dependencies.flatMap((dependency) =>
          dependency.state === 'localNotInPlan' && dependency.fileUri != null ? [dependency.fileUri] : [],
        ),
      ),
    ];
  }

  /** The solution's project roots, for showing file locations. */
  getProjectRoots(): { name: string; baseUri: string }[] {
    return (this.bifrost.solution.getSolution()?.projects ?? []).map((project) => ({
      name: project.name,
      baseUri: project.baseUri,
    }));
  }

  getActiveEngineLabel(): string {
    const engineId = this.connectionManager.getActiveEngineId();
    const connection = engineId ? this.connectionManager.getConnection(engineId) : null;
    return connection == null ? 'No Engine' : (connection.displayName ?? connection.url);
  }

  /** The reason Deploy is disabled, or null when it can run. */
  getDeployBlockedReason(): string | null {
    if (this.deploying) {
      return 'A deployment is running.';
    }
    if (this.loading) {
      return 'The plan is being analysed.';
    }
    return getDeployBlockedReason(this.analysis, this.includedUris, this.getProjectRoots());
  }

  canDeploy(): boolean {
    return this.getDeployBlockedReason() == null;
  }

  // ─── Mutations ─────────────────────────────────────────────────────

  async addItems(uris: readonly string[]): Promise<void> {
    const added = uris.filter((uri) => !this.planUris.includes(uri));
    if (added.length === 0) {
      return;
    }
    this.planUris = [...this.planUris, ...added];
    await this.refresh();
    this.selectItem(added[0]);
  }

  async removeItem(uri: string): Promise<void> {
    await this.removeItems([uri]);
  }

  async removeItems(uris: readonly string[]): Promise<void> {
    this.planUris = this.planUris.filter((planUri) => !uris.includes(planUri));
    for (const uri of uris) {
      this.includedUris.delete(uri);
      this.defaultedUris.delete(uri);
      this.defaultedWithoutEngineState.delete(uri);
      this.results.delete(uri);
    }
    if (this.selectedUri != null && uris.includes(this.selectedUri)) {
      this.selectItem(null);
    }
    await this.refresh();
  }

  /** Empties the plan and adds the given files, as when a deploy package is loaded. */
  async replaceItems(uris: readonly string[]): Promise<void> {
    this.planUris = [];
    this.includedUris.clear();
    this.defaultedUris.clear();
    this.defaultedWithoutEngineState.clear();
    this.results.clear();
    this.selectItem(null);
    if (uris.length === 0) {
      await this.refresh();
      return;
    }
    await this.addItems(uris);
  }

  setExplorerMode(mode: DeployExplorerMode): void {
    if (mode === this.explorerMode) {
      return;
    }
    this.explorerMode = mode;
    this.updateMetadata({ explorerMode: mode });
    this.publishAnalysisRevision();
  }

  async addMissingDependencies(): Promise<void> {
    await this.addItems(this.getMissingLocalDependencyUris());
  }

  setIncluded(uri: string, included: boolean): void {
    this.setManyIncluded([uri], included);
  }

  setManyIncluded(uris: readonly string[], included: boolean): void {
    for (const uri of uris) {
      this.defaultedWithoutEngineState.delete(uri);
      if (included) {
        this.includedUris.add(uri);
      } else {
        this.includedUris.delete(uri);
      }
    }
    this.publishAnalysisRevision();
  }

  selectItem(uri: string | null): void {
    this.selectedUri = uri;
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  /** Re-reads the solution models and asks the Engine again. */
  async refresh(): Promise<void> {
    const sequence = ++this.refreshSequence;
    this.loading = true;
    this.publishAnalysisRevision();
    try {
      this.entries = await this.scanSolution();
      const connection = this.getConnection();
      let snapshot: EngineSnapshot | null = null;
      const client = connection.engineId == null || !connection.connected ? null : this.getClient(connection.engineId);
      if (client != null) {
        const { processIds, decisionIds } = collectReferencedIds(this.planUris, this.entries);
        snapshot = await fetchEngineSnapshot(client, processIds, decisionIds);
      }
      if (sequence !== this.refreshSequence) {
        return;
      }
      this.engineUnavailableMessage = snapshot != null && !snapshot.health.ok ? snapshot.health.message : null;
      this.snapshot = snapshot != null && snapshot.health.ok ? snapshot : null;
      if (this.snapshot != null) {
        for (const uri of this.defaultedWithoutEngineState) {
          this.defaultedUris.delete(uri);
        }
        this.defaultedWithoutEngineState.clear();
      }
    } finally {
      if (sequence === this.refreshSequence) {
        this.loading = false;
        this.recompute();
      }
    }
  }

  /** Re-reads the solution models and re-uses the cached Engine snapshot. */
  async recomputeLocal(): Promise<void> {
    const sequence = this.refreshSequence;
    const entries = await this.scanSolution();
    if (sequence !== this.refreshSequence) {
      return;
    }
    this.entries = entries;
    this.recompute();
  }

  /** Deploys the included files, one request each, then analyses the plan again. */
  async deploy(): Promise<DeployItemResult[]> {
    if (!this.canDeploy()) {
      return [];
    }
    const files: DeployPlanFile[] = this.analysis.items
      .filter((item) => this.includedUris.has(item.uri) && item.kind !== 'invalid')
      .map((item) => ({ uri: item.uri, kind: item.kind as 'bpmn' | 'dmn' }));
    this.deploying = true;
    this.results.clear();
    this.publishAnalysisRevision();
    let results: DeployItemResult[];
    try {
      results = await executeDeployPlan(files, (file) => this.deployFile(file));
      for (const result of results) {
        this.results.set(result.uri, result);
        if (result.status === 'deployed') {
          this.includedUris.delete(result.uri);
        }
      }
    } finally {
      this.deploying = false;
    }
    await this.refresh();
    return results;
  }

  // ─── Internals ─────────────────────────────────────────────────────

  private async deployFile(file: DeployPlanFile): Promise<DeployItemResult> {
    const engineId = this.connectionManager.getActiveEngineId();
    if (!engineId) {
      return { uri: file.uri, status: 'failed', message: 'No Engine is selected.', rulesetFailures: [] };
    }
    if (!this.connectionManager.isConnected(engineId)) {
      return { uri: file.uri, status: 'failed', message: 'No connected Engine.', rulesetFailures: [] };
    }
    const filePath = toFilePath(file.uri);
    try {
      if (file.kind === 'bpmn') {
        const outcome = await this.bifrost.commands.executeCommand('engine.workspace.deployBpmnFile', [
          engineId,
          filePath,
        ]);
        if (outcome.status === 'deployed') {
          return { uri: file.uri, status: 'deployed', message: null, rulesetFailures: [] };
        }
        if (outcome.status === 'cancelled') {
          return {
            uri: file.uri,
            status: 'cancelled',
            message: 'Cancelled in the version dialog.',
            rulesetFailures: [],
          };
        }
        return outcome.error == null
          ? { uri: file.uri, status: 'failed', message: outcome.message, rulesetFailures: [] }
          : { ...toFailedResult(file.uri, outcome.error), message: outcome.message };
      }
      const content = await fs.readFile(filePath, 'utf-8');
      await this.bifrost.commands.executeCommand('engine.deploy', [engineId, content, path.basename(filePath)]);
      return { uri: file.uri, status: 'deployed', message: null, rulesetFailures: [] };
    } catch (error) {
      return toFailedResult(file.uri, error);
    }
  }

  private async scanSolution(): Promise<SolutionModelEntry[]> {
    return scanSolutionModels(this.bifrost);
  }

  private getClient(engineId: string): Parameters<typeof fetchEngineSnapshot>[0] | null {
    return this.connectionManager.getClient(engineId) as Parameters<typeof fetchEngineSnapshot>[0] | null;
  }

  private getConnection(): DeployConnection {
    const engineId = this.connectionManager.getActiveEngineId() || null;
    const connection = engineId == null ? null : this.connectionManager.getConnection(engineId);
    const connected =
      engineId != null && this.connectionManager.isConnected(engineId) && this.getClient(engineId) != null;
    const hasCapability = (capability: 'deploy_bpmn' | 'deploy_dmn'): boolean =>
      connection != null && this.connectionManager.identity.hasCapability(connection.url, capability);
    return {
      engineId,
      connected,
      canDeployBpmn: hasCapability('deploy_bpmn'),
      canDeployDmn: hasCapability('deploy_dmn'),
    };
  }

  private getUnsavedUris(): Set<string> {
    return new Set(
      this.bifrost.editors
        .getOpenEditorDocuments()
        .filter((editorDocument) => editorDocument.hasUnsavedChanges && this.planUris.includes(editorDocument.uri))
        .map((editorDocument) => editorDocument.uri),
    );
  }

  private recompute(): void {
    this.analysis = analyzeDeployPlan({
      planUris: this.planUris,
      entries: this.entries,
      snapshot: this.snapshot,
      engineUnavailableMessage: this.engineUnavailableMessage,
      connection: this.getConnection(),
      unsavedUris: this.getUnsavedUris(),
    });
    // Defaults need the Engine state, so they wait for the snapshot unless the Engine is offline anyway.
    if (this.snapshot != null || !this.getConnection().connected) {
      for (const item of this.analysis.items) {
        if (!this.defaultedUris.has(item.uri)) {
          this.defaultedUris.add(item.uri);
          if (this.snapshot == null) {
            this.defaultedWithoutEngineState.add(item.uri);
          }
          if (item.includedByDefault) {
            this.includedUris.add(item.uri);
          }
        }
      }
    }
    this.publishAnalysisRevision();
  }

  private scheduleLocalRecompute(): void {
    if (this.planUris.length === 0) {
      return;
    }
    if (this.recomputeTimer != null) {
      clearTimeout(this.recomputeTimer);
    }
    this.recomputeTimer = setTimeout(() => {
      this.recomputeTimer = null;
      void this.recomputeLocal();
    }, LOCAL_RECOMPUTE_DELAY_MS);
  }

  private publishAnalysisRevision(): void {
    this.analysisRevision++;
    this.updateMetadata({ analysisRevision: this.analysisRevision });
  }
}
