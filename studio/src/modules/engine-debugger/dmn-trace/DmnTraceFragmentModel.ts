import type { EngineConnectionManager } from '#modules/engine-core';
import type { DaemonEngineClient } from '@elraptorus/daemonengine_client';
import { parseDmn } from '@elraptorus/daemonengine_sdk';
import type { FlowNodeInstance } from '@elraptorus/daemonengine_sdk';

import type { Studio } from '@evil/bifrost_fw_sdk';
import { EditorDocumentModel, parseOpenInNewTabUrl } from '@evil/bifrost_fw_sdk';

import type { DmnViewerComponentAdapter } from '../../dmn-core/DmnViewerComponentAdapter';
import type { DmnDefinitions, DrgSelection } from '../../engine-decision-viewer/types/dmnModelTypes';
import type { DmnFlowNodeTypeProperties, DmnTraceFragmentData } from './DmnTraceTypes';

const EMPTY_DATA: DmnTraceFragmentData = {
  flowNodeInstance: null,
  dmnXml: null,
  loading: true,
  error: null,
};

export class DmnTraceFragmentModel extends EditorDocumentModel {
  private connectionManager: EngineConnectionManager;
  private client: DaemonEngineClient | null;
  private viewerAdapter: DmnViewerComponentAdapter | null = null;
  private selectedElement: DrgSelection | null = null;
  private selectionRevision = 0;
  private parsedModel: DmnDefinitions | null = null;
  private traceProperties: DmnFlowNodeTypeProperties | null = null;

  readonly engineId: string;
  readonly processInstanceId: string;
  readonly flowNodeInstanceId: string;

  private constructor(uri: string, studio: Studio) {
    super(uri);
    this.connectionManager = studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');

    const parsed = parseDmnTraceFragmentUri(uri);
    this.engineId = parsed.engineId;
    this.processInstanceId = parsed.processInstanceId;
    this.flowNodeInstanceId = parsed.flowNodeInstanceId;
    this.client = this.connectionManager.getClient(this.engineId);
  }

  static async create(
    uri: string,
    _restoredCurrentData: unknown,
    _restoredMetadata: unknown,
    _fileLoader: unknown,
    studio: Studio,
  ): Promise<DmnTraceFragmentModel> {
    return new DmnTraceFragmentModel(uri, studio);
  }

  onEditorDocumentModelDidRegister(): void {
    this.updateCurrentData({ ...EMPTY_DATA });
    void this.loadTraceData();
  }

  registerViewerAdapter(adapter: DmnViewerComponentAdapter | null): void {
    this.viewerAdapter = adapter;
  }

  getViewerAdapter(): DmnViewerComponentAdapter | null {
    return this.viewerAdapter;
  }

  selectElement(selection: DrgSelection | null): void {
    if (selection?.elementId === this.selectedElement?.elementId && selection?.type === this.selectedElement?.type) {
      this.selectedElement = null;
    } else {
      this.selectedElement = selection;
    }

    this.selectionRevision++;
    this.updateMetadata({
      selectedElementId: this.selectedElement?.elementId ?? null,
      selectionRevision: this.selectionRevision,
    });
  }

  clearSelection(): void {
    this.selectedElement = null;
    this.selectionRevision++;
    this.updateMetadata({ selectedElementId: null, selectionRevision: this.selectionRevision });
  }

  getSelectedElement(): DrgSelection | null {
    return this.selectedElement;
  }

  getParsedModel(): DmnDefinitions | null {
    return this.parsedModel;
  }

  getTraceProperties(): DmnFlowNodeTypeProperties | null {
    return this.traceProperties;
  }

  zoomToViewport(): void {
    this.viewerAdapter?.zoomToViewport();
  }

  zoomToActualSize(): void {
    this.viewerAdapter?.zoomToActualSize();
  }

  protected override updateCurrentData(data: unknown): void {
    super.updateOriginalAndCurrentData(data, data);
  }

  getTraceData(): DmnTraceFragmentData {
    return (this.getCurrentData() as DmnTraceFragmentData) ?? EMPTY_DATA;
  }

  getDecisionRef(): string | null {
    return this.traceProperties?.decision_ref ?? null;
  }

  onEditorDocumentWillClose(): void {
    this.viewerAdapter = null;
  }

  private async loadTraceData(): Promise<void> {
    if (!this.client) {
      this.parsedModel = null;
      this.traceProperties = null;
      this.updateCurrentData({ ...EMPTY_DATA, loading: false, error: 'Engine not connected' });
      return;
    }

    try {
      const flowNodeInstance = await this.fetchFlowNodeInstance();
      if (!flowNodeInstance) {
        this.parsedModel = null;
        this.traceProperties = null;
        this.updateCurrentData({
          ...EMPTY_DATA,
          loading: false,
          error: 'Flow node instance not found',
        });
        return;
      }

      const typeProperties = flowNodeInstance.typeProperties as DmnFlowNodeTypeProperties | null;
      if (
        !typeProperties ||
        typeProperties.mode !== 'dmn' ||
        !typeProperties.decision_ref ||
        !typeProperties.trace?.decisions
      ) {
        this.parsedModel = null;
        this.traceProperties = null;
        this.updateCurrentData({
          ...EMPTY_DATA,
          flowNodeInstance,
          loading: false,
          error: 'This flow node instance does not contain DMN trace data',
        });
        return;
      }

      let dmnXml: string | null = null;
      let parsedModel: DmnDefinitions | null = null;

      try {
        dmnXml = await this.fetchDmnXml(typeProperties);
        if (dmnXml) {
          parsedModel = parseDmn(dmnXml);
        }
      } catch {
        /* DMN XML may not be available if the decision was undeployed — trace data is still valid */
      }

      this.parsedModel = parsedModel;
      this.traceProperties = typeProperties;

      this.updateCurrentData({
        flowNodeInstance,
        dmnXml,
        loading: false,
        error: null,
      });
    } catch (error: unknown) {
      this.parsedModel = null;
      this.traceProperties = null;
      const message = error instanceof Error ? error.message : 'Failed to load trace data';
      this.updateCurrentData({ ...EMPTY_DATA, loading: false, error: message });
    }
  }

  private async fetchDmnXml(typeProperties: DmnFlowNodeTypeProperties): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    const executionVersion = typeProperties.version;
    if (executionVersion) {
      try {
        const versions = await this.client.decisions.getVersions(typeProperties.decision_ref, { includeXml: true });
        const matchingVersion = versions.find((version) => version.version === executionVersion);
        if (matchingVersion?.dmnXml) {
          return matchingVersion.dmnXml;
        }
      } catch {
        /* fall through to latest-version fetch */
      }
    }

    const definition = await this.client.decisions.get(typeProperties.decision_ref, { includeXml: true });
    return definition.dmnXml ?? null;
  }

  private async fetchFlowNodeInstance(): Promise<FlowNodeInstance | null> {
    if (!this.client) {
      return null;
    }

    return this.client.graphql.getFlowNodeInstance(this.flowNodeInstanceId, {
      fields: [
        'id',
        'processInstanceId',
        'flowNodeId',
        'flowNodeType',
        'eventType',
        'laneName',
        'state',
        'startedAt',
        'finishedAt',
        'previousFlowNodeInstanceIds',
        'triggererFlowNodeInstanceId',
        'inputToken',
        'outputToken',
        'typeProperties',
        'errorInfo',
        'multiInstanceId',
        'iterationIndex',
      ],
    });
  }
}

function parseDmnTraceFragmentUri(uri: string): {
  engineId: string;
  processInstanceId: string;
  flowNodeInstanceId: string;
} {
  const parsed = parseOpenInNewTabUrl(uri);

  const engineId = parsed.data.engineId;
  const processInstanceId = parsed.data.processInstanceId;
  const flowNodeInstanceId = parsed.data.flowNodeInstanceId ?? parsed.fragmentId;

  if (!engineId || !processInstanceId || !flowNodeInstanceId) {
    throw new Error(`Invalid DMN trace fragment URI: missing required parameters — ${uri}`);
  }

  return { engineId, processInstanceId, flowNodeInstanceId };
}
