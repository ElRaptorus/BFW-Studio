import type { Bifrost } from '#bifrost/Bifrost';

import { EngineConnectionManager } from './EngineConnectionManager';
import { WebSocketBridge } from './WebSocketBridge';
import registerAuthCommands from './commands/registerAuthCommands';
import registerConfiguredRetryCommands from './commands/registerConfiguredRetryCommands';
import registerConfiguredStartCommands from './commands/registerConfiguredStartCommands';
import registerConnectionCommands from './commands/registerConnectionCommands';
import registerDeployCommands from './commands/registerDeployCommands';
import registerEventCommands from './commands/registerEventCommands';
import registerProcessInstanceCommands from './commands/registerProcessInstanceCommands';
import registerSettings from './settings/registerSettings';

export { EngineConnectionManager } from './EngineConnectionManager';
export type { HealthOverrideLevel } from './EngineConnectionManager';
export { JwtIdentityManager } from './JwtIdentityManager';
export type { EngineCapability } from './JwtIdentityManager';
export { SubscribeThenSnapshot } from './SubscribeThenSnapshot';
export type { SnapshotUpdate, SnapshotUpdateHandler } from './SubscribeThenSnapshot';
export { WebSocketBridge } from './WebSocketBridge';
export { EventDrivenRefresh } from './services/EventDrivenRefresh';
export { checkEngineConnectivity, extractEngineIdFromUri } from './helpers/checkEngineConnectivity';

export { EngineContextBreadcrumb } from './components/EngineContextBreadcrumb';
export { EngineHealthBadge, resolveHealthState } from './components/EngineHealthBadge';
export type { EngineHealthState } from './components/EngineHealthBadge';
export { EngineVersionGate } from './components/EngineVersionGate';
export { FlowNodeIcon } from './components/FlowNodeIcon';
export { LoadingIndicator } from './components/LoadingIndicator';
export { NoAuthTokenHint } from './components/NoAuthTokenHint';
export { PaneLoadingWrapper } from './components/PaneLoadingWrapper';
export { ProcessInstanceStateBadge } from './components/ProcessInstanceStateBadge';

export { useAsyncAction } from './hooks/useAsyncAction';

export * from './Formatters';
export { resolveFlowNodeIconName } from './FlowNodeIconResolver';

export { ENGINE_COMMANDS } from './commands/CommandContract';
export type { EngineCommandId } from './commands/CommandContract';
export type { EngineCommandArgs } from './commands/CommandContract';

export type { RetryContext, RetryResult } from './commands/registerConfiguredRetryCommands';
export { formatDeployErrorMessage } from './commands/registerDeployCommands';
export type { DeployFailureDetail } from './commands/registerDeployCommands';

export type {
  AutoRefreshInterval,
  EngineConnection,
  EngineConnectionConfig,
  EngineConnectionState,
  EngineManagerEvent,
  EngineManagerEventType,
  FniSnapshot,
  JwtClaims,
  ProcessInstanceSnapshot,
} from './types';
export { AUTO_REFRESH_INTERVALS } from './types';

export { SETTINGS_KEYS } from './settings/registerSettings';

export async function onLoad(bifrost: Bifrost): Promise<void> {
  registerSettings(bifrost);

  const connectionManager = new EngineConnectionManager(bifrost);
  const webSocketBridge = new WebSocketBridge(connectionManager);

  registerConnectionCommands(bifrost, connectionManager);
  registerDeployCommands(bifrost, connectionManager);
  registerProcessInstanceCommands(bifrost, connectionManager);
  registerConfiguredStartCommands(bifrost, connectionManager);
  registerConfiguredRetryCommands(bifrost, connectionManager);
  registerEventCommands(bifrost, connectionManager);
  registerAuthCommands(bifrost, connectionManager);

  bifrost.registerSharedRessource('engineConnectionManager', connectionManager);
  bifrost.registerSharedRessource('engineWebSocketBridge', webSocketBridge);
}
