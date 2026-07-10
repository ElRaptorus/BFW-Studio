import type { DaemonEngineClient } from '@elraptorus/daemonengine_client';
import type {
  DataObjectValue,
  EngineInfoResponse,
  ErrorInfo,
  EventDefinitionType,
  FinalToken,
  FlowNodeInstanceState,
  FlowNodeType,
  ProcessInstanceState,
} from '@elraptorus/daemonengine_sdk';

export type EngineConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface EngineConnection {
  readonly engineId: string;
  readonly url: string;
  readonly displayName: string;
  readonly state: EngineConnectionState;
  readonly info: EngineInfoResponse | null;
  readonly client: DaemonEngineClient;
}

export interface EngineConnectionConfig {
  url: string;
  displayName?: string;
  engineId?: string;
}

export type AutoRefreshInterval = 'off' | '5s' | '10s' | '30s' | '1min' | '5min';

export const AUTO_REFRESH_INTERVALS: Record<AutoRefreshInterval, number> = {
  off: 0,
  '5s': 5_000,
  '10s': 10_000,
  '30s': 30_000,
  '1min': 60_000,
  '5min': 300_000,
};

export interface JwtClaims {
  sub?: string;
  lanes: string[];
  capabilities: string[];
  raw: Record<string, unknown>;
}

export interface FniSnapshot {
  id: string;
  processInstanceId: string;
  flowNodeId: string;
  flowNodeType: FlowNodeType;
  state: FlowNodeInstanceState;
  eventType: EventDefinitionType | null;
  laneName: string | null;
  startedAt: string;
  finishedAt: string | null;
  previousFlowNodeInstanceIds: string[];
  triggererFlowNodeInstanceId: string | null;
  inputToken: Record<string, unknown> | null;
  outputToken: Record<string, unknown> | null;
  typeProperties: Record<string, unknown> | null;
  errorInfo: ErrorInfo | null;
}

export interface CompensationRunSnapshot {
  throwType: 'throw' | 'end';
  activityRef: string | null;
  targetCount: number;
}

export interface CompensatedActivitySnapshot {
  compensatedFniId: string;
  handlerFniId: string;
  throwFniId: string;
  flowNodeId: string;
  handlerActivityId: string;
}

export interface ProcessInstanceSnapshot {
  id: string;
  state: ProcessInstanceState;
  processVersionId: string | null;
  businessKey: string | null;
  parentProcessInstanceId: string | null;
  triggererFlowNodeInstanceId: string | null;
  startedAt: string;
  finishedAt: string | null;
  startedBy: Record<string, unknown> | null;
  startedWithContext: Record<string, unknown> | null;
  finalTokens: FinalToken[] | null;
  errorInfo: ErrorInfo | null;
  dataObjectValues: DataObjectValue[];
  flowNodeInstances: FniSnapshot[];
  compensationRuns: Map<string, CompensationRunSnapshot>;
  compensatedActivities: CompensatedActivitySnapshot[];
}

export type EngineManagerEventType =
  | 'engine:connected'
  | 'engine:disconnected'
  | 'engine:connection-lost'
  | 'engine:reconnected'
  | 'engine:state-changed'
  | 'engine:info-updated'
  | 'engine:list-changed'
  | 'engine:auth-token-changed';

export interface EngineManagerEvent {
  type: EngineManagerEventType;
  engineId: string;
  url: string;
}
