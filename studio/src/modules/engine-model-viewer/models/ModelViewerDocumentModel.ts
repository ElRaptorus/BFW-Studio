import type { BpmnViewerComponentAdapter } from '#modules/bpmn-core/BpmnViewerComponentAdapter';
import { EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED } from '#modules/bpmn-core/BpmnViewerComponentAdapter';
import BpmnElementOverlayManager from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import type { EngineConnectionManager } from '#modules/engine-core';
import type { DaemonEngineClient } from '@elraptorus/daemonengine_client';
import type { ProcessModel } from '@elraptorus/daemonengine_sdk';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { EditorDocumentModel } from '@evil/bifrost_fw_sdk';

import { createModelViewerFlowNodeOverlays, createModelViewerProcessOverlays } from '../overlays/OverlayFactory';
import type { ModelViewerModelData, ModelViewerSelection } from '../types';

const CONNECTION_GRACE_PERIOD_MS = 60_000;

const EMPTY_DATA: ModelViewerModelData = {
  processModelId: '',
  name: null,
  version: null,
  enabled: true,
  deployedAt: null,
  xml: null,
  versions: [],
  loading: true,
  error: null,
  lastUpdated: null,
  engineIsOnline: true,
  connectionGracePeriodExpired: false,
};

export class ModelViewerDocumentModel extends EditorDocumentModel {
  private studio: Studio;
  private connectionManager: EngineConnectionManager;
  private client: DaemonEngineClient | null;
  private engineId: string;
  private processModelId: string;
  private activeVersion: string | null = null;
  private selectedElement: ModelViewerSelection | null = null;
  private selectionRevision = 0;
  private viewerAdapter: BpmnViewerComponentAdapter | null = null;
  private overlayManager: BpmnElementOverlayManager | null = null;
  private rootChangedSubscription: { dispose: () => void } | null = null;
  private engineEventSubscription: { dispose: () => void } | null = null;
  private authTokenSubscription: { dispose: () => void } | null = null;
  private connectionLifecycleSubscriptions: { dispose: () => void }[] = [];
  private connectionGracePeriodTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(uri: string, studio: Studio) {
    super(uri);
    this.studio = studio;
    this.connectionManager = studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
    const parsed = parseModelUri(uri);
    this.engineId = parsed.engineId;
    this.processModelId = parsed.processModelId;
    this.client = this.connectionManager.getClient(this.engineId);
  }

  static async create(
    uri: string,
    _restoredCurrentData: any,
    _restoredMetadata: any,
    _fileLoader: any,
    studio: Studio,
  ): Promise<ModelViewerDocumentModel> {
    return new ModelViewerDocumentModel(uri, studio);
  }

  onEditorDocumentModelDidRegister(): void {
    const isOnline = this.connectionManager.isConnected(this.engineId);
    this.updateCurrentData({ ...EMPTY_DATA, processModelId: this.processModelId, engineIsOnline: isOnline });

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
    this.rootChangedSubscription?.dispose();
    this.rootChangedSubscription = null;
    for (const subscription of this.connectionLifecycleSubscriptions) {
      subscription.dispose();
    }
    this.connectionLifecycleSubscriptions = [];
    this.stopGraceTimer();
    this.overlayManager?.dispose();
    this.overlayManager = null;
    this.viewerAdapter?.dispose();
    this.viewerAdapter = null;
  }

  protected updateCurrentData(data: any): void {
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
          void this.refresh().then(() => this.refreshOverlays());
        }
      }),
      this.connectionManager.on('engine:reconnected', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          this.stopGraceTimer();
          this.applyOnlineState();
          void this.refresh().then(() => this.refreshOverlays());
        }
      }),
      this.connectionManager.on('engine:connection-lost', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          this.applyOfflineState();
          this.clearOverlays();
          this.startGraceTimerForReconnecting();
        }
      }),
    );
  }

  private static readonly RELEVANT_EVENT_TYPES = [
    'ProcessDefinitionDeployed',
    'ProcessDefinitionUndeployed',
    'ProcessDefinitionEnabled',
    'ProcessDefinitionDisabled',
  ];

  private subscribeToEngineEvents(): void {
    if (this.engineEventSubscription) {
      return;
    }
    this.engineEventSubscription = this.connectionManager.on('engine:event', (payload: any) => {
      if (payload?.engineId !== this.engineId) {
        return;
      }
      const eventType: string | undefined = payload?.type;
      if (eventType && ModelViewerDocumentModel.RELEVANT_EVENT_TYPES.includes(eventType)) {
        void this.refresh();
      }
    });
  }

  private unsubscribeFromEngineEvents(): void {
    this.engineEventSubscription?.dispose();
    this.engineEventSubscription = null;
  }

  private applyOnlineState(): void {
    const previous = this.getCurrentData() as ModelViewerModelData | null;
    this.updateCurrentData({
      ...(previous ?? { ...EMPTY_DATA, processModelId: this.processModelId }),
      engineIsOnline: true,
      connectionGracePeriodExpired: false,
    });
  }

  private applyOfflineState(): void {
    const previous = this.getCurrentData() as ModelViewerModelData | null;
    this.updateCurrentData({
      ...(previous ?? { ...EMPTY_DATA, processModelId: this.processModelId }),
      engineIsOnline: false,
      connectionGracePeriodExpired: false,
    });
  }

  private startGraceTimerForReconnecting(): void {
    this.stopGraceTimer();
    this.connectionGracePeriodTimer = setTimeout(() => {
      const previous = this.getCurrentData() as ModelViewerModelData | null;
      this.updateCurrentData({
        ...(previous ?? { ...EMPTY_DATA, processModelId: this.processModelId }),
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

  getProcessModelId(): string {
    return this.processModelId;
  }

  getSelectedElement(): ModelViewerSelection | null {
    return this.selectedElement;
  }

  async refresh(): Promise<void> {
    this.client = this.connectionManager.getClient(this.engineId);
    const current = this.getCurrentData() as ModelViewerModelData | null;
    const onlineFlags = {
      engineIsOnline: current?.engineIsOnline ?? true,
      connectionGracePeriodExpired: current?.connectionGracePeriodExpired ?? false,
    };

    if (!this.client) {
      this.updateCurrentData({
        ...EMPTY_DATA,
        ...onlineFlags,
        processModelId: this.processModelId,
        loading: false,
        error: 'Not connected',
      });
      return;
    }

    this.updateCurrentData({
      ...(current ?? EMPTY_DATA),
      ...onlineFlags,
      processModelId: this.processModelId,
      loading: true,
      error: null,
    });

    try {
      const [model, versionList] = await Promise.all([
        this.loadModelForVersion(this.activeVersion),
        this.client.processes.getVersions(this.processModelId),
      ]);

      this.updateCurrentData({
        processModelId: this.processModelId,
        name: model.name ?? null,
        version: model.version ?? null,
        enabled: model.enabled ?? true,
        deployedAt: model.deployedAt ?? null,
        xml: model.bpmnXml ?? null,
        versions: versionList.map((entry) => ({
          version: entry.version ?? null,
          deployedAt: entry.deployedAt ?? null,
          enabled: entry.enabled ?? true,
        })),
        loading: false,
        error: null,
        lastUpdated: new Date(),
        ...onlineFlags,
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      this.updateCurrentData({
        ...(current ?? EMPTY_DATA),
        ...onlineFlags,
        processModelId: this.processModelId,
        loading: false,
        error: message,
      });
    }
  }

  async switchVersion(version: string | null): Promise<void> {
    this.activeVersion = version;
    await this.refresh();
  }

  selectElement(selection: ModelViewerSelection | null): void {
    this.selectedElement = selection;
    this.selectionRevision++;
    this.updateMetadata({
      selectedElementId: selection?.elementId ?? null,
      selectionRevision: this.selectionRevision,
    });
  }

  clearSelection(): void {
    this.selectElement(null);
  }

  registerViewerAdapter(adapter: BpmnViewerComponentAdapter | null): void {
    this.rootChangedSubscription?.dispose();
    this.rootChangedSubscription = null;
    this.overlayManager?.dispose();
    this.overlayManager = null;
    this.viewerAdapter = adapter;
    if (adapter) {
      this.overlayManager = new BpmnElementOverlayManager(adapter);
      this.rootChangedSubscription = adapter.on(EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED, () => {
        this.refreshOverlays();
        const currentRootId = adapter.getCanvas().getRootElement()?.id ?? null;
        this.updateMetadata({ currentRootId });
      });
    }
  }

  getViewerAdapter(): BpmnViewerComponentAdapter | null {
    return this.viewerAdapter;
  }

  refreshOverlays(): void {
    if (!this.overlayManager || !this.viewerAdapter) {
      return;
    }

    if (!this.connectionManager.isConnected(this.engineId)) {
      this.overlayManager.updateAll([]);
      return;
    }

    const canvas = this.viewerAdapter.getCanvas();
    const rootElement = canvas.getRootElement();
    const visibleElements = this.getVisibleElements(rootElement);
    const allOverlays: Overlay[] = [];

    for (const element of visibleElements) {
      if (element.type === 'bpmn:Participant') {
        const processRef = element.businessObject?.processRef;
        const isExecutable = processRef?.isExecutable ?? false;
        allOverlays.push(...createModelViewerProcessOverlays(element.id, isExecutable, this.studio));
      } else if (
        element.type !== 'bpmn:Collaboration' &&
        element.type !== 'bpmn:Process' &&
        element.type !== 'label' &&
        element.businessObject != null
      ) {
        allOverlays.push(
          ...createModelViewerFlowNodeOverlays(element, this.studio, this.engineId, this.processModelId),
        );
      }
    }

    this.overlayManager.updateAll(allOverlays);
  }

  private getVisibleElements(rootElement: any): any[] {
    const elementRegistry = this.viewerAdapter?.getElementRegistry();
    if (!elementRegistry) {
      return [];
    }
    return (elementRegistry.getAll() as any[]).filter((element) => {
      if (element === rootElement) {
        return false;
      }
      let current = element;
      while (current.parent != null) {
        if (current.parent === rootElement) {
          return true;
        }
        current = current.parent;
      }
      return false;
    });
  }

  isInsideSubprocessPlane(): boolean {
    const canvas = this.viewerAdapter?.getCanvas();
    if (!canvas) {
      return false;
    }
    const rootElement = canvas.getRootElement();
    const businessObject = rootElement?.businessObject;
    if (businessObject == null) {
      return false;
    }
    // Transaction and AdHocSubProcess are moddle subclasses of SubProcess, so
    // $instanceOf catches all three; a strict $type check would miss them.
    return typeof businessObject.$instanceOf === 'function'
      ? businessObject.$instanceOf('bpmn:SubProcess')
      : businessObject.$type === 'bpmn:SubProcess';
  }

  getCurrentRootElement(): any {
    return this.viewerAdapter?.getCanvas().getRootElement() ?? null;
  }

  clearOverlays(): void {
    this.overlayManager?.updateAll([]);
  }

  async exportSvg(): Promise<string> {
    return (await this.viewerAdapter?.getSvg()) ?? '';
  }

  async exportPng(scale?: number): Promise<Blob> {
    if (!this.viewerAdapter) {
      return new Blob();
    }
    const svgString = await this.viewerAdapter.getSvg();
    return svgToPngBlob(svgString, scale);
  }

  zoomToViewport(): void {
    this.viewerAdapter?.zoomToViewport();
  }

  zoomToActualSize(): void {
    this.viewerAdapter?.setZoom(1);
  }

  attachToHtmlElement(element: HTMLElement): void {
    this.viewerAdapter?.attachToHtmlElement(element);
  }

  getXml(): string | null {
    const data = this.getCurrentData() as ModelViewerModelData | null;
    return data?.xml ?? null;
  }

  private async loadModelForVersion(version: string | null): Promise<ProcessModel> {
    if (!this.client) {
      throw new Error('Not connected');
    }
    if (version) {
      const versions = await this.client.processes.getVersions(this.processModelId, { includeXml: true });
      const match = versions.find((entry) => entry.version === version);
      if (match) {
        return match;
      }
    }
    return this.client.processes.get(this.processModelId, { includeXml: true });
  }
}

function parseModelUri(uri: string): { engineId: string; processModelId: string } {
  const match = uri.match(/engine-model:\/\/([^/]+)\/(.+)/);
  return {
    engineId: match?.[1] ?? '',
    processModelId: match?.[2] ?? '',
  };
}

function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      resolve(new Blob());
      return;
    }

    const image = new Image();
    image.onload = () => {
      canvas.width = image.width * scale;
      canvas.height = image.height * scale;
      context.scale(scale, scale);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => resolve(blob ?? new Blob()), 'image/png');
    };
    image.onerror = () => resolve(new Blob());
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
