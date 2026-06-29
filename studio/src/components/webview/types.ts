/**
 * Shared type definitions for the plugin iframe infrastructure.
 *
 * These types are used by PluginIframe, PluginIframeManager,
 * and the bridge script to communicate between the Studio renderer
 * and sandboxed plugin iframes via postMessage.
 */

// ─── iframe options and handles ─────────────────────────────────────

export interface PluginIframeOptions {
  entryPoint: string;
  localResourceRoots?: string[];
}

export interface PluginIframeHandle {
  postMessage(data: unknown): void;
  reload(): void;
}

// ─── Message types: host → iframe (to-guest) ────────────────────────

export interface PluginIframeGuestMessage_PluginMessage {
  type: 'plugin-message';
  data: unknown;
}

export interface PluginIframeGuestMessage_RestoreState {
  type: 'restore-state';
  state: unknown;
}

export interface PluginIframeGuestMessage_Theme {
  type: 'theme';
  tokens: Record<string, string>;
  themeType: string;
}

export type PluginIframeGuestMessage =
  PluginIframeGuestMessage_PluginMessage | PluginIframeGuestMessage_RestoreState | PluginIframeGuestMessage_Theme;

// ─── Message types: iframe → host (to-host) ─────────────────────────

export interface PluginIframeHostMessage_PluginMessage {
  type: 'plugin-message';
  data: unknown;
}

export interface PluginIframeHostMessage_SetState {
  type: 'set-state';
  state: unknown;
}

export type PluginIframeHostMessage = PluginIframeHostMessage_PluginMessage | PluginIframeHostMessage_SetState;

// ─── Envelope: postMessage wrapper ──────────────────────────────────

export const BRIDGE_CHANNEL = 'studio-bridge' as const;

export interface BridgeMessageToHost {
  channel: typeof BRIDGE_CHANNEL;
  direction: 'to-host';
  payload: PluginIframeHostMessage;
}

export interface BridgeMessageToGuest {
  channel: typeof BRIDGE_CHANNEL;
  direction: 'to-guest';
  payload: PluginIframeGuestMessage;
}

export type BridgeMessage = BridgeMessageToHost | BridgeMessageToGuest;
