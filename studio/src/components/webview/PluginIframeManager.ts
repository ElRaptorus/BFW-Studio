import type { ThemeType } from '#bifrost/contracts/ThemeTypes';

import type React from 'react';

import type { PluginIframeGuestMessage, PluginIframeHandle, PluginIframeHostMessage } from './types';

interface IframeEntry {
  iframeId: string;
  pluginName: string;
  panelRef: React.RefObject<PluginIframeHandle | null>;
  state: unknown;
  messageHandler?: (data: unknown) => void;
}

/**
 * Singleton service tracking all active plugin iframes.
 *
 * Owned by {@link PluginHost} (renderer). Not directly accessible
 * from `bifrost.plugins` — the bridge accesses it via the PluginHost.
 *
 * State is stored in a renderer-side Map keyed by `iframeId`.
 * When an iframe is destroyed and re-created with the same id,
 * the saved state is sent back via postMessage.
 */
export class PluginIframeManager {
  private iframes = new Map<string, IframeEntry>();
  /** Handlers registered before the iframe mounts. Drained by {@link register}. */
  private pendingHandlers = new Map<string, (data: unknown) => void>();
  private currentThemeTokens: Record<string, string> = {};
  private currentThemeType: ThemeType = 'dark';

  register(iframeId: string, pluginName: string, panelRef: React.RefObject<PluginIframeHandle | null>): void {
    const existing = this.iframes.get(iframeId);
    this.iframes.set(iframeId, {
      iframeId,
      pluginName,
      panelRef,
      state: existing?.state ?? undefined,
      messageHandler: existing?.messageHandler ?? this.pendingHandlers.get(iframeId),
    });
    this.pendingHandlers.delete(iframeId);
  }

  unregister(iframeId: string): void {
    const entry = this.iframes.get(iframeId);
    if (entry?.messageHandler != null) {
      this.pendingHandlers.set(iframeId, entry.messageHandler);
    }
    this.iframes.delete(iframeId);
  }

  handleIframeMessage(iframeId: string, data: unknown): void {
    const entry = this.iframes.get(iframeId);
    if (entry == null) {
      return;
    }

    const message = data as PluginIframeHostMessage;
    switch (message.type) {
      case 'plugin-message':
        entry.messageHandler?.(message.data);
        break;
      case 'set-state':
        entry.state = message.state;
        break;
    }
  }

  postMessageToIframe(iframeId: string, data: unknown): void {
    const entry = this.iframes.get(iframeId);
    if (entry == null) {
      console.warn(`[PluginIframeManager] iframe '${iframeId}' not found — cannot post message.`);
      return;
    }

    entry.panelRef.current?.postMessage({
      type: 'plugin-message',
      data,
    } satisfies PluginIframeGuestMessage);
  }

  setMessageHandler(iframeId: string, handler: ((data: unknown) => void) | undefined): void {
    const entry = this.iframes.get(iframeId);
    if (entry != null) {
      entry.messageHandler = handler;
    } else if (handler != null) {
      this.pendingHandlers.set(iframeId, handler);
    } else {
      this.pendingHandlers.delete(iframeId);
    }
  }

  setState(iframeId: string, state: unknown): void {
    const entry = this.iframes.get(iframeId);
    if (entry != null) {
      entry.state = state;
    }
  }

  getState(iframeId: string): unknown {
    return this.iframes.get(iframeId)?.state;
  }

  /**
   * Sends theme tokens to all active iframes and stores them
   * so newly-opened iframes receive the current theme on load.
   */
  broadcastThemeTokens(tokens: Record<string, string>, themeType: ThemeType): void {
    this.currentThemeTokens = tokens;
    this.currentThemeType = themeType;

    for (const entry of this.iframes.values()) {
      entry.panelRef.current?.postMessage({
        type: 'theme',
        tokens,
        themeType,
      } satisfies PluginIframeGuestMessage);
    }
  }

  /**
   * Sends saved state and current theme to an iframe after its `load` event fires.
   */
  sendRestoredState(iframeId: string): void {
    const entry = this.iframes.get(iframeId);
    if (entry == null) {
      return;
    }

    if (entry.state !== undefined) {
      entry.panelRef.current?.postMessage({
        type: 'restore-state',
        state: entry.state,
      } satisfies PluginIframeGuestMessage);
    }

    if (Object.keys(this.currentThemeTokens).length > 0) {
      entry.panelRef.current?.postMessage({
        type: 'theme',
        tokens: this.currentThemeTokens,
        themeType: this.currentThemeType,
      } satisfies PluginIframeGuestMessage);
    }
  }

  getIframesByPlugin(pluginName: string): string[] {
    const result: string[] = [];
    for (const entry of this.iframes.values()) {
      if (entry.pluginName === pluginName) {
        result.push(entry.iframeId);
      }
    }
    return result;
  }

  getIframe(iframeId: string): IframeEntry | undefined {
    return this.iframes.get(iframeId);
  }

  /**
   * Clean up all iframes belonging to a specific plugin.
   * Called during plugin unload/disable.
   */
  disposePlugin(pluginName: string): void {
    for (const [iframeId, entry] of this.iframes) {
      if (entry.pluginName === pluginName) {
        this.iframes.delete(iframeId);
        this.pendingHandlers.delete(iframeId);
      }
    }
  }
}
