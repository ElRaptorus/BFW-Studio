/**
 * Shared type definitions for the Plugin Host protocol.
 * Used by both the Plugin Host child process and the renderer (bridge).
 *
 * The full protocol with message constants and connection logic lives in
 * `contracts/PluginHostProtocol.ts`.
 */
import type { AbstractSubscription } from '../common/AbstractEmitter';
import type { PluginPermissionStore } from '../common/plugin-host/PluginPermissionStore';
import type { BifrostStudioManifest } from '../common/plugin-host/manifest/ManifestTypes';
import type { PluginHostConnection } from './PluginHostConnection';

// ─── Plugin Host events ─────────────────────────────────────────────

export const EVENT_PLUGIN_LIST_CHANGED = 'EVENT_PLUGIN_LIST_CHANGED';

// ─── Plugin Host service contract ───────────────────────────────────

export interface IPluginHost {
  start(): Promise<void>;
  discoverAndLoadPlugins(disabledPlugins?: string[]): Promise<void>;
  refresh(): Promise<void>;
  unloadPlugin(name: string): Promise<void>;
  removePlugin(name: string): void;
  reloadPlugin(name: string): Promise<void>;
  trustAndReEnablePlugin(name: string): Promise<void>;
  getPluginList(): PluginInfo[];
  getPermissionStore(): PluginPermissionStore;
  getPluginsDirectory(): string;
  isRunning(): boolean;
  dispose(): Promise<void>;
  on(eventName: string, listener: (...args: any[]) => void): AbstractSubscription;
  getLog(): string[];
  onLog(handler: (line: string) => void): void;
  clearLog(): void;
  registerApiNamespace(factory: PluginApiNamespaceFactory): void;
}

// ─── Module-provided plugin API namespaces ──────────────────────────

/** Callback disposers of one plugin, keyed by callback ID. */
export type PluginCallbackGroup = Map<string, { disposer: () => void }>;

export type PluginApiNamespaceContext = {
  pluginHost: { getConnection(): PluginHostConnection | null };
  /** Forwards a message from a renderer module to every namespace's `onRendererModuleMessage` subscribers. */
  deliverRendererModuleMessage: (pluginName: string, data: unknown) => void;
};

/**
 * A plugin API namespace (`api.<namespace>.*`) contributed by a module, so the plugin host stays free of
 * module code. The host gates `<namespace>`, `<namespace>.modelling` and `<namespace>.renderer` permissions
 * before delegating.
 */
export interface PluginApiNamespace {
  /** Limited to namespaces with `<namespace>`, `.modelling` and `.renderer` entries in `PluginPermission`. */
  readonly namespace: 'bpmn' | 'dmn';
  handleApiRequest(method: string, args: unknown[], pluginName: string): Promise<unknown>;
  registerCallback(
    payload: RegisterCallbackPayload,
    getOrCreatePluginGroup: (pluginName: string) => PluginCallbackGroup,
  ): void;
  deliverRendererModuleMessage(pluginName: string, data: unknown): void;
  /** Applies the namespace's manifest contributions and returns their disposers. */
  registerContributions(
    pluginName: string,
    pluginPath: string | undefined,
    manifest: BifrostStudioManifest,
  ): (() => void)[];
  disposePlugin(pluginName: string): void;
  dispose(): void;
}

export type PluginApiNamespaceFactory = (context: PluginApiNamespaceContext) => PluginApiNamespace;

// ─── Protocol payloads ──────────────────────────────────────────────

export interface ApiRequestPayload {
  namespace: string;
  method: string;
  args: unknown[];
  pluginName?: string;
}

export interface ApiResponsePayload {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface RegisterCallbackPayload {
  callbackId: string;
  namespace: string;
  method: string;
  args: unknown[];
  pluginName?: string;
}

export interface CallbackInvocationPayload {
  callbackId: string;
  args: unknown[];
}

export interface PluginManifestSummary {
  apiVersion: string;
  displayName?: string;
  description?: string;
  icon?: string;
  activationEvents?: string[];
  contributes?: Record<string, unknown>;
  permissions?: string[];
}

export interface PluginManifestDiagnostic {
  path: string;
  message: string;
}

export interface PluginInfo {
  name: string;
  packageName?: string;
  path: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  status: 'loaded' | 'pending' | 'disabled' | 'error' | 'quarantined';
  errorMessage?: string;
  readmePath?: string;
  logoPath?: string;
  homepage?: string;
  keywords?: string[];
  deprecated?: string | boolean;
  manifest?: PluginManifestSummary;
  manifestErrors?: PluginManifestDiagnostic[];
  manifestWarnings?: PluginManifestDiagnostic[];
}
