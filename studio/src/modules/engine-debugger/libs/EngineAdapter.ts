import type { EngineConnectionManager } from '#modules/engine-core';
import { SubscribeThenSnapshot } from '#modules/engine-core';
import type { SnapshotUpdate } from '#modules/engine-core';
import type {
  CompensatedActivitySnapshot,
  CompensationRunSnapshot,
  FniSnapshot,
  ProcessInstanceSnapshot,
} from '#modules/engine-core';
import type { DaemonEngineClient } from '@elraptorus/daemonengine_client';
import { FlowNodeType, parseBpmn } from '@elraptorus/daemonengine_sdk';
import type {
  DataObjectValue,
  FlowNodeInstance,
  ProcessInstance,
  ProcessInstanceField,
} from '@elraptorus/daemonengine_sdk';
import type { BpmnDefinitions, BpmnProcess } from '@elraptorus/daemonengine_sdk';
import debounce from 'lodash.debounce';

import type { DebuggerBaseError, DebuggerProcessInstance } from '../types/DebuggerTypes';
import { findProcessInDefinitions } from './BpmnProcessHelpers';

const ALL_FNI_FIELDS = [
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
] as const;

type ProcessUpdatedHandler = (
  processInstance: DebuggerProcessInstance,
  processDefinition: BpmnDefinitions,
  processModel: BpmnProcess,
) => Promise<void>;

type FlowNodeInstancesUpdatedHandler = (
  flowNodeInstances: FlowNodeInstance[],
  dataObjectValues: DataObjectValue[],
  compensatedActivities: CompensatedActivitySnapshot[],
  newFlowNodeInstances?: FlowNodeInstance[],
) => void;

function createEmptyProcess(processModelId: string): BpmnProcess {
  return {
    id: processModelId,
    name: null,
    version: null,
    isExecutable: false,
    correlationKey: null,
    flowNodes: [],
    sequenceFlows: [],
    lanes: [],
    dataObjects: [],
    dataObjectReferences: [],
    dataStores: [],
    dataStoreReferences: [],
    extensions: [],
    linterScores: [],
  };
}

function fniSnapshotToFlowNodeInstance(snapshot: FniSnapshot): FlowNodeInstance {
  return {
    id: snapshot.id,
    processInstanceId: snapshot.processInstanceId,
    flowNodeId: snapshot.flowNodeId,
    flowNodeType: snapshot.flowNodeType,
    eventType: snapshot.eventType,
    laneName: snapshot.laneName,
    state: snapshot.state,
    startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt,
    previousFlowNodeInstanceIds: snapshot.previousFlowNodeInstanceIds,
    triggererFlowNodeInstanceId: snapshot.triggererFlowNodeInstanceId,
    inputToken: snapshot.inputToken,
    outputToken: snapshot.outputToken,
    typeProperties: snapshot.typeProperties,
    errorInfo: snapshot.errorInfo,
    multiInstanceId: snapshot.multiInstanceId,
    iterationIndex: snapshot.iterationIndex,
  };
}

/**
 * Real-time process instance adapter using full-data initial load and
 * WS-event-driven batched GraphQL detail fetches.
 */
export class EngineAdapter {
  private readonly processInstanceId: string;
  private readonly engineId: string;
  private readonly connectionManager: EngineConnectionManager;
  private subscribeThenSnapshot: SubscribeThenSnapshot | null = null;
  private processInstanceData: DebuggerProcessInstance | null = null;
  private processDefinitionData: BpmnDefinitions | null = null;
  private processModelData: BpmnProcess | null = null;
  private flowNodeInstances: FlowNodeInstance[] = [];
  private dataObjectValues: DataObjectValue[] = [];
  private compensationRuns = new Map<string, CompensationRunSnapshot>();
  private compensatedActivities: CompensatedActivitySnapshot[] = [];

  private pendingFniDetailIds = new Set<string>();

  private loadInProgress = false;
  private pendingReload = false;
  private fullLoadInProgress = false;

  private updateErrorHandler: ((error: DebuggerBaseError) => void) | null = null;
  private updateProcessHandler: ProcessUpdatedHandler | null = null;
  private updateFlowNodeInstancesHandler: FlowNodeInstancesUpdatedHandler | null = null;

  private readonly debouncedFlushPendingFniDetails = debounce(() => {
    void this.flushPendingFniDetails();
  }, 500);

  constructor(processInstanceId: string, engineId: string, connectionManager: EngineConnectionManager) {
    this.processInstanceId = processInstanceId;
    this.engineId = engineId;
    this.connectionManager = connectionManager;
  }

  onError(handler: (error: DebuggerBaseError) => void): void {
    this.updateErrorHandler = handler;
  }

  onProcessUpdated(handler: ProcessUpdatedHandler): void {
    this.updateProcessHandler = handler;
  }

  onFlowNodeInstancesUpdated(handler: FlowNodeInstancesUpdatedHandler): void {
    this.updateFlowNodeInstancesHandler = handler;
  }

  async initialize(): Promise<void> {
    return this.loadInitialData();
  }

  async refresh(): Promise<void> {
    if (this.loadInProgress) {
      this.pendingReload = true;
      return;
    }
    await this.loadInitialData();
  }

  dispose(): void {
    this.subscribeThenSnapshot?.dispose();
    this.subscribeThenSnapshot = null;
    this.debouncedFlushPendingFniDetails.cancel();
    this.pendingFniDetailIds.clear();
    this.pendingReload = false;
  }

  private async loadInitialData(): Promise<void> {
    const client = this.connectionManager.getClient(this.engineId);
    if (!client) {
      this.updateErrorHandler?.({ message: 'Engine not connected' });
      return;
    }

    this.loadInProgress = true;
    this.pendingReload = false;
    this.fullLoadInProgress = true;

    try {
      this.subscribeThenSnapshot?.dispose();
      this.debouncedFlushPendingFniDetails.cancel();
      this.pendingFniDetailIds.clear();

      const snapshot = new SubscribeThenSnapshot(this.connectionManager, this.engineId, this.processInstanceId);
      this.subscribeThenSnapshot = snapshot;

      await snapshot.subscribe((update: SnapshotUpdate) => {
        this.handleSnapshotUpdate(update);
      });

      if (this.subscribeThenSnapshot !== snapshot) {
        return;
      }

      await this.loadProcessWithXml(client);

      if (this.subscribeThenSnapshot !== snapshot) {
        return;
      }

      const initialSnapshot = this.buildSnapshotFromCurrentData();
      snapshot.setInitialSnapshot(initialSnapshot);

      this.mergeSnapshotIntoLoadedData(snapshot);
      this.fullLoadInProgress = false;

      this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues, [
        ...this.compensatedActivities,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load process instance';
      this.updateErrorHandler?.({ message, statusCode: (error as { status?: number }).status });
      throw error;
    } finally {
      this.fullLoadInProgress = false;
      this.loadInProgress = false;

      if (this.pendingReload) {
        this.pendingReload = false;
        void this.loadInitialData();
      }
    }
  }

  /**
   * After setInitialSnapshot drains buffered WS events, the WS-layer
   * snapshot may contain state changes that occurred during the GraphQL
   * load window. Merge those into the adapter's cached arrays so the
   * final handler callback has the most up-to-date data.
   */
  private mergeSnapshotIntoLoadedData(subscribeThenSnapshot: SubscribeThenSnapshot): void {
    const currentSnapshot = subscribeThenSnapshot.getSnapshot();
    if (!currentSnapshot) {
      return;
    }

    if (this.processInstanceData) {
      this.processInstanceData = {
        ...this.processInstanceData,
        state: currentSnapshot.state,
      };
    }

    for (const fniSnapshot of currentSnapshot.flowNodeInstances) {
      const existingIndex = this.flowNodeInstances.findIndex((fni) => fni.id === fniSnapshot.id);
      if (existingIndex >= 0) {
        const existing = this.flowNodeInstances[existingIndex];
        this.flowNodeInstances[existingIndex] = {
          ...existing,
          state: fniSnapshot.state,
          typeProperties: fniSnapshot.typeProperties ?? existing.typeProperties,
          errorInfo: fniSnapshot.errorInfo ?? existing.errorInfo,
          multiInstanceId: fniSnapshot.multiInstanceId ?? existing.multiInstanceId,
          iterationIndex: fniSnapshot.iterationIndex ?? existing.iterationIndex,
        };
      } else {
        this.flowNodeInstances.push(fniSnapshotToFlowNodeInstance(fniSnapshot));
      }
    }

    this.dataObjectValues = currentSnapshot.dataObjectValues;
    this.compensationRuns = currentSnapshot.compensationRuns;
    this.compensatedActivities = currentSnapshot.compensatedActivities;
  }

  private async loadProcessWithXml(client: DaemonEngineClient): Promise<void> {
    const processInstanceRecord = (await client.graphql.getProcessInstance(this.processInstanceId, {
      fields: [
        'id',
        'state',
        'processVersionId',
        'businessKey',
        'parentProcessInstanceId',
        'triggererFlowNodeInstanceId',
        'startedAt',
        'finishedAt',
        'startedBy',
        'startedWithContext',
        'errorInfo' as ProcessInstanceField,
      ],
      include: {
        flowNodeInstances: {
          fields: [...ALL_FNI_FIELDS],
        },
        dataObjectValues: {
          fields: ['id', 'dataObjectId', 'flowNodeInstanceId', 'value', 'createdAt', 'processInstanceId'],
        },
      },
    })) as ProcessInstance | null;

    if (!processInstanceRecord) {
      throw new Error(`Process instance ${this.processInstanceId} not found on the engine.`);
    }

    const processVersionId = processInstanceRecord.processVersionId ?? '';
    const { bpmnXml, processModelId, version } = await this.resolveBpmnXmlForProcessVersion(client, processVersionId);

    const parsed = parseBpmn(bpmnXml);
    const parsedProcess = findProcessInDefinitions(parsed, processModelId) ?? createEmptyProcess(processModelId);

    this.processDefinitionData = parsed;
    this.processModelData = parsedProcess;

    const fniList = processInstanceRecord.flowNodeInstances ?? [];
    this.flowNodeInstances = fniList;

    this.dataObjectValues = (processInstanceRecord.dataObjectValues ?? []).map((entry) => ({
      id: entry.id,
      processInstanceId: entry.processInstanceId ?? this.processInstanceId,
      dataObjectId: entry.dataObjectId,
      flowNodeInstanceId: entry.flowNodeInstanceId,
      value: entry.value,
      createdAt: entry.createdAt,
    }));

    this.processInstanceData = {
      id: processInstanceRecord.id,
      state: processInstanceRecord.state,
      processVersionId: processInstanceRecord.processVersionId,
      businessKey: processInstanceRecord.businessKey,
      parentProcessInstanceId: processInstanceRecord.parentProcessInstanceId,
      triggererFlowNodeInstanceId: processInstanceRecord.triggererFlowNodeInstanceId,
      startedAt: processInstanceRecord.startedAt,
      finishedAt: processInstanceRecord.finishedAt,
      startedBy: processInstanceRecord.startedBy,
      startedWithContext: processInstanceRecord.startedWithContext,
      finalTokens: processInstanceRecord.finalTokens ?? null,
      errorInfo: processInstanceRecord.errorInfo ?? null,
      processModelId,
      version,
      xml: bpmnXml,
    };

    await this.loadEmbeddedSubprocessChildFnis(client);

    await this.updateProcessHandler?.(this.processInstanceData, this.processDefinitionData, this.processModelData);
    this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues, [
      ...this.compensatedActivities,
    ]);
  }

  private buildSnapshotFromCurrentData(): ProcessInstanceSnapshot {
    return {
      id: this.processInstanceData?.id ?? this.processInstanceId,
      state: this.processInstanceData?.state ?? ('running' as any),
      processVersionId: this.processInstanceData?.processVersionId ?? null,
      businessKey: this.processInstanceData?.businessKey ?? null,
      parentProcessInstanceId: this.processInstanceData?.parentProcessInstanceId ?? null,
      triggererFlowNodeInstanceId: this.processInstanceData?.triggererFlowNodeInstanceId ?? null,
      startedAt: this.processInstanceData?.startedAt ?? '',
      finishedAt: this.processInstanceData?.finishedAt ?? null,
      startedBy: this.processInstanceData?.startedBy ?? null,
      startedWithContext: this.processInstanceData?.startedWithContext ?? null,
      finalTokens: this.processInstanceData?.finalTokens ?? null,
      errorInfo: this.processInstanceData?.errorInfo ?? null,
      dataObjectValues: [...this.dataObjectValues],
      flowNodeInstances: this.flowNodeInstances.map((fni) => ({
        id: fni.id,
        processInstanceId: fni.processInstanceId,
        flowNodeId: fni.flowNodeId,
        flowNodeType: fni.flowNodeType,
        state: fni.state,
        eventType: fni.eventType,
        laneName: fni.laneName,
        startedAt: fni.startedAt,
        finishedAt: fni.finishedAt,
        previousFlowNodeInstanceIds: fni.previousFlowNodeInstanceIds,
        triggererFlowNodeInstanceId: fni.triggererFlowNodeInstanceId,
        inputToken: fni.inputToken,
        outputToken: fni.outputToken,
        typeProperties: fni.typeProperties,
        errorInfo: fni.errorInfo,
        multiInstanceId: fni.multiInstanceId,
        iterationIndex: fni.iterationIndex,
      })),
      compensationRuns: new Map(),
      compensatedActivities: [],
    };
  }

  private handleSnapshotUpdate(update: SnapshotUpdate): void {
    if (this.fullLoadInProgress) {
      return;
    }

    const { snapshot, eventType, affectedFniIds } = update;

    switch (eventType) {
      case 'pi-state-changed':
        this.handlePiStateChange(snapshot);
        break;

      case 'child-pi-state-changed':
        this.applyFniSnapshotUpdates(snapshot);
        this.debouncedFlushPendingFniDetails();
        break;

      case 'fni-started':
      case 'fni-finished':
      case 'call-activity-child':
        this.applyFniSnapshotUpdates(snapshot);
        for (const id of affectedFniIds) {
          this.pendingFniDetailIds.add(id);
        }
        this.debouncedFlushPendingFniDetails();
        break;

      case 'subprocess-child':
        this.applyFniSnapshotUpdates(snapshot);
        for (const id of affectedFniIds) {
          this.pendingFniDetailIds.add(id);
        }
        void this.loadNewSubprocessChildFnis(affectedFniIds);
        this.debouncedFlushPendingFniDetails();
        break;

      case 'data-object-written':
        this.dataObjectValues = snapshot.dataObjectValues;
        this.debouncedFlushPendingFniDetails();
        break;

      case 'compensation-triggered':
      case 'activity-compensated':
        this.applyFniSnapshotUpdates(snapshot);
        for (const id of affectedFniIds) {
          this.pendingFniDetailIds.add(id);
        }
        this.debouncedFlushPendingFniDetails();
        break;

      case 'mi-started':
      case 'mi-completed':
        this.applyFniSnapshotUpdates(snapshot);
        for (const id of affectedFniIds) {
          this.pendingFniDetailIds.add(id);
        }
        this.debouncedFlushPendingFniDetails();
        break;
    }
  }

  private applyFniSnapshotUpdates(snapshot: ProcessInstanceSnapshot): void {
    for (const fniSnapshot of snapshot.flowNodeInstances) {
      const existingIndex = this.flowNodeInstances.findIndex((fni) => fni.id === fniSnapshot.id);
      if (existingIndex >= 0) {
        const existing = this.flowNodeInstances[existingIndex];
        this.flowNodeInstances[existingIndex] = {
          ...existing,
          state: fniSnapshot.state,
          typeProperties: fniSnapshot.typeProperties ?? existing.typeProperties,
          errorInfo: fniSnapshot.errorInfo ?? existing.errorInfo,
          multiInstanceId: fniSnapshot.multiInstanceId ?? existing.multiInstanceId,
          iterationIndex: fniSnapshot.iterationIndex ?? existing.iterationIndex,
        };
      } else {
        this.flowNodeInstances.push(fniSnapshotToFlowNodeInstance(fniSnapshot));
      }
    }
  }

  private handlePiStateChange(snapshot: ProcessInstanceSnapshot): void {
    if (this.processInstanceData) {
      this.processInstanceData = {
        ...this.processInstanceData,
        state: snapshot.state,
        parentProcessInstanceId: snapshot.parentProcessInstanceId,
        businessKey: snapshot.businessKey,
      };
    }

    this.debouncedFlushPendingFniDetails.cancel();

    void this.refresh();
  }

  private async flushPendingFniDetails(): Promise<void> {
    const idsToFetch = [...this.pendingFniDetailIds];
    this.pendingFniDetailIds.clear();

    if (idsToFetch.length === 0) {
      this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues, [
        ...this.compensatedActivities,
      ]);
      return;
    }

    const client = this.connectionManager.getClient(this.engineId);
    if (!client) {
      this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues, [
        ...this.compensatedActivities,
      ]);
      return;
    }

    try {
      const result = await client.graphql.queryFlowNodeInstances({
        fields: [...ALL_FNI_FIELDS],
        filter: { id: { in: idsToFetch } },
      });

      const newFlowNodeInstances: FlowNodeInstance[] = [];

      for (const fetchedFni of result.data) {
        const existingIndex = this.flowNodeInstances.findIndex((fni) => fni.id === fetchedFni.id);
        if (existingIndex >= 0) {
          this.flowNodeInstances[existingIndex] = { ...this.flowNodeInstances[existingIndex], ...fetchedFni };
        } else {
          this.flowNodeInstances.push(fetchedFni);
          newFlowNodeInstances.push(fetchedFni);
        }
      }

      this.updateFlowNodeInstancesHandler?.(
        this.flowNodeInstances,
        this.dataObjectValues,
        [...this.compensatedActivities],
        newFlowNodeInstances,
      );
    } catch {
      this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues, [
        ...this.compensatedActivities,
      ]);
    }
  }

  /**
   * Recursively loads FNIs and data object values for embedded subprocess
   * child PIs. Call Activity children are intentionally excluded — they
   * use a different BPMN process and open in separate debugger tabs.
   *
   * Returns the list of newly added FNIs so callers can trigger
   * incremental overlay refresh instead of a full rebuild.
   */
  private async loadEmbeddedSubprocessChildFnis(client: DaemonEngineClient): Promise<FlowNodeInstance[]> {
    const loadedPiIds = new Set(this.flowNodeInstances.map((fni) => fni.processInstanceId));
    let childPiIds = this.collectSubprocessChildPiIds(this.flowNodeInstances).filter((id) => !loadedPiIds.has(id));
    const allNewFnis: FlowNodeInstance[] = [];

    while (childPiIds.length > 0) {
      try {
        const [fniResult, dovResult] = await Promise.all([
          client.graphql.queryFlowNodeInstances({
            fields: [...ALL_FNI_FIELDS],
            filter: { processInstanceId: { in: childPiIds } },
          }),
          client.graphql.queryDataObjectValues({
            fields: ['id', 'dataObjectId', 'flowNodeInstanceId', 'value', 'createdAt', 'processInstanceId'],
            filter: { processInstanceId: { in: childPiIds } },
          }),
        ]);

        for (const fni of fniResult.data) {
          if (!this.flowNodeInstances.some((existing) => existing.id === fni.id)) {
            this.flowNodeInstances.push(fni);
            allNewFnis.push(fni);
          }
        }

        for (const dov of dovResult.data) {
          if (!this.dataObjectValues.some((existing) => existing.id === dov.id)) {
            this.dataObjectValues.push({
              id: dov.id,
              processInstanceId: dov.processInstanceId ?? '',
              dataObjectId: dov.dataObjectId,
              flowNodeInstanceId: dov.flowNodeInstanceId,
              value: dov.value,
              createdAt: dov.createdAt,
            });
          }
        }

        for (const id of childPiIds) {
          loadedPiIds.add(id);
        }
        childPiIds = this.collectSubprocessChildPiIds(fniResult.data).filter((id) => !loadedPiIds.has(id));
      } catch {
        break;
      }
    }

    return allNewFnis;
  }

  /**
   * Triggered by a `SubProcessChildStarted` event arriving in real time.
   * Loads FNIs for the newly spawned child PI so overlays can render on
   * inner subprocess flow nodes immediately.
   */
  private async loadNewSubprocessChildFnis(affectedFniIds: string[]): Promise<void> {
    const hasSubprocessShell = affectedFniIds.some((id) => {
      const fni = this.flowNodeInstances.find((existing) => existing.id === id);
      return fni?.flowNodeType === FlowNodeType.SubProcess;
    });

    if (!hasSubprocessShell) {
      return;
    }

    const client = this.connectionManager.getClient(this.engineId);
    if (!client) {
      return;
    }

    try {
      const newFnis = await this.loadEmbeddedSubprocessChildFnis(client);
      this.updateFlowNodeInstancesHandler?.(
        this.flowNodeInstances,
        this.dataObjectValues,
        [...this.compensatedActivities],
        newFnis,
      );
    } catch {
      this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues, [
        ...this.compensatedActivities,
      ]);
    }
  }

  private collectSubprocessChildPiIds(fniList: FlowNodeInstance[]): string[] {
    return fniList
      .filter((fni) => fni.flowNodeType === FlowNodeType.SubProcess)
      .map((fni) => {
        const typeProperties = fni.typeProperties as Record<string, unknown> | null;
        return (typeProperties?.['childProcessInstanceId'] ?? typeProperties?.['child_process_instance_id']) as
          string | undefined;
      })
      .filter((id): id is string => typeof id === 'string');
  }

  private async resolveBpmnXmlForProcessVersion(
    client: DaemonEngineClient,
    processVersionId: string,
  ): Promise<{ bpmnXml: string; processModelId: string; version?: string }> {
    if (!processVersionId) {
      return { bpmnXml: '', processModelId: '' };
    }

    try {
      const result = await client.graphql.queryProcessVersions({
        fields: ['id', 'version', 'bpmnXml'],
        filter: { id: { eq: processVersionId } },
        pagination: { mode: 'offset', limit: 1, offset: 0 },
      });

      const match = result.data[0];
      if (match?.bpmnXml) {
        const parsed = parseBpmn(match.bpmnXml);
        const executableProcess = parsed.processes.find((process) => process.isExecutable);
        return {
          bpmnXml: match.bpmnXml,
          processModelId: executableProcess?.id ?? parsed.processes[0]?.id ?? '',
          version: match.version,
        };
      }
    } catch {
      return { bpmnXml: '', processModelId: '' };
    }

    return { bpmnXml: '', processModelId: '' };
  }
}
