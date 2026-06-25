import type { DaemonEngineClient, Subscription } from '@elraptorus/daemonengine_client';
import type {
  CallActivityChildStarted,
  DataObjectWritten,
  EngineEventEnvelope,
  FlowNodeInstanceFinished,
  FlowNodeInstanceStarted,
  FlowNodeInstanceStateChanged,
  ProcessInstanceStateChanged,
  SubProcessChildStarted,
} from '@elraptorus/daemonengine_sdk';

import type { EngineConnectionManager } from './EngineConnectionManager';
import type { ProcessInstanceSnapshot } from './types';

export type SnapshotEventType =
  | 'fni-started'
  | 'fni-finished'
  | 'fni-state-changed'
  | 'call-activity-child'
  | 'subprocess-child'
  | 'data-object-written'
  | 'pi-state-changed'
  | 'child-pi-state-changed';

export interface SnapshotUpdate {
  snapshot: ProcessInstanceSnapshot;
  eventType: SnapshotEventType;
  affectedFniIds: string[];
}

export type SnapshotUpdateHandler = (update: SnapshotUpdate) => void;

/**
 * WS event handler for PI-scoped real-time updates.
 *
 * Uses a subscribe-before-load pattern: the WS subscription is established
 * before the initial full data load begins. Events that arrive while the
 * initial load is in flight are buffered and drained once the snapshot is set.
 * This guarantees zero missed events without overwriting the loaded data.
 */
export class SubscribeThenSnapshot {
  private readonly client: DaemonEngineClient;
  private subscription: Subscription | null = null;
  private snapshot: ProcessInstanceSnapshot | null = null;
  private updateHandler: SnapshotUpdateHandler | null = null;
  private disposed = false;
  private bufferedEvents: EngineEventEnvelope[] | null = [];

  constructor(
    private readonly connectionManager: EngineConnectionManager,
    private readonly engineId: string,
    private readonly processInstanceId: string,
  ) {
    const client = this.connectionManager.getClient(engineId);
    if (!client) {
      throw new Error(`No client for engine ${engineId}`);
    }
    this.client = client;
  }

  /**
   * Phase 1: Subscribe to the WS channel and start buffering events.
   * Call this BEFORE the initial data load so no events are missed.
   */
  async subscribe(onUpdate: SnapshotUpdateHandler): Promise<void> {
    this.updateHandler = onUpdate;
    this.bufferedEvents = [];

    await this.client.notifications.connect();
    this.subscription = await this.client.notifications.subscribeProcessInstance(
      this.processInstanceId,
      (envelope: EngineEventEnvelope) => {
        this.handleEvent(envelope);
      },
    );
  }

  /**
   * Phase 2: Set the initial snapshot (built from the full data load) and
   * drain any WS events that arrived during the load. After this call,
   * events are processed and forwarded immediately.
   */
  setInitialSnapshot(initialSnapshot: ProcessInstanceSnapshot): void {
    this.snapshot = initialSnapshot;

    const pendingEvents = this.bufferedEvents ?? [];
    this.bufferedEvents = null;

    for (const envelope of pendingEvents) {
      this.handleEvent(envelope);
    }
  }

  getSnapshot(): ProcessInstanceSnapshot | null {
    return this.snapshot;
  }

  dispose(): void {
    this.disposed = true;
    this.subscription?.dispose();
    this.subscription = null;
    this.snapshot = null;
    this.updateHandler = null;
    this.bufferedEvents = null;
  }

  private handleEvent(envelope: EngineEventEnvelope): void {
    if (this.disposed) {
      return;
    }

    if (!this.snapshot) {
      this.bufferedEvents?.push(envelope);
      return;
    }

    let eventType: SnapshotEventType | null = null;
    const affectedFniIds: string[] = [];

    switch (envelope.type) {
      case 'FlowNodeInstanceStarted': {
        const event = envelope.data as FlowNodeInstanceStarted;
        this.handleFniStarted(event);
        eventType = 'fni-started';
        affectedFniIds.push(event.flowNodeInstanceId);
        break;
      }
      case 'FlowNodeInstanceFinished': {
        const event = envelope.data as FlowNodeInstanceFinished;
        this.handleFniFinished(event);
        eventType = 'fni-finished';
        affectedFniIds.push(event.flowNodeInstanceId);
        break;
      }
      case 'FlowNodeInstanceStateChanged': {
        const event = envelope.data as FlowNodeInstanceStateChanged;
        this.handleFniStateChanged(event);
        eventType = 'fni-state-changed';
        affectedFniIds.push(event.flowNodeInstanceId);
        break;
      }
      case 'ProcessInstanceStateChanged': {
        const piEvent = envelope.data as ProcessInstanceStateChanged;
        if (piEvent.processInstanceId === this.processInstanceId) {
          this.handlePiStateChanged(piEvent);
          eventType = 'pi-state-changed';
        } else {
          eventType = 'child-pi-state-changed';
        }
        break;
      }
      case 'CallActivityChildStarted': {
        const event = envelope.data as CallActivityChildStarted;
        this.handleCallActivityChild(event);
        eventType = 'call-activity-child';
        affectedFniIds.push(event.callActivityFlowNodeInstanceId);
        break;
      }
      case 'SubProcessChildStarted': {
        const event = envelope.data as SubProcessChildStarted;
        this.handleSubProcessChild(event);
        eventType = 'subprocess-child';
        affectedFniIds.push(event.subprocessFlowNodeInstanceId);
        break;
      }
      case 'DataObjectWritten':
        this.handleDataObjectWritten(envelope.data as DataObjectWritten);
        eventType = 'data-object-written';
        break;
    }

    if (eventType) {
      this.updateHandler?.({ snapshot: this.snapshot, eventType, affectedFniIds });
    }
  }

  private handleFniStarted(event: FlowNodeInstanceStarted): void {
    if (!this.snapshot) {
      return;
    }

    const existing = this.snapshot.flowNodeInstances.find((fni) => fni.id === event.flowNodeInstanceId);
    if (existing) {
      existing.state = 'active' as any;
      return;
    }

    this.snapshot.flowNodeInstances.push({
      id: event.flowNodeInstanceId,
      processInstanceId: event.processInstanceId,
      flowNodeId: event.flowNodeId,
      flowNodeType: event.flowNodeType as any,
      state: 'active' as any,
      eventType: (event.eventType as any) ?? null,
      laneName: null,
      startedAt: event.occurredAt ?? '',
      finishedAt: null,
      previousFlowNodeInstanceIds: [],
      triggererFlowNodeInstanceId: null,
      inputToken: null,
      outputToken: null,
      typeProperties: null,
      errorInfo: null,
    });
  }

  private handleFniFinished(event: FlowNodeInstanceFinished): void {
    if (!this.snapshot) {
      return;
    }

    const fni = this.snapshot.flowNodeInstances.find((overlay) => overlay.id === event.flowNodeInstanceId);
    if (fni) {
      fni.state = event.terminalState as any;
      if (event.typeProperties && Object.keys(event.typeProperties).length > 0) {
        fni.typeProperties = { ...(fni.typeProperties ?? {}), ...event.typeProperties };
      }
      if (event.errorInfo) {
        fni.errorInfo = event.errorInfo;
      }
    }
  }

  private handleFniStateChanged(event: FlowNodeInstanceStateChanged): void {
    if (!this.snapshot) {
      return;
    }

    const fni = this.snapshot.flowNodeInstances.find((overlay) => overlay.id === event.flowNodeInstanceId);
    if (fni) {
      fni.state = event.newState as any;
    }
  }

  private handlePiStateChanged(event: ProcessInstanceStateChanged): void {
    if (!this.snapshot) {
      return;
    }
    this.snapshot.state = event.newState as any;
  }

  private handleCallActivityChild(event: CallActivityChildStarted): void {
    if (!this.snapshot) {
      return;
    }
    const fni = this.snapshot.flowNodeInstances.find((overlay) => overlay.id === event.callActivityFlowNodeInstanceId);
    if (fni) {
      fni.typeProperties = {
        ...(fni.typeProperties ?? {}),
        childProcessInstanceId: event.childProcessInstanceId,
      };
    }
  }

  private handleSubProcessChild(event: SubProcessChildStarted): void {
    if (!this.snapshot) {
      return;
    }
    const fni = this.snapshot.flowNodeInstances.find((overlay) => overlay.id === event.subprocessFlowNodeInstanceId);
    if (fni) {
      fni.typeProperties = {
        ...(fni.typeProperties ?? {}),
        childProcessInstanceId: event.childProcessInstanceId,
      };
    }
  }

  private handleDataObjectWritten(event: DataObjectWritten): void {
    if (!this.snapshot) {
      return;
    }

    this.snapshot.dataObjectValues.push({
      id: event.writeId,
      processInstanceId: event.processInstanceId,
      dataObjectId: event.dataObjectId,
      flowNodeInstanceId: event.flowNodeInstanceId,
      value: event.value,
      createdAt: event.createdAt,
    });
  }
}
