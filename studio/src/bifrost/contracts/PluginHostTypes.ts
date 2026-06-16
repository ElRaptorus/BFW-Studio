/**
 * Shared type definitions for the Plugin Host protocol.
 * Used by both the Plugin Host child process and the renderer (bridge).
 *
 * The full protocol with message constants and connection logic lives in
 * `contracts/PluginHostProtocol.ts`.
 */
import type { AbstractSubscription, PluginInfo } from '@evil/bifrost_fw_sdk';

import type { PluginPermissionStore } from '../common/plugin-host/PluginPermissionStore';

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
}

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
