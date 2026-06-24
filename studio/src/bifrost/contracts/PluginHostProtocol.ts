import type { PluginPermission } from '#bifrost/common/plugin-host/permissions/PermissionTypes';

export type {
  ApiRequestPayload,
  ApiResponsePayload,
  CallbackInvocationPayload,
  RegisterCallbackPayload,
} from './PluginHostTypes';

export const PLUGIN_HOST_PROTOCOL_VERSION = 1;

// ─── Base message shape ─────────────────────────────────────────────

export interface PluginHostMessage {
  protocolVersion: typeof PLUGIN_HOST_PROTOCOL_VERSION;
  type: string;
  requestId?: string;
  payload?: unknown;
}

// ─── Lifecycle ──────────────────────────────────────────────────────

export const PH_HOST_READY = 'host.ready';
export const PH_HOST_DISPOSE = 'host.dispose';

// ─── Plugin loading ─────────────────────────────────────────────────

export const PH_LOAD_PLUGIN = 'host.loadPlugin';
export const PH_PLUGIN_LOADED = 'host.pluginLoaded';

export interface LoadPluginPayload {
  pluginPath: string;
  pluginName: string;
  permissions: PluginPermission[];
}

export interface PluginLoadedPayload {
  pluginName: string;
  success: boolean;
  error?: string;
}

// ─── Selective plugin unload / reload ────────────────────────────────

export const PH_UNLOAD_PLUGIN = 'host.unloadPlugin';
export const PH_RELOAD_PLUGIN = 'host.reloadPlugin';

export interface UnloadPluginPayload {
  pluginName: string;
}

export interface ReloadPluginPayload {
  pluginName: string;
  pluginPath: string;
  permissions: PluginPermission[];
}

// ─── API request / response ─────────────────────────────────────────

export const PH_API_REQUEST = 'host.apiRequest';
export const PH_API_RESPONSE = 'host.apiResponse';

// ─── Events (renderer → host broadcast) ─────────────────────────────

export const PH_EVENT = 'host.event';

export interface EventPayload {
  eventName: string;
  args: unknown[];
}

// ─── Callback registration (host → renderer) ────────────────────────

export const PH_REGISTER_CALLBACK = 'host.registerCallback';
export const PH_UNREGISTER_CALLBACK = 'host.unregisterCallback';
export const PH_CALLBACK_INVOCATION = 'host.callbackInvocation';

export interface CallbackResultPayload {
  callbackId: string;
  invocationId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export const PH_CALLBACK_RESULT = 'host.callbackResult';

// ─── Renderer module channel (bidirectional) ────────────────────────

export const PH_RENDERER_MODULE_MESSAGE = 'host.rendererModuleMessage';

export interface RendererModuleMessagePayload {
  pluginName: string;
  data: unknown;
}

// ─── Quarantine & health (host → renderer, renderer → host) ─────────

export const PH_PLUGIN_CRASHED = 'host.pluginCrashed';
export const PH_HEALTH_REPORT = 'host.healthReport';
export const PH_TRUST_AND_REENABLE = 'host.trustAndReEnable';

export interface TrustAndReEnablePayload {
  pluginName: string;
}

export interface PluginCrashedPayload {
  pluginName: string;
  exitCode: number;
  quarantined: boolean;
  crashCount: number;
}
