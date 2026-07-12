import { Bifrost } from '#bifrost/Bifrost';
import { DataObjectDetailLevel, showAllDataObjectDetails } from '#modules/bpmn-core/DataObjectDetailsSettings';
import type { Overlay } from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import BpmnElementOverlayManager from '#modules/bpmn-core/overlays/BpmnElementOverlayManager';
import type { CompensatedActivitySnapshot, EngineConnectionManager } from '#modules/engine-core';
import { getShortId } from '#modules/engine-core';
import { FlowNodeType, ProcessInstanceState } from '@elraptorus/daemonengine_sdk';
import type { DataObjectValue, FlowNodeInstance } from '@elraptorus/daemonengine_sdk';
import type { BpmnDefinitions, FlowNode as BpmnFlowNode, BpmnProcess } from '@elraptorus/daemonengine_sdk';
import ContextPadModule from 'bpmn-js/lib/features/context-pad';
import type { CanvasViewbox } from 'diagram-js/lib/core/Canvas';
import type { ElementLike, Shape } from 'diagram-js/lib/model/Types';
import debounce from 'lodash.debounce';

import type { AbstractSubscription, ILoadable, Studio } from '@evil/bifrost_fw_sdk';
import { EditorDocumentModel, assertNotNull } from '@evil/bifrost_fw_sdk';
import { EVENT_DATA_UPDATED } from '@evil/bifrost_fw_sdk/src/contracts/internal/EditorEvents';

import {
  BpmnViewerComponentAdapter,
  EVENT_BPMN_VIEWER_ADAPTER_LOCATION_CHANGED,
  EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED,
  EVENT_BPMN_VIEWER_ADAPTER_SELECTION_CHANGED,
} from '../bpmn-core/BpmnViewerComponentAdapter';
import { EVENT_DEBUGGER_SELECTED_FLOW_NODE_INSTANCE_CHANGED } from './Constants';
import CustomContextPadProvider from './bpmn-js/Provider/CustomContextPadProvider';
import CustomPopupProvider from './bpmn-js/Provider/CustomPopupProvider';
import { parseDebuggerUri } from './helpers/parseDebuggerUri';
import type { DataObject, ExecutableFlowNode, SelectableElement } from './libs/index';
import {
  EngineAdapter,
  ShapeMappers,
  getAllDataObjectReferences,
  getAllEmbeddedSubProcesses,
  getAllFlowNodes,
  getChildProcessInstanceId,
} from './libs/index';
import {
  createDataObjectModelOverlays,
  createDataStoreOverlays,
  createFlowNodeInstanceCover,
  createFlowNodeInstanceOverlays,
  createFlowNodeModelOverlays,
  createProcessModelOverlays,
} from './overlays/OverlayFactory';
import type { BpmnDiagramShape } from './types/BpmnDiagramShape';
import type { DebuggerBaseError, DebuggerProcessInstance } from './types/DebuggerTypes';

type SubProcessSanitizationMap = {
  flowNodeId: string;
  subProcesses: SubProcessSanitizationMap[];
};

const flowNodeWasExecuted = (fn: ExecutableFlowNode) => fn.flowNodeInstances.length > 0;

export default class EngineBpmnDebuggerEditorDocumentModel extends EditorDocumentModel {
  public bpmnViewerComponentAdapter: BpmnViewerComponentAdapter | null;
  public readonly engineId: string;

  private connectionManager: EngineConnectionManager;
  private restoredMetadata: any;
  private readonly bifrost: Bifrost;
  private initialized: boolean = false;

  private engineAdapter: EngineAdapter;
  private overlays: BpmnElementOverlayManager;

  private dataObjectData: DataObjectValue[] = [];
  private compensatedActivitiesData: CompensatedActivitySnapshot[] = [];
  private sortedFlowNodeInstances: FlowNodeInstance[] = [];
  private executedFlowNodes: ExecutableFlowNode[] = [];
  private processDefinitionData: BpmnDefinitions | null = null;
  private processModelData: BpmnProcess | null = null;
  private processInstanceData: DebuggerProcessInstance | null = null;
  private processInstanceId: string;
  private ancestorProcessInstancesData: string[] | null = null;
  private rootProcessInstanceData: string | null = null;
  private selectedFlowNodeInstanceId: string | null = null;
  private _selectedMultiInstanceId: string | null = null;
  private selectedSubProcessInstances: { [flowNodeId: string]: FlowNodeInstance } = {};
  private subProcessesWithSelectionByUser: string[] = [];
  private subProcessSanitizationMap: SubProcessSanitizationMap[] | null = null;

  private onEngineReconnectHandler: (() => void) | null = null;
  private onProcessModelUpdatedHandler: (() => void) | null = null;
  private onSettingsUpdatedHandler: (() => void) | null = null;

  private bpmnSelectionChangedSubscription: AbstractSubscription | null = null;
  private internalEventSubscriptions: AbstractSubscription[] = [];

  private debouncedDataUpdated = debounce(this.dataUpdated, 250, { maxWait: 250 });
  private connectionGracePeriodHasExpired: boolean = false;
  private connectionGracePeriodTimer: number | null = null;

  private error: DebuggerBaseError | null = null;

  private constructor(documentUri: string, studio: Studio, restoredMetadataFromPreviousSession: any) {
    super(documentUri);

    this.bifrost = Bifrost.cast(studio);
    this.connectionManager = studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
    this.restoredMetadata = restoredMetadataFromPreviousSession;

    const parsedUri = parseDebuggerUri(documentUri);
    this.engineId = parsedUri.engineId;
    this.processInstanceId = parsedUri.processInstanceId;

    const bpmnComponentOptions = {
      bpmnRenderer: {
        defaultFillColor: 'var(--color-bpmn-defaultFillColor)',
        defaultStrokeColor: 'var(--color-bpmn-defaultStrokeColor)',
      },
    };

    this.bpmnViewerComponentAdapter = new BpmnViewerComponentAdapter(documentUri, bpmnComponentOptions, [
      ContextPadModule,
      CustomContextPadProvider,
      CustomPopupProvider,
    ]);

    (this.bpmnViewerComponentAdapter.getViewerComponentByName('customContextPadProvider') as any).configure(
      this,
      studio,
    );
    (this.bpmnViewerComponentAdapter.getViewerComponentByName('customPopupProvider') as any).configure(this, studio);

    this.engineAdapter = new EngineAdapter(this.processInstanceId, this.engineId, this.connectionManager);

    this.engineAdapter.onError((error) => {
      this.error = error;
      this.updateCurrentData({
        engineIsOnline: this.engineIsOnline,
        error: {
          code: error.code,
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });
    });

    this.engineAdapter.onProcessUpdated(
      async (
        processInstance: DebuggerProcessInstance,
        processDefinition: BpmnDefinitions,
        processModel: BpmnProcess,
      ) => {
        if (!this.isReadyForInteraction) {
          await this.bpmnViewerComponentAdapter?.initialize(processInstance.xml ?? '', this.restoredMetadata);
        } else if (this.processInstanceData?.xml !== processInstance.xml) {
          await this.bpmnViewerComponentAdapter?.updateXml(processInstance.xml ?? '');
        }
        this.processInstanceData = processInstance;
        this.processDefinitionData = processDefinition;
        this.processModelData = processModel;

        if (this.subProcessSanitizationMap === null) {
          this.subProcessSanitizationMap = [];
          this.processModelData.flowNodes
            ?.filter((fn) => fn.type === FlowNodeType.SubProcess)
            .forEach((sp) => {
              const entry: SubProcessSanitizationMap = {
                flowNodeId: sp.id,
                subProcesses: [],
              };
              this.subProcessSanitizationMap!.push(entry);
              this.buildSubProcessSanitizationMap(sp, entry);
            });
        }
        this.error = null;
        this.debouncedDataUpdated();
      },
    );

    this.engineAdapter.onFlowNodeInstancesUpdated(
      (flowNodeInstances, dataObjectData, compensatedActivities, newFlowNodeInstances) => {
        this.sortedFlowNodeInstances = flowNodeInstances;
        this.dataObjectData = dataObjectData;
        this.compensatedActivitiesData = compensatedActivities;

        const isFullReload = newFlowNodeInstances == null;

        if (isFullReload) {
          this.subProcessesWithSelectionByUser = [];
          this.selectedSubProcessInstances = {};
        }

        const flowNodes = this.mapFlowNodeInstancesToFlowNodes(flowNodeInstances);
        this.executedFlowNodes = flowNodes;

        this.sanitizeSelectedSubProcessInstances();

        const hasNewFlowNodeInstances = newFlowNodeInstances != null && newFlowNodeInstances.length > 0;
        const newSubprocessShellFnis =
          newFlowNodeInstances?.filter(
            (fni) => fni.flowNodeType === FlowNodeType.SubProcess && fni.processInstanceId === this.processInstanceId,
          ) ?? [];

        if (newSubprocessShellFnis.length > 0) {
          this.refreshFlowNodeOverlays();
        } else if (hasNewFlowNodeInstances) {
          newFlowNodeInstances!.forEach((fni) => this.refreshFlowNodeOverlay(fni.flowNodeId));
          this.refreshSequenceFlowMarkers();
        } else {
          this.refreshFlowNodeOverlays();
        }
        this.error = null;

        this.debouncedDataUpdated();

        if (this.isAutoFollowEnabled) {
          this.focusViewOnCurrentProgress();
        }
      },
    );

    if (this.engineIsOnline) {
      void this.loadAncestorProcessInstanceIds();
    }

    this.subscribeToSelectionChangedEvent();

    this.internalEventSubscriptions.push(
      this.bpmnViewerComponentAdapter?.on(
        EVENT_BPMN_VIEWER_ADAPTER_LOCATION_CHANGED,
        (metadata: { viewbox: CanvasViewbox; zoom: number }) => this.updateMetadata({ ...metadata }),
      ),
      this.bifrost.events.on('settingsUpdate', (key) => {
        if (key === 'engineDebugger.viewer.autoFollow') {
          if (this.isAutoFollowEnabled) {
            this.focusViewOnCurrentProgress();
          }
          this.onSettingsUpdatedHandler?.();
        } else if (
          key === 'engineDebugger.viewer.showDocumentationMarker' ||
          key === 'engineDebugger.viewer.showMultipleOutgoingSequenceFlowsMarkers'
        ) {
          this.refreshFlowNodeOverlays();
        } else if (key === 'engineDebugger.viewer.dataObjectDetailLevel') {
          this.applyDataObjectVisibilitySettings();
          this.refreshFlowNodeOverlays();
        }
      }),
      this.on(EVENT_DATA_UPDATED, async () => {
        if (!this.isReadyForInteraction && this.processInstance != null) {
          await this.bpmnViewerComponentAdapter?.updateXml(this.processInstance.xml as string);
          this.applyDataObjectVisibilitySettings();
        }
      }),
      this.connectionManager.on('engine:connected', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          void this.handleEngineReconnected();
        }
      }),
      this.connectionManager.on('engine:reconnected', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          void this.handleEngineReconnected();
        }
      }),
      this.connectionManager.on('engine:connection-lost', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          this.startGraceTimerForReconnecting();
          this.updateCurrentData({ engineIsOnline: false, error: undefined });
        }
      }),
      this.connectionManager.on('engine:auth-token-changed', (event: { engineId: string }) => {
        if (event.engineId === this.engineId) {
          void this.refresh();
        }
      }),
    );

    this.overlays = new BpmnElementOverlayManager(this.bpmnViewerComponentAdapter);
    this.onceInteractive(() => {
      this.restoreMetadata(this.restoredMetadata);
      this.applyDataObjectVisibilitySettings();
      this.refreshFlowNodeOverlays();

      if (this.isAutoFollowEnabled) {
        this.focusViewOnCurrentProgress();
      }
    });

    this.bpmnViewerComponentAdapter.on(EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED, () => {
      this.refreshFlowNodeOverlays();
    });
  }

  get lastError(): DebuggerBaseError | null {
    return this.error;
  }

  get ancestorProcessInstances(): string[] {
    return this.ancestorProcessInstancesData ?? [];
  }

  get calledProcessInstanceId(): string {
    return this.processInstanceId;
  }

  get connectionGracePeriodExpired(): boolean {
    return this.connectionGracePeriodHasExpired;
  }

  get engineUrl(): string {
    return this.connectionManager.getConnection(this.engineId)?.url ?? this.engineId;
  }

  get compensatedActivities(): CompensatedActivitySnapshot[] {
    return this.compensatedActivitiesData;
  }

  get dataObjectValues(): DataObjectValue[] {
    return this.dataObjectData;
  }

  get dataObjectDetailLevel(): string {
    return this.bifrost.settings.get('engineDebugger.viewer.dataObjectDetailLevel');
  }

  get engineVersionIsSupported(): boolean {
    return true;
  }

  get engineDisplayName(): string {
    return this.connectionManager.getConnection(this.engineId)?.displayName ?? this.engineId;
  }

  get engineInfo(): { name?: string } | null {
    const connection = this.connectionManager.getConnection(this.engineId);
    return connection?.info ? { name: connection.info.engineName } : null;
  }

  get engineIsOnline(): boolean {
    return this.connectionManager.getConnection(this.engineId)?.state === 'connected';
  }

  get flowNodesWithInstances(): ExecutableFlowNode[] {
    const whitelistedProcessInstances = this.whitelistedProcessInstanceIds;
    const result = this.executedFlowNodes
      .map((fn) => ({
        ...fn,
        flowNodeInstances: fn.flowNodeInstances.filter((fni) =>
          whitelistedProcessInstances.includes(fni.processInstanceId),
        ),
      }))
      .filter((fn) => fn.flowNodeInstances.length > 0);

    return result;
  }

  get flowNodeInstances(): FlowNodeInstance[] {
    const whitelistedProcessInstances = this.whitelistedProcessInstanceIds;
    return this.sortedFlowNodeInstances.filter((fni) => whitelistedProcessInstances.includes(fni.processInstanceId));
  }

  get selectedMultiInstanceId(): string | null {
    return this._selectedMultiInstanceId;
  }

  get isAutoFollowEnabled(): boolean {
    return this.bifrost.settings.get('engineDebugger.viewer.autoFollow');
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get isReadyForInteraction(): boolean {
    return this.bpmnViewerComponentAdapter?.isReadyForInteraction() ?? false;
  }

  get processInstance(): DebuggerProcessInstance | null {
    return this.processInstanceData;
  }

  get processDefinition(): BpmnDefinitions | null {
    return this.processDefinitionData;
  }

  get processModel(): BpmnProcess | null {
    return this.processModelData;
  }

  get rootProcessInstanceId(): string | null {
    return this.rootProcessInstanceData;
  }

  get showDocumentationMarker(): boolean {
    return this.bifrost.settings.get('engineDebugger.viewer.showDocumentationMarker');
  }

  get showMultipleOutgoingSequenceFlowsMarkers(): boolean {
    return this.bifrost.settings.get('engineDebugger.viewer.showMultipleOutgoingSequenceFlowsMarkers');
  }

  /**
   * This always contains the main process instance that is currently being viewed in the debugger.
   * It also contains the process instance IDs of subprocesses, corresponding to the selected FlowNodeInstance on the subprocess.
   * These are determined from the selectedSubProcessInstances attribute.
   *
   * The two getters 'flowNodesWithInstances' and 'flowNodeInstances' use the list of whitelistedProcessInstanceIds to filter the returned FlowNodeInstances by these.
   * This way it makes sure that a FlowNodeInstance will never be displayed anywhere if it is in a non-selected SubProcessInstance.
   */
  private get whitelistedProcessInstanceIds(): string[] {
    const whitelistedProcessInstances = Object.values(this.selectedSubProcessInstances)
      .map((subProcessInstance) => getChildProcessInstanceId(subProcessInstance))
      .filter((id): id is string => id != null);
    whitelistedProcessInstances.push(this.processInstanceId);
    return whitelistedProcessInstances;
  }

  get selectedElements(): SelectableElement[] {
    if (!this.bpmnViewerComponentAdapter) {
      return [];
    }

    const selectedElements: SelectableElement[] = this.bpmnViewerComponentAdapter
      .getSelection()
      .get()
      .map((el) => {
        const shape = el as unknown as BpmnDiagramShape;
        switch (shape.type) {
          case 'bpmn:TextAnnotation':
          case 'bpmn:Association':
          case 'bpmn:MessageFlow':
          case 'bpmn:Collaboration':
          case 'bpmn:Group':
          case 'bpmn:Lane':
          case 'bpmn:DataStoreReference':
          case 'label':
            return ShapeMappers.GenericElement(shape);
          case 'bpmn:Participant':
            assertNotNull(this.processInstance, 'this.processInstance');
            return ShapeMappers.Participant(shape, this.processInstance);
          case 'bpmn:DataInputAssociation':
            assertNotNull(this.processModel, 'this.processModel');
            return ShapeMappers.DataInputAssociation(shape, this.processModel);
          case 'bpmn:DataOutputAssociation':
            assertNotNull(this.processModel, 'this.processModel');
            return ShapeMappers.DataOutputAssociation(shape, this.processModel);
          case 'bpmn:SequenceFlow':
            assertNotNull(this.processModel, 'this.processModel');
            return ShapeMappers.SequenceFlow(shape, this.processModel);
          case 'bpmn:DataObjectReference':
            assertNotNull(this.processModel, 'this.processModel');
            return ShapeMappers.DataObject(shape, this.processModel, this.dataObjectValues);
          default: {
            const flowNode = this.flowNodesWithInstances.find((flowNode) => flowNode.id === shape.id);
            if (flowNode) {
              return flowNode;
            }

            assertNotNull(this.processModel, 'this.processModel');
            return ShapeMappers.FlowNode(shape, this.processModel);
          }
        }
      });

    return selectedElements;
  }

  get selectedFlowNodeInstance(): FlowNodeInstance | undefined {
    const selectedElements = this.selectedElements;
    if (
      !selectedElements ||
      selectedElements[0]?.type !== 'FlowNode' ||
      selectedElements[0].flowNodeInstances.length === 0
    ) {
      return undefined;
    }

    if (!this.selectedFlowNodeInstanceId) {
      return selectedElements[0].flowNodeInstances[0];
    }

    return selectedElements[0].flowNodeInstances.find(
      (flowNodeInstance) => flowNodeInstance.id === this.selectedFlowNodeInstanceId,
    );
  }

  get selectedDataObjectInstance(): DataObjectValue | undefined {
    const selectedElements = this.selectedElements;
    if (
      !selectedElements ||
      selectedElements[0]?.type !== 'DataObject' ||
      selectedElements[0].dataObjectValues.length === 0
    ) {
      return undefined;
    }

    if (!this.selectedFlowNodeInstanceId) {
      return selectedElements[0].dataObjectValues[0];
    }

    return selectedElements[0].dataObjectValues.find(
      (flowNodeInstance) => flowNodeInstance.id === this.selectedFlowNodeInstanceId,
    );
  }

  get initialConnectionSuccessful(): boolean {
    return this.engineIsOnline;
  }

  static async create(
    documentUri: string,
    restoredCurrentData: any,
    restoredMetadata: any,
    fileLoader: ILoadable,
    studio: Studio,
  ): Promise<EngineBpmnDebuggerEditorDocumentModel> {
    const model = new EngineBpmnDebuggerEditorDocumentModel(documentUri, studio, restoredMetadata);
    model.initialize();

    return model;
  }

  async initialize(): Promise<void> {
    if (this.engineIsOnline) {
      try {
        await this.engineAdapter.initialize();
      } catch {
        this.initialized = true;
        this.updateMetadata({ isInitialized: true });
        return;
      }

      const processModelName = this.processInstance?.processModelId;
      const shortProcessInstanceId = getShortId(this.processInstance?.id);

      const editorDocumentLabel = `Instance: ${shortProcessInstanceId} • ${processModelName} • ${this.engineDisplayName}`;

      this.updateLabel(editorDocumentLabel);

      this.initialized = true;

      this.updateMetadata({ isInitialized: true });
    } else {
      this.startGraceTimerForReconnecting();
      this.internalEventSubscriptions.push(
        this.connectionManager.once('engine:connected', ([event]: { engineId: string }[]) => {
          if (event.engineId === this.engineId) {
            this.stopGraceTimerAfterReconnecting();
            void this.initialize();
          }
        }),
      );
    }
  }

  get executedCompensationAssociations(): string[] {
    const compensatedHandlerIds = new Set(this.compensatedActivitiesData.map((entry) => entry.handlerActivityId));
    if (compensatedHandlerIds.size === 0) {
      return [];
    }

    const allAssociations =
      this.bpmnViewerComponentAdapter?.getElementRegistry().filter((element) => element.type === 'bpmn:Association') ??
      [];

    return allAssociations
      .filter((association) => {
        const targetId = (association as any).businessObject?.targetRef?.id;
        return targetId != null && compensatedHandlerIds.has(targetId);
      })
      .map((association) => association.id);
  }

  get executedSequenceFlows(): string[] {
    const flowNodes = this.flowNodesWithInstances;
    const finishedFlowNodeIds = new Set(
      flowNodes.filter((fn) => fn.flowNodeInstances.some((fni) => fni.state === 'finished')).map((fn) => fn.id),
    );
    const executedFlowNodeIds = new Set(flowNodes.filter(flowNodeWasExecuted).map((fn) => fn.id));

    const allSequenceFlows =
      this.bpmnViewerComponentAdapter?.getElementRegistry().filter((element) => element.type === 'bpmn:SequenceFlow') ??
      [];

    return allSequenceFlows
      .filter((flow) => {
        const sourceId = flow.businessObject?.sourceRef?.id;
        const targetId = flow.businessObject?.targetRef?.id;
        return sourceId && targetId && finishedFlowNodeIds.has(sourceId) && executedFlowNodeIds.has(targetId);
      })
      .map((flow) => flow.id);
  }

  onEditorDocumentModelDidRegister(): void {
    this.updateMetadata({ isInitialized: false });
  }

  onEditorDocumentWillClose(): void {
    this.internalEventSubscriptions.forEach((subscription) => subscription.dispose());
    this.bpmnSelectionChangedSubscription?.dispose();
    this.engineAdapter.dispose();
    this.eventEmitter.removeAllListeners();

    this.overlays?.dispose();
    this.bpmnViewerComponentAdapter?.dispose();

    (this.overlays as any) = undefined;
    (this.bpmnViewerComponentAdapter as any) = undefined;
  }

  onEditorDocumentDidFocus(): void {
    if (this.engineIsOnline) {
      void this.engineAdapter.refresh();
    }
  }

  onEditorDocumentDidBlur(): void {
    const activeEditorDocumentUris = this.bifrost.editors.getActiveEditorDocuments().map((ed) => ed.uri);
    if (activeEditorDocumentUris.includes(this.uri)) {
      return;
    }

    this.engineAdapter.dispose();
  }

  onEngineReconnect(callback: () => void): void {
    this.onEngineReconnectHandler = callback;
  }

  onProcessModelUpdated(callback: () => void): void {
    this.onProcessModelUpdatedHandler = callback;
  }

  onSettingsUpdated(callback: () => void): void {
    this.onSettingsUpdatedHandler = callback;
  }

  attachToHtmlElement(bpmnHtmlElement: HTMLElement): void {
    this.bpmnViewerComponentAdapter?.attachToHtmlElement(bpmnHtmlElement);
  }

  updateCurrentData(data: any): void {
    super.updateOriginalAndCurrentData(data, data);
  }

  async refresh(): Promise<void> {
    await this.engineAdapter.refresh();
  }

  private async handleEngineReconnected(): Promise<void> {
    this.stopGraceTimerAfterReconnecting();
    await this.engineAdapter.refresh();
    if (this.engineIsOnline && !this.isReadyForInteraction && this.processInstance != null) {
      await this.bpmnViewerComponentAdapter?.initialize(this.processInstance.xml as string);
    }
    this.onEngineReconnectHandler?.();
  }

  private async loadAncestorProcessInstanceIds(): Promise<void> {
    const parentId = this.processInstance?.parentProcessInstanceId;
    if (parentId) {
      this.ancestorProcessInstancesData = [parentId];
      this.rootProcessInstanceData = parentId;
    }
  }

  // Generic Element Selector.
  selectElement(flowNodeId: string): void {
    const adapter = this.bpmnViewerComponentAdapter;
    if (!adapter) {
      return;
    }
    const selection = adapter.getSelection();
    const elementRegistry = adapter.getElementRegistry();
    const element = elementRegistry.get(flowNodeId);
    if (element == null) {
      return;
    }
    selection.select(element);
  }

  // Used for selecting a Flow Node Instance from the Drop Down Menu in the Flow Node Instance Property Panel.
  selectFlowNodeInstance(id: string): void {
    const flowNodeInstance = this.flowNodeInstances.find((fni) => fni.id === id) as FlowNodeInstance;

    if (flowNodeInstance.flowNodeType === FlowNodeType.SubProcess) {
      this.subProcessesWithSelectionByUser.push(flowNodeInstance.flowNodeId);
      this.selectedSubProcessInstances[flowNodeInstance.flowNodeId] = flowNodeInstance;
      this.sanitizeSelectedSubProcessInstances(flowNodeInstance.flowNodeId);
    }
    this.selectedFlowNodeInstanceId = id;
    this.updateMetadata({ selectedFlowNodeInstanceId: this.selectedFlowNodeInstanceId });
    this.emit(EVENT_DEBUGGER_SELECTED_FLOW_NODE_INSTANCE_CHANGED);

    this.refreshSequenceFlowMarkers();
    this.refreshFlowNodeOverlay(flowNodeInstance.flowNodeId);
  }

  getSelectedSubProcessInstance(flowNodeId: string): FlowNodeInstance | null {
    return this.selectedSubProcessInstances[flowNodeId] ?? null;
  }

  // Used for selecting a Multi Instance Id from the Drop Down Menu in the Flow Node Instance Property Panel.
  selectMultiInstance(multiInstanceId: string): void {
    this._selectedMultiInstanceId = multiInstanceId;
    this.updateMetadata({ selectedMultiInstanceId: this._selectedMultiInstanceId });
    this.selectFlowNodeInstance(multiInstanceId);
  }

  // Used for selecting a Data Object Instance from the Drop Down Menu in the Data Object Instance Property Panel.
  // Data Object Instances are identified, essentially, by the Flow Node Instance that created them.
  // So this is actually just an alias for "selectFlowNodeInstance". It works the same in each case.
  selectDataObjectInstance(id: string): void {
    this.selectFlowNodeInstance(id);
  }

  // Click Handler for Flow Node Instance Links contained in the Property Panel.
  navigateToFlowNodeInstance(id: string): void {
    const targetFlowNodeInstance = this.flowNodeInstances.find((flowNodeInstance) => flowNodeInstance.id === id);

    assertNotNull(targetFlowNodeInstance, 'targetFlowNodeInstance');

    // We must disable the base subscription before selecting the Flow Node,
    // or "selectedFlowNodeInstanceId" would get overwritten, when EVENT_BPMN_VIEWER_ADAPTER_SELECTION_CHANGED is fired.
    this.bpmnSelectionChangedSubscription?.dispose();

    const adapter = this.bpmnViewerComponentAdapter;
    if (!adapter) {
      return;
    }
    const selection = adapter.getSelection();
    const elementRegistry = adapter.getElementRegistry();
    const element = elementRegistry.get(targetFlowNodeInstance.flowNodeId);
    if (element == null) {
      return;
    }

    adapter.once(EVENT_BPMN_VIEWER_ADAPTER_SELECTION_CHANGED, (selectedElements: BpmnDiagramShape[]) => {
      this.selectFlowNodeInstance(id);

      this.updateMetadata({
        selection: selectedElements,
        hasSelection: selectedElements.length > 0,
        selectedFlowNodeInstanceId: id,
      });
      this.emit(EVENT_DEBUGGER_SELECTED_FLOW_NODE_INSTANCE_CHANGED);

      // Restores the original subscription for handling Flow Node selection events.
      this.subscribeToSelectionChangedEvent();
    });

    selection.select(element);
  }

  // If the Flow Node is not focussed, it will be focussed. If it is focused, the next Flow Node Instance of the Flow Node will be selected.
  // Used for the FlowNodeExecutionCountBadge Overlay Click Handler.
  navigateToNextFlowNodeInstance(flowNodeId: string, direction?: 1 | -1): void {
    const selectedFlowNodeInstance = this.selectedFlowNodeInstance;
    const flowNodeToSelect = this.flowNodesWithInstances.find(
      (flowNodeWithInstances) => flowNodeWithInstances.flowNodeModel?.id === flowNodeId,
    );

    if (!flowNodeToSelect) {
      return;
    }

    if (!selectedFlowNodeInstance || selectedFlowNodeInstance.flowNodeId !== flowNodeId) {
      return this.navigateToFlowNodeInstance(this.getSelectedFlowNodeInstanceByFlowNode(flowNodeToSelect).id);
    }

    const selectableFlowNodeInstances = flowNodeToSelect.flowNodeInstances;

    if (selectableFlowNodeInstances.length < 2) {
      return;
    }

    const selectedIndex = selectableFlowNodeInstances.findIndex((fni) => fni.id === selectedFlowNodeInstance.id);

    if (selectedIndex === -1) {
      return this.selectFlowNodeInstance(selectableFlowNodeInstances[0].id);
    }

    let newIndex = selectedIndex + (direction ?? 1);

    if (newIndex < 0) {
      newIndex = selectableFlowNodeInstances.length - 1;
    } else if (newIndex > selectableFlowNodeInstances.length - 1) {
      newIndex = 0;
    }

    return this.selectFlowNodeInstance(selectableFlowNodeInstances[newIndex].id);
  }

  // Click Handler for Data Object Instance Links contained in the Property Panel.
  navigateToDataObjectInstance(id: string): void {
    const targetDataObjectInstance = this.dataObjectValues.find((dataObjectInstance) => dataObjectInstance.id === id);

    assertNotNull(targetDataObjectInstance, 'targetDataObjectInstance');

    // See above.
    this.bpmnSelectionChangedSubscription?.dispose();

    const adapter = this.bpmnViewerComponentAdapter;
    if (!adapter) {
      return;
    }
    const selection = adapter.getSelection();
    const elementRegistry = adapter.getElementRegistry();
    const element = elementRegistry.get(targetDataObjectInstance.dataObjectId);
    if (element == null) {
      return;
    }

    adapter.once(EVENT_BPMN_VIEWER_ADAPTER_SELECTION_CHANGED, (selectedElements: BpmnDiagramShape[]) => {
      this.selectedFlowNodeInstanceId = id;

      this.updateMetadata({
        selection: selectedElements,
        hasSelection: selectedElements.length > 0,
        selectedFlowNodeInstanceId: id,
      });
      this.emit(EVENT_DEBUGGER_SELECTED_FLOW_NODE_INSTANCE_CHANGED);

      this.subscribeToSelectionChangedEvent();
    });

    selection.select(element);
    this.refreshFlowNodeOverlayByInstance(id);
  }

  async zoomToElements(elementIds: string[]): Promise<void> {
    try {
      return this.bpmnViewerComponentAdapter?.focusViewOnElements(elementIds);
    } catch (error) {
      if (error.message.match(/(Could not get bounds|Cannot read property)/)) {
        error.message += ` (tried to zoom to elements with IDs '${elementIds.join(', ')}')`;
      }
      throw error;
    }
  }

  zoomToViewport(): void {
    this.bpmnViewerComponentAdapter?.zoomToViewport();
  }

  setZoom(percentage: number): void {
    this.bpmnViewerComponentAdapter?.setZoom(percentage);
  }

  // Runs the given callback, once the adapter is interactive (i.e. has finished initializing, attaching and rendering).
  onceInteractive(callback: () => void | Promise<void>): void {
    this.bpmnViewerComponentAdapter?.onceInteractive(callback);
  }

  calculateTokenHistoryForFlowNodeInstance(id: string): Record<string, any> {
    const subsetStartIndex = this.flowNodeInstances.findIndex((flowNodeInstance) => flowNodeInstance.id === id) + 1;
    const previousFlowNodeInstances = this.flowNodeInstances
      .slice(subsetStartIndex)
      .filter((flowNodeInstance) => flowNodeInstance.state !== 'active' && flowNodeInstance.state !== 'waiting')
      .reverse();

    if (previousFlowNodeInstances.length === 0) {
      return {
        current: {},
        history: {},
      };
    }

    const currentFlowNodeInstance = this.flowNodeInstances.find((flowNodeInstance) => flowNodeInstance.id === id);

    const tokenHistory = {
      current: currentFlowNodeInstance?.inputToken ?? {},
      history: {},
    };

    for (const flowNodeInstance of previousFlowNodeInstances) {
      tokenHistory.history[flowNodeInstance.flowNodeId] = flowNodeInstance.outputToken ?? {};
    }

    return tokenHistory;
  }

  // The Flow Node Instance will have access to the Data Object values that were created BEFORE it was executed.
  // So we must backtrack to the last FlowNodeInstance that has written anything into any data object and then
  // get the data object values that were written up until that point.
  // This will only work, if the inspected Flow Node Instance actually has any predecessors.
  // Otherwise, we need not bother with a search.
  getDataObjectValuesAvailableToFlowNodeInstance(flowNodeInstance: FlowNodeInstance): Record<string, any> {
    if (flowNodeInstance.previousFlowNodeInstanceIds == null) {
      return {};
    }

    const dataObjectDataCopy = this.dataObjectValues.slice();
    const flowNodeInstanceCopy = this.flowNodeInstances.slice();

    const findIndexOfFirstPreviousWritingFlowNodeInstance = (): number => {
      const indexOfInspectedFlowNodeInstance = flowNodeInstanceCopy.findIndex(
        (entry) => entry.id === flowNodeInstance.id,
      );

      const lastFlowNodeInstanceWritingToDataObject = flowNodeInstanceCopy
        .slice(indexOfInspectedFlowNodeInstance + 1)
        .find((fni) => dataObjectDataCopy.some((dataObject) => dataObject.id === fni.id));

      if (!lastFlowNodeInstanceWritingToDataObject) {
        return -1;
      }

      return dataObjectDataCopy.findIndex(
        (dataObjectInstance) => dataObjectInstance.id === lastFlowNodeInstanceWritingToDataObject.id,
      );
    };

    const subsetStartIndex = findIndexOfFirstPreviousWritingFlowNodeInstance();

    // An Index of -1 means that no prior Flow Node Instance has written anything into any data object.
    if (subsetStartIndex === -1) {
      return {};
    }

    const previousDataObjectValues = dataObjectDataCopy.slice(subsetStartIndex).reverse();
    if (previousDataObjectValues.length === 0) {
      return {};
    }

    const dataObjectValues = {};

    for (const dataObjectInstance of previousDataObjectValues) {
      dataObjectValues[dataObjectInstance.dataObjectId] = dataObjectInstance.value;
    }

    return dataObjectValues;
  }

  async getProcessInstancesTriggeredByFlowNodeInstance(id: string): Promise<DebuggerProcessInstance[]> {
    const client = this.connectionManager.getClient(this.engineId);
    if (!client) {
      return [];
    }
    try {
      const result = await client.graphql.queryProcessInstances({
        filter: { triggererFlowNodeInstanceId: { eq: id } },
        fields: ['id', 'state', 'businessKey', 'startedAt', 'triggererFlowNodeInstanceId'],
      });
      return result.data.map((item) => ({
        id: item.id,
        state: item.state,
        businessKey: item.businessKey,
        parentProcessInstanceId: null,
        triggererFlowNodeInstanceId: item.triggererFlowNodeInstanceId ?? null,
        startedAt: item.startedAt ?? '',
        finishedAt: null,
        startedBy: null,
        startedWithContext: null,
        finalTokens: null,
        processModelId: '',
        xml: '',
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.bifrost.commands.executeCommand('std.notifications.showError', [
        new Error(`Failed to get Process Instances triggered by the selected Flow Node Instance: ${message}`),
        'getProcessInstancesTriggeredByFlowNodeInstance',
      ]);
      return [];
    }
  }

  async getEventsContinuedByFlowNodeInstance(id: string): Promise<FlowNodeInstance[]> {
    return this.sortedFlowNodeInstances.filter(
      (flowNodeInstance) => flowNodeInstance.triggererFlowNodeInstanceId === id,
    );
  }

  getSelectedFlowNodeInstanceByFlowNode(flowNode: ExecutableFlowNode): FlowNodeInstance {
    const flowNodeInstances = flowNode.flowNodeInstances;
    const defaultFlowNodeInstance = flowNodeInstances[0];

    if (flowNodeInstances.length < 2) {
      return defaultFlowNodeInstance;
    }

    if (flowNode.flowNodeModel?.type === FlowNodeType.SubProcess) {
      const subprocessFlowNodeId = flowNode.flowNodeModel.id;
      const flowNodeInstance = flowNodeInstances.find(
        (instance) => instance.id === this.selectedSubProcessInstances[subprocessFlowNodeId]?.id,
      );

      if (flowNodeInstance) {
        return flowNodeInstance;
      }
    }

    if (this.selectedFlowNodeInstanceId) {
      const flowNodeInstance = flowNodeInstances.find((fni) => fni.id === this.selectedFlowNodeInstanceId);

      if (flowNodeInstance) {
        return flowNodeInstance;
      }
    }

    return defaultFlowNodeInstance;
  }

  getSelectableDataObjectInstancesByDataObject(dataObject: DataObject): DataObjectValue[] {
    const isRootLevelDataObject = this.processModel?.dataObjectReferences.some((dor) => dor.id === dataObject.id);
    if (isRootLevelDataObject) {
      return dataObject.dataObjectValues;
    }

    const subProcess = this.processModel
      ? getAllEmbeddedSubProcesses(this.processModel).find((embeddedSubProcess) =>
          dataObject.dataObjectModel?.id === dataObject.id ? true : embeddedSubProcess.id === dataObject.id,
        )
      : undefined;
    if (!subProcess) {
      return [];
    }

    const selectedSubProcessInstance = this.selectedSubProcessInstances[subProcess.id];
    const childProcessInstanceId = selectedSubProcessInstance
      ? getChildProcessInstanceId(selectedSubProcessInstance)
      : null;
    if (!childProcessInstanceId) {
      return [];
    }

    const whitelistedProcessInstances = [childProcessInstanceId];
    let previousProcessInstancesLength = 0;
    while (previousProcessInstancesLength !== whitelistedProcessInstances.length) {
      previousProcessInstancesLength = whitelistedProcessInstances.length;
      whitelistedProcessInstances.push(
        ...this.sortedFlowNodeInstances
          .filter(
            (fni) =>
              fni.flowNodeType === FlowNodeType.SubProcess &&
              whitelistedProcessInstances.includes(fni.processInstanceId),
          )
          .map((fni) => getChildProcessInstanceId(fni))
          .filter((id): id is string => id != null),
      );
    }

    return dataObject.dataObjectValues.filter(
      (dataObjectValue) =>
        dataObjectValue.processInstanceId != null &&
        whitelistedProcessInstances.includes(dataObjectValue.processInstanceId),
    );
  }

  getSelectedDataObjectInstanceByDataObject(dataObject: DataObject): DataObjectValue {
    const dataObjectInstances = this.getSelectableDataObjectInstancesByDataObject(dataObject);
    const defaultDataObjectInstance = dataObjectInstances[0];

    if (this.selectedFlowNodeInstanceId) {
      const dataObjectInstance = dataObjectInstances.find(
        (dataObjectValue) => dataObjectValue.flowNodeInstanceId === this.selectedFlowNodeInstanceId,
      );

      if (dataObjectInstance) {
        return dataObjectInstance;
      }
    }

    return defaultDataObjectInstance;
  }

  private async dataUpdated(): Promise<void> {
    this.updateCurrentData({
      engineIsOnline: this.engineIsOnline,
      initialConnectionDone: this.initialConnectionSuccessful,
      error: undefined,
    });
  }

  private startGraceTimerForReconnecting(): void {
    this.connectionGracePeriodHasExpired = false;
    this.connectionGracePeriodTimer = window.setTimeout(() => {
      this.connectionGracePeriodTimer = null;
      this.connectionGracePeriodHasExpired = true;

      this.updateCurrentData({
        engineIsOnline: false,
        connectionGracePeriodExpired: true,
      });
    }, 60000);
  }

  private stopGraceTimerAfterReconnecting(): void {
    if (!this.connectionGracePeriodTimer) {
      return;
    }

    window.clearTimeout(this.connectionGracePeriodTimer);
    this.connectionGracePeriodTimer = null;
    this.connectionGracePeriodHasExpired = false;

    this.updateCurrentData({
      engineIsOnline: true,
      connectionGracePeriodExpired: false,
      error: this.getCurrentData()?.error,
    });
  }

  // This is the base event handler for clicking on an element in the diagram.
  // Only navigates to a Flow Node, but not a specific Flow Node Instance.
  private subscribeToSelectionChangedEvent(): void {
    const subscription = this.bpmnViewerComponentAdapter?.on(
      EVENT_BPMN_VIEWER_ADAPTER_SELECTION_CHANGED,
      (selectedElements: BpmnDiagramShape[]) => {
        if (this.selectedFlowNodeInstanceId) {
          this.refreshFlowNodeOverlayByInstance(this.selectedFlowNodeInstanceId);
        }
        this.selectedFlowNodeInstanceId = null;
        this._selectedMultiInstanceId = null;
        this.emit(EVENT_DEBUGGER_SELECTED_FLOW_NODE_INSTANCE_CHANGED);
        this.updateMetadata({
          selection: selectedElements,
          hasSelection: selectedElements.length > 0,
          selectedFlowNodeInstanceId: null,
        });
      },
    );

    this.bpmnSelectionChangedSubscription = subscription ?? null;
  }

  private applyDataObjectVisibilitySettings(): void {
    const hideReadingAssociations = !showAllDataObjectDetails(this.dataObjectDetailLevel);
    const hideWritingAssociations =
      this.dataObjectDetailLevel === DataObjectDetailLevel.hideAllAssociations ||
      this.dataObjectDetailLevel === DataObjectDetailLevel.hideAll;
    const hideDataObjects = this.dataObjectDetailLevel === DataObjectDetailLevel.hideAll;

    const dataObjectElementTags = [
      'bpmn:DataObjectReference',
      'bpmn:DataInputAssociation',
      'bpmn:DataOutputAssociation',
    ];

    const setElementDisplayStyle = (element: ElementLike, newVisibility: string): void => {
      const registry = this.bpmnViewerComponentAdapter!.getElementRegistry();
      registry.getGraphics(element).style.display = newVisibility;
      const shapeEl = element as Shape;
      shapeEl.labels?.forEach((label) => {
        if (label != null) {
          registry.getGraphics(label).style.display = newVisibility;
        }
      });

      // Hides Text Annotations attached to the Data Object, as well as their connecting Associations.
      shapeEl.outgoing
        ?.filter((association) => association.type === 'bpmn:Association')
        .forEach((association) => {
          registry.getGraphics(association).style.display = newVisibility;
          const target = association.target;
          if (target != null) {
            registry.getGraphics(target).style.display = newVisibility;
          }
        });
    };

    this.bpmnViewerComponentAdapter?.onceInteractive(() => {
      this.bpmnViewerComponentAdapter
        ?.getElementRegistry()
        .filter((element) => dataObjectElementTags.includes(element.type))
        .forEach((element) => {
          const hideElement =
            (element.type === 'bpmn:DataObjectReference' && hideDataObjects) ||
            (element.type === 'bpmn:DataOutputAssociation' && hideWritingAssociations) ||
            (element.type === 'bpmn:DataInputAssociation' && hideReadingAssociations);

          const elementIsHidden =
            this.bpmnViewerComponentAdapter?.getElementRegistry().getGraphics(element).style.display === 'none';

          if (hideElement && !elementIsHidden) {
            setElementDisplayStyle(element, 'none');
          } else if (!hideElement && elementIsHidden) {
            setElementDisplayStyle(element, 'block');
          }
        });
    });
  }

  private async focusViewOnCurrentProgress(): Promise<void> {
    if (!this.processInstance) {
      return;
    }

    let elementsToFocusViewOn: string[] = [];

    switch (this.processInstance.state) {
      case ProcessInstanceState.Finished:
      case ProcessInstanceState.Compensated:
      case ProcessInstanceState.Cancelled:
        elementsToFocusViewOn = this.flowNodeInstances
          .filter((flowNodeInstance) => flowNodeInstance.state === 'finished')
          .map((flowNodeInstance) => flowNodeInstance.flowNodeId);
        break;
      case ProcessInstanceState.Aborted:
      case ProcessInstanceState.Fatal:
      case ProcessInstanceState.Error:
        elementsToFocusViewOn = this.flowNodeInstances
          .filter(
            (flowNodeInstance) =>
              flowNodeInstance.state === 'fatal' ||
              flowNodeInstance.state === 'aborted' ||
              flowNodeInstance.state === 'error',
          )
          .map((flowNodeInstance) => flowNodeInstance.flowNodeId);
        break;
      default:
        elementsToFocusViewOn = this.flowNodeInstances
          .filter((flowNodeInstance) => flowNodeInstance.state === 'waiting' || flowNodeInstance.state === 'active')
          .map((flowNodeInstance) => flowNodeInstance.flowNodeId);
    }

    if (elementsToFocusViewOn.length > 0) {
      await this.bpmnViewerComponentAdapter?.focusViewOnElements(elementsToFocusViewOn);
    }
  }

  private restoreMetadata(metadata: any): void {
    if (metadata?.selection != null && metadata.selection.length > 0) {
      const elementRegistry = this.bpmnViewerComponentAdapter?.getElementRegistry();
      const selection = this.bpmnViewerComponentAdapter?.getSelection();
      if (!elementRegistry || !selection) {
        return;
      }
      const elements = metadata.selection
        .map((element: BpmnDiagramShape) => elementRegistry.get(element.id))
        .filter((el): el is ElementLike => el != null);

      selection.select(elements);

      this.updateMetadata(metadata);
    }
  }

  private refreshFlowNodeOverlays(): void {
    this.bpmnViewerComponentAdapter?.onceInteractive(async () => {
      try {
        this.refreshSequenceFlowMarkers();

        const overlays: Overlay[] = [];

        assertNotNull(this.processModel, 'this.processModel');

        overlays.push(...createProcessModelOverlays(this.bifrost, this));

        for (const flowNode of getAllFlowNodes(this.processModel)) {
          overlays.push(...createFlowNodeModelOverlays(flowNode, this.bifrost, this));
        }

        const includeDataObjectOverlays = this.dataObjectDetailLevel != DataObjectDetailLevel.hideAll;
        if (includeDataObjectOverlays) {
          for (const dataObject of getAllDataObjectReferences(this.processModel)) {
            overlays.push(...createDataObjectModelOverlays(dataObject, this.bifrost, this));
          }
        }

        for (const flowNode of this.flowNodesWithInstances) {
          overlays.push(createFlowNodeInstanceCover(flowNode, this));
          overlays.push(...(await createFlowNodeInstanceOverlays(flowNode, this.bifrost, this)));
        }

        for (const dataStore of this.processModel.dataStoreReferences) {
          overlays.push(...createDataStoreOverlays(dataStore, this.bifrost, this));
        }

        this.overlays.updateAll(overlays);
      } catch (error) {
        console.error('[EngineDebugger] refreshFlowNodeOverlays failed:', error);
      }
    });
  }

  private refreshFlowNodeOverlay(flowNodeId: string): void {
    const flowNode = this.processModel
      ? getAllFlowNodes(this.processModel).find((node) => node.id === flowNodeId)
      : undefined;

    if (!flowNode) {
      return;
    }

    this.bpmnViewerComponentAdapter?.onceInteractive(async () => {
      const overlays: Overlay[] = [];

      overlays.push(...createFlowNodeModelOverlays(flowNode, this.bifrost, this));

      const executedFlowNode = this.flowNodesWithInstances.find(
        (executedFlowNode) => executedFlowNode.id === flowNode.id,
      );

      if (executedFlowNode) {
        overlays.push(createFlowNodeInstanceCover(executedFlowNode, this));
        overlays.push(...(await createFlowNodeInstanceOverlays(executedFlowNode, this.bifrost, this)));
      }

      this.overlays.update(flowNode.id, overlays);
    });
  }

  private refreshFlowNodeOverlayByInstance(id: string): void {
    const flowNodeInstance = this.flowNodeInstances.find((fni) => fni.id === id);
    if (!flowNodeInstance) {
      return;
    }
    this.refreshFlowNodeOverlay(flowNodeInstance.flowNodeId);
  }

  private refreshSequenceFlowMarkers(): void {
    const bpmnCanvas = this.bpmnViewerComponentAdapter?.getCanvas();
    if (!bpmnCanvas) {
      return;
    }
    const executedFlowIds = new Set(this.executedSequenceFlows);

    this.bpmnViewerComponentAdapter
      ?.getElementRegistry()
      .filter((element) => element.type === 'bpmn:SequenceFlow')
      .forEach((sequenceFlow) => {
        const isExecuted = executedFlowIds.has(sequenceFlow.id);
        const hasMarker = bpmnCanvas.hasMarker(sequenceFlow.id, 'connection-done');
        if (isExecuted && !hasMarker) {
          bpmnCanvas.addMarker(sequenceFlow.id, 'connection-done');
        } else if (!isExecuted && hasMarker) {
          bpmnCanvas.removeMarker(sequenceFlow.id, 'connection-done');
        }
      });

    this.refreshCompensationAssociationMarkers(bpmnCanvas);
  }

  private refreshCompensationAssociationMarkers(bpmnCanvas: any): void {
    const executedAssociationIds = new Set(this.executedCompensationAssociations);

    this.bpmnViewerComponentAdapter
      ?.getElementRegistry()
      .filter((element) => element.type === 'bpmn:Association')
      .forEach((association) => {
        const isExecuted = executedAssociationIds.has(association.id);
        const hasMarker = bpmnCanvas.hasMarker(association.id, 'association-compensation');
        if (isExecuted && !hasMarker) {
          bpmnCanvas.addMarker(association.id, 'association-compensation');
        } else if (!isExecuted && hasMarker) {
          bpmnCanvas.removeMarker(association.id, 'association-compensation');
        }
      });
  }

  private mapFlowNodeInstancesToFlowNodes(flowNodeInstances: FlowNodeInstance[]): ExecutableFlowNode[] {
    if (!this.bpmnViewerComponentAdapter) {
      return [];
    }

    const executedFlowNodes: ExecutableFlowNode[] = [];

    assertNotNull(this.processModel, 'this.processModel');

    for (const flowNodeInstance of flowNodeInstances) {
      const flowNode = executedFlowNodes.find((fn) => fn.id === flowNodeInstance.flowNodeId);

      if (flowNode) {
        flowNode.flowNodeInstances.push(flowNodeInstance);
        continue;
      }

      const shape = this.bpmnViewerComponentAdapter?.getElementRegistry().get(flowNodeInstance.flowNodeId);
      if (shape == null) {
        continue;
      }
      const newFlowNode = ShapeMappers.FlowNode(
        shape as unknown as BpmnDiagramShape,
        this.processModel,
        flowNodeInstance,
      );
      executedFlowNodes.push(newFlowNode);
    }

    return executedFlowNodes;
  }

  private buildSubProcessSanitizationMap(subProcess: BpmnFlowNode, map: SubProcessSanitizationMap): void {
    if (subProcess.typeData.type !== 'sub_process') {
      return;
    }
    const nestedSubProcesses = subProcess.typeData.flowNodes.filter(
      (flowNode) => flowNode.type === FlowNodeType.SubProcess,
    );
    nestedSubProcesses.forEach((nestedSubProcess) => {
      const nestedMap: SubProcessSanitizationMap = {
        flowNodeId: nestedSubProcess.id,
        subProcesses: [],
      };
      map.subProcesses.push(nestedMap);
      this.buildSubProcessSanitizationMap(nestedSubProcess, nestedMap);
    });
  }

  private sanitizeSelectedSubProcessInstances(partialSanitization?: string) {
    const affectedSubProcessFlowNodeIds: string[] = [];
    this.subProcessSanitizationMap?.forEach((map) =>
      this.sanitizeSubProcess(map, partialSanitization, affectedSubProcessFlowNodeIds),
    );
    if (partialSanitization) {
      if (this.processModel) {
        getAllEmbeddedSubProcesses(this.processModel)
          .filter((embeddedSubProcess) => affectedSubProcessFlowNodeIds.includes(embeddedSubProcess.id))
          .forEach((embeddedSubProcess) => {
            if (embeddedSubProcess.typeData.type === 'sub_process') {
              embeddedSubProcess.typeData.flowNodes.forEach((flowNode) => this.refreshFlowNodeOverlay(flowNode.id));
            }
            this.refreshFlowNodeOverlay(embeddedSubProcess.id);
          });
      }
    }
  }

  private sanitizeSubProcess(
    map: SubProcessSanitizationMap,
    partialSanitization?: string,
    subProcessRefreshMap?: string[],
  ) {
    if (partialSanitization && map.flowNodeId !== partialSanitization) {
      map.subProcesses.forEach((sp) => this.sanitizeSubProcess(sp, partialSanitization, subProcessRefreshMap));
      return;
    }

    subProcessRefreshMap?.push(map.flowNodeId);

    const flowNode = this.flowNodesWithInstances.find((fn) => fn.flowNodeModel?.id === map.flowNodeId);
    if (!flowNode) {
      // flow node not present. happens when no instance of a sub process flownode has been executed yet
      delete this.selectedSubProcessInstances[map.flowNodeId];
      map.subProcesses.forEach((sp) => {
        this.sanitizeSubProcess(sp, undefined, subProcessRefreshMap);
      });
      return;
    }

    if (
      !this.subProcessesWithSelectionByUser.includes(flowNode.id) &&
      flowNode.flowNodeModel &&
      this.selectedSubProcessInstances[flowNode.flowNodeModel.id] &&
      this.selectedSubProcessInstances[flowNode.flowNodeModel.id].id !== flowNode.flowNodeInstances[0]?.id
    ) {
      delete this.selectedSubProcessInstances[flowNode.flowNodeModel.id];
    }

    const flowNodeModelId = flowNode.flowNodeModel?.id;
    if (!flowNodeModelId) {
      return;
    }

    const selectedFlowNodeInstance = this.selectedSubProcessInstances[flowNodeModelId];
    const selectedFlowNodeInstanceFromFlowNode = flowNode.flowNodeInstances.find(
      (fni) =>
        fni.id === selectedFlowNodeInstance?.id &&
        getChildProcessInstanceId(fni) === getChildProcessInstanceId(selectedFlowNodeInstance),
    );
    if (!selectedFlowNodeInstance || !selectedFlowNodeInstanceFromFlowNode) {
      const flowNodeInstanceToSelect = flowNode.flowNodeInstances[0];
      if (flowNodeInstanceToSelect) {
        this.selectedSubProcessInstances[flowNodeModelId] = flowNodeInstanceToSelect;
      } else {
        delete this.selectedSubProcessInstances[flowNodeModelId];
      }
    }

    map.subProcesses.forEach((sp) => this.sanitizeSubProcess(sp, undefined, subProcessRefreshMap));
  }
}
