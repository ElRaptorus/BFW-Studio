import type { EngineConnectionManager } from '#modules/engine-core';
import { SubscribeThenSnapshot } from '#modules/engine-core';
import type { SnapshotUpdate } from '#modules/engine-core';
import type { FniSnapshot, ProcessInstanceSnapshot } from '#modules/engine-core';
import type { DaemonEngineClient } from '@elraptorus/daemonengine_client';
import { parseBpmn } from '@elraptorus/daemonengine_sdk';
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
] as const;

type ProcessUpdatedHandler = (
  processInstance: DebuggerProcessInstance,
  processDefinition: BpmnDefinitions,
  processModel: BpmnProcess,
) => Promise<void>;

type FlowNodeInstancesUpdatedHandler = (
  flowNodeInstances: FlowNodeInstance[],
  dataObjectValues: DataObjectValue[],
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

  private pendingFniDetailIds = new Set<string>();
  private piReQueryInFlight = false;

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

  refresh = debounce(() => this.loadInitialData(), 500, { leading: true });

  dispose(): void {
    this.subscribeThenSnapshot?.dispose();
    this.subscribeThenSnapshot = null;
    this.debouncedFlushPendingFniDetails.cancel();
  }

  private async loadInitialData(): Promise<void> {
    const client = this.connectionManager.getClient(this.engineId);
    if (!client) {
      this.updateErrorHandler?.({ message: 'Engine not connected' });
      return;
    }

    try {
      this.subscribeThenSnapshot?.dispose();
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load process instance';
      this.updateErrorHandler?.({ message, statusCode: (error as { status?: number }).status });
      throw error;
    }
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

    await this.updateProcessHandler?.(this.processInstanceData, this.processDefinitionData, this.processModelData);
    this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues);
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
      })),
    };
  }

  private handleSnapshotUpdate(update: SnapshotUpdate): void {
    const { snapshot, eventType, affectedFniIds } = update;

    switch (eventType) {
      case 'pi-state-changed':
        this.handlePiStateChange(snapshot);
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

      case 'data-object-written':
        this.dataObjectValues = snapshot.dataObjectValues;
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
    this.pendingFniDetailIds.clear();

    void this.fullReQueryOnPiStateChange();
  }

  private async fullReQueryOnPiStateChange(): Promise<void> {
    if (this.piReQueryInFlight) {
      return;
    }

    const client = this.connectionManager.getClient(this.engineId);
    if (!client) {
      return;
    }

    this.piReQueryInFlight = true;
    try {
      await this.loadProcessWithXml(client);
    } catch {
      // Best-effort: the in-memory state is already updated from the WS event
    } finally {
      this.piReQueryInFlight = false;
    }
  }

  private async flushPendingFniDetails(): Promise<void> {
    const idsToFetch = [...this.pendingFniDetailIds];
    this.pendingFniDetailIds.clear();

    if (idsToFetch.length === 0) {
      this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues);
      return;
    }

    const client = this.connectionManager.getClient(this.engineId);
    if (!client) {
      this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues);
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

      this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues, newFlowNodeInstances);
    } catch {
      this.updateFlowNodeInstancesHandler?.(this.flowNodeInstances, this.dataObjectValues);
    }
  }

  private async resolveBpmnXmlForProcessVersion(
    client: DaemonEngineClient,
    processVersionId: string,
  ): Promise<{ bpmnXml: string; processModelId: string; version?: string }> {
    if (!processVersionId) {
      return { bpmnXml: '', processModelId: '' };
    }

    try {
      const allProcesses = await client.processes.getAll();
      for (const process of allProcesses) {
        const processModelId = process.id;
        if (process.versionId === processVersionId) {
          const detail = await client.processes.get(processModelId, { includeXml: true });
          return { bpmnXml: detail.bpmnXml ?? '', processModelId, version: detail.version };
        }

        const versions = await client.processes.getVersions(processModelId);
        if (versions.some((versionEntry) => versionEntry.versionId === processVersionId)) {
          const versionsWithXml = await client.processes.getVersions(processModelId, { includeXml: true });
          const matchedVersion = versionsWithXml.find((versionEntry) => versionEntry.versionId === processVersionId);
          return {
            bpmnXml: matchedVersion?.bpmnXml ?? '',
            processModelId,
            version: matchedVersion?.version,
          };
        }
      }
    } catch {
      return { bpmnXml: '', processModelId: '' };
    }

    return { bpmnXml: '', processModelId: '' };
  }
}
