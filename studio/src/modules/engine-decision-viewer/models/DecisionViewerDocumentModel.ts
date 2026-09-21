import type { Bifrost } from '#bifrost/Bifrost';
import { EditorDocumentModel } from '#bifrost/common/EditorDocumentModel';
import type { EngineConnectionManager } from '#modules/engine-core';
import type { DmnDefinitions, DrgSelection } from '#modules/engine-decision-viewer/types/dmnModelTypes';

import type { BfwEngineClient } from '@elraptorus/bfw_engine_client';
import { parseDmn } from '@elraptorus/bfw_engine_sdk';
import type { EvaluationResult } from '@elraptorus/bfw_engine_sdk';
import type { DecisionDefinition } from '@elraptorus/bfw_engine_sdk';

import type { DmnViewerComponentAdapter } from '../../dmn-core/DmnViewerComponentAdapter';

export interface DecisionViewerModelData {
  definition: DecisionDefinition | null;
  xml: string | null;
  versions: DecisionDefinition[];
  selectedVersion: string | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  evaluationPanelOpen: boolean;
  evaluationInput: string;
  evaluationResult: EvaluationResult | null;
  evaluationError: string | null;
  evaluationLoading: boolean;
  selectedDecisionModelId: string | null;
  engineIsOnline: boolean;
  connectionGracePeriodExpired: boolean;
}

const CONNECTION_GRACE_PERIOD_MS = 60_000;

const EMPTY_DATA: DecisionViewerModelData = {
  definition: null,
  xml: null,
  versions: [],
  selectedVersion: null,
  loading: true,
  error: null,
  lastUpdated: null,
  evaluationPanelOpen: false,
  evaluationInput: '{}',
  evaluationResult: null,
  evaluationError: null,
  evaluationLoading: false,
  selectedDecisionModelId: null,
  engineIsOnline: true,
  connectionGracePeriodExpired: false,
};

export class DecisionViewerDocumentModel extends EditorDocumentModel {
  private studio: Bifrost;
  private connectionManager: EngineConnectionManager;
  private client: BfwEngineClient | null;
  private engineId: string;
  private decisionModelId: string;
  private selectedElement: DrgSelection | null = null;
  private selectionRevision = 0;
  private parsedModel: DmnDefinitions | null = null;
  private viewerAdapter: DmnViewerComponentAdapter | null = null;
  private engineEventSubscription: { dispose: () => void } | null = null;
  private authTokenSubscription: { dispose: () => void } | null = null;
  private connectionLifecycleSubscriptions: { dispose: () => void }[] = [];
  private connectionGracePeriodTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(uri: string, studio: Bifrost) {
    super(uri);
    this.studio = studio;
    this.connectionManager = studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
    const parsed = extractUriParts(uri);
    this.engineId = parsed.engineId;
    this.decisionModelId = parsed.decisionModelId;
    this.client = this.connectionManager.getClient(this.engineId);
  }

  static async create(
    uri: string,
    _restoredCurrentData: unknown,
    _restoredMetadata: unknown,
    _fileLoader: unknown,
    studio: Bifrost,
  ): Promise<DecisionViewerDocumentModel> {
    return new DecisionViewerDocumentModel(uri, studio);
  }

  onEditorDocumentModelDidRegister(): void {
    const isOnline = this.connectionManager.isConnected(this.engineId);
    this.updateCurrentData({ ...EMPTY_DATA, engineIsOnline: isOnline });

    if (isOnline) {
      void this.refresh();
    } else {
      this.startGraceTimerForReconnecting();
    }

    this.subscribeToEngineEvents();

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
    this.subscribeToEngineEvents();
    void this.refresh();
  }

  onEditorDocumentDidBlur(): void {
    this.unsubscribeFromEngineEvents();
  }

  onEditorDocumentWillClose(): void {
    this.unsubscribeFromEngineEvents();
    this.authTokenSubscription?.dispose();
    this.authTokenSubscription = null;
    for (const subscription of this.connectionLifecycleSubscriptions) {
      subscription.dispose();
    }
    this.connectionLifecycleSubscriptions = [];
    this.stopGraceTimer();
  }

  protected updateCurrentData(data: DecisionViewerModelData): void {
    super.updateOriginalAndCurrentData(data, data);
  }

  getEngineId(): string {
    return this.engineId;
  }

  private subscribeToConnectionLifecycle(): void {
    this.connectionLifecycleSubscriptions.push(
      this.connectionManager.on('engine:connected', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          this.stopGraceTimer();
          this.applyOnlineState();
          void this.refresh();
        }
      }),
      this.connectionManager.on('engine:reconnected', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          this.stopGraceTimer();
          this.applyOnlineState();
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

  private static readonly RELEVANT_EVENT_TYPES = ['DecisionDefinitionDeployed', 'DecisionDefinitionUndeployed'];

  private subscribeToEngineEvents(): void {
    if (this.engineEventSubscription) {
      return;
    }
    this.engineEventSubscription = this.connectionManager.on('engine:event', (payload: any) => {
      if (payload?.engineId !== this.engineId) {
        return;
      }
      const eventType: string | undefined = payload?.type;
      if (eventType && DecisionViewerDocumentModel.RELEVANT_EVENT_TYPES.includes(eventType)) {
        void this.refresh();
      }
    });
  }

  private unsubscribeFromEngineEvents(): void {
    this.engineEventSubscription?.dispose();
    this.engineEventSubscription = null;
  }

  private applyOnlineState(): void {
    const previous = this.getCurrentData() as DecisionViewerModelData | null;
    this.updateCurrentData({
      ...(previous ?? EMPTY_DATA),
      engineIsOnline: true,
      connectionGracePeriodExpired: false,
    });
  }

  private applyOfflineState(): void {
    const previous = this.getCurrentData() as DecisionViewerModelData | null;
    this.updateCurrentData({
      ...(previous ?? EMPTY_DATA),
      engineIsOnline: false,
      connectionGracePeriodExpired: false,
    });
  }

  private startGraceTimerForReconnecting(): void {
    this.stopGraceTimer();
    this.connectionGracePeriodTimer = setTimeout(() => {
      const previous = this.getCurrentData() as DecisionViewerModelData | null;
      this.updateCurrentData({
        ...(previous ?? EMPTY_DATA),
        connectionGracePeriodExpired: true,
      });
    }, CONNECTION_GRACE_PERIOD_MS);
  }

  private stopGraceTimer(): void {
    if (this.connectionGracePeriodTimer !== null) {
      clearTimeout(this.connectionGracePeriodTimer);
      this.connectionGracePeriodTimer = null;
    }
  }

  getDecisionModelId(): string {
    return this.decisionModelId;
  }

  getSelectedElement(): DrgSelection | null {
    return this.selectedElement;
  }

  getParsedModel(): DmnDefinitions | null {
    return this.parsedModel;
  }

  registerViewerAdapter(adapter: DmnViewerComponentAdapter | null): void {
    this.viewerAdapter = adapter;
  }

  getViewerAdapter(): DmnViewerComponentAdapter | null {
    return this.viewerAdapter;
  }

  zoomToViewport(): void {
    this.viewerAdapter?.zoomToViewport();
  }

  zoomToActualSize(): void {
    this.viewerAdapter?.zoomToActualSize();
  }

  async exportSvg(): Promise<string> {
    if (!this.viewerAdapter) {
      return '';
    }
    try {
      return await this.viewerAdapter.getSvg();
    } catch {
      return '';
    }
  }

  async exportPng(scale: number = 2): Promise<Blob> {
    const svgString = await this.exportSvg();
    if (!svgString) {
      return new Blob();
    }

    return new Promise<Blob>((resolve) => {
      const image = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        const context = canvas.getContext('2d')!;
        context.scale(scale, scale);
        context.drawImage(image, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => resolve(blob ?? new Blob()), 'image/png');
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(new Blob());
      };

      image.src = url;
    });
  }

  async refresh(): Promise<void> {
    this.client = this.connectionManager.getClient(this.engineId);
    const current = this.getCurrentData() as DecisionViewerModelData | null;
    const onlineFlags = {
      engineIsOnline: current?.engineIsOnline ?? true,
      connectionGracePeriodExpired: current?.connectionGracePeriodExpired ?? false,
    };

    if (!this.client) {
      this.parsedModel = null;
      this.updateCurrentData({ ...EMPTY_DATA, ...onlineFlags, loading: false, error: 'Not connected' });
      return;
    }

    this.updateCurrentData({ ...(current ?? EMPTY_DATA), ...onlineFlags, loading: true, error: null });

    try {
      const [definition, versions] = await Promise.all([
        this.client.decisions.get(this.decisionModelId, { includeXml: true }),
        this.client.decisions.getVersions(this.decisionModelId, { includeXml: true }),
      ]);

      let selectedVersion = current?.selectedVersion ?? definition.version ?? null;
      let versionDefinition: DecisionDefinition;
      if (selectedVersion != null) {
        const match = versions.find((entry) => entry.version === selectedVersion);
        if (match) {
          versionDefinition = match;
        } else {
          this.studio.notifications.open({
            type: 'warning',
            content: `Version "${selectedVersion}" is no longer available. Showing latest version.`,
            source: 'Decision Viewer',
          });
          versionDefinition = definition;
          selectedVersion = definition.version ?? null;
        }
      } else {
        versionDefinition = definition;
      }

      const xml = versionDefinition.dmnXml ?? definition.dmnXml ?? '';
      const parsedModel = xml ? parseDmn(xml) : null;
      this.parsedModel = parsedModel;

      this.updateCurrentData({
        ...(current ?? EMPTY_DATA),
        ...onlineFlags,
        definition: versionDefinition,
        xml: xml || null,
        versions,
        selectedVersion,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      this.updateCurrentData({ ...(current ?? EMPTY_DATA), ...onlineFlags, loading: false, error: message });
    }
  }

  async switchVersion(version: string | null): Promise<void> {
    const previous = this.getCurrentData() as DecisionViewerModelData | null;
    if (!this.client) {
      return;
    }

    this.updateCurrentData({ ...(previous ?? EMPTY_DATA), loading: true, error: null, selectedVersion: version });

    try {
      let versionDefinition: DecisionDefinition;
      if (version == null) {
        versionDefinition = await this.client.decisions.get(this.decisionModelId, { includeXml: true });
      } else {
        const versions = await this.client.decisions.getVersions(this.decisionModelId, { includeXml: true });
        const match = versions.find((entry) => entry.version === version);
        if (match?.dmnXml) {
          versionDefinition = match;
        } else {
          this.studio.notifications.open({
            type: 'warning',
            content: `Version "${version}" not found. Showing latest version.`,
            source: 'Decision Viewer',
          });
          versionDefinition = await this.client.decisions.get(this.decisionModelId, { includeXml: true });
        }
      }

      const xml = versionDefinition.dmnXml ?? '';
      const parsedModel = xml ? parseDmn(xml) : null;
      this.parsedModel = parsedModel;
      this.clearSelection();

      const resolvedVersion = versionDefinition.version ?? version;
      this.updateCurrentData({
        ...(previous ?? EMPTY_DATA),
        definition: versionDefinition,
        xml: xml || null,
        selectedVersion: resolvedVersion,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      this.updateCurrentData({ ...(previous ?? EMPTY_DATA), loading: false, error: message });
    }
  }

  selectElement(selection: DrgSelection | null): void {
    if (selection?.elementId === this.selectedElement?.elementId && selection?.type === this.selectedElement?.type) {
      this.selectedElement = null;
    } else {
      this.selectedElement = selection;
    }
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  clearSelection(): void {
    this.selectedElement = null;
    this.selectionRevision++;
    this.updateMetadata({ selectionRevision: this.selectionRevision });
  }

  toggleEvaluationPanel(): void {
    const previous = this.getCurrentData() as DecisionViewerModelData;
    this.updateCurrentData({ ...previous, evaluationPanelOpen: !previous.evaluationPanelOpen });
  }

  setEvaluationInput(input: string): void {
    const previous = this.getCurrentData() as DecisionViewerModelData;
    this.updateCurrentData({ ...previous, evaluationInput: input });
  }

  setSelectedDecisionModelId(decisionModelId: string | null): void {
    const previous = this.getCurrentData() as DecisionViewerModelData;
    this.updateCurrentData({ ...previous, selectedDecisionModelId: decisionModelId });
  }

  async evaluateDecision(): Promise<void> {
    if (!this.client) {
      return;
    }

    const previous = this.getCurrentData() as DecisionViewerModelData;
    this.updateCurrentData({
      ...previous,
      evaluationLoading: true,
      evaluationError: null,
      evaluationResult: null,
    });

    let input: Record<string, unknown>;
    try {
      input = JSON.parse(previous.evaluationInput) as Record<string, unknown>;
    } catch {
      this.updateCurrentData({
        ...previous,
        evaluationLoading: false,
        evaluationError: 'Invalid JSON input',
      });
      return;
    }

    const options: { decisionModelId?: string; includeUnmatchedDetails?: boolean } = {
      includeUnmatchedDetails: true,
    };
    if (previous.selectedDecisionModelId) {
      options.decisionModelId = previous.selectedDecisionModelId;
    } else if (this.selectedElement?.type === 'decision') {
      options.decisionModelId = this.selectedElement.elementId;
    }

    try {
      let result: EvaluationResult;
      if (previous.selectedVersion) {
        result = await this.client.decisions.evaluateByVersion(
          this.decisionModelId,
          previous.selectedVersion,
          input,
          options,
        );
      } else {
        result = await this.client.decisions.evaluate(this.decisionModelId, input, options);
      }

      this.updateCurrentData({
        ...previous,
        evaluationLoading: false,
        evaluationResult: result,
        evaluationError: null,
      });
    } catch (evaluateError) {
      const message = evaluateError instanceof Error ? evaluateError.message : 'Evaluation failed';
      this.updateCurrentData({
        ...previous,
        evaluationLoading: false,
        evaluationError: message,
      });
    }
  }

  getRawXml(): string | null {
    const data = this.getCurrentData() as DecisionViewerModelData | null;
    return data?.definition?.dmnXml ?? this.parsedModel?.rawXml ?? null;
  }

  openImportedModel(importedModelId: string): void {
    this.studio.editors.focusOrOpenEditorDocument(
      `engine-decision://${this.engineId}/${importedModelId}`,
      importedModelId,
    );
  }
}

function extractUriParts(uri: string): { engineId: string; decisionModelId: string } {
  const match = uri.match(/^engine-decision:\/\/([^/]+)\/(.+)$/);
  return {
    engineId: match?.[1] ?? '',
    decisionModelId: match?.[2] ?? '',
  };
}
