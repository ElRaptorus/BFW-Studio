import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import {
  type ApiRequestPayload,
  PH_API_REQUEST,
  PH_REGISTER_CALLBACK,
  PH_UNREGISTER_CALLBACK,
  type RegisterCallbackPayload,
} from '#bifrost/contracts/PluginHostProtocol';

import { registerGlobalCallback, unregisterGlobalCallback } from '../callbackRegistry';

/**
 * Plugin-facing API for webview communication.
 * Runs in the Plugin Host child process; all calls are serialized
 * to {@link PH_API_REQUEST} or {@link PH_REGISTER_CALLBACK} messages
 * sent to the renderer via IPC.
 */
export class WebviewApi {
  private connection: PluginHostConnection;
  private pluginName: string;

  /** iframeId → callbackId for active onMessage listeners */
  private messageCallbacks = new Map<string, string>();

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async createPanel(options: { title: string; entryPoint: string; localResourceRoots?: string[] }): Promise<string> {
    return this.connection.request(PH_API_REQUEST, {
      namespace: 'webviews',
      method: 'createPanel',
      args: [this.pluginName, options],
    } satisfies ApiRequestPayload) as Promise<string>;
  }

  async postMessage(iframeId: string, data: unknown): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'webviews',
      method: 'postMessage',
      args: [iframeId, data],
    } satisfies ApiRequestPayload);
  }

  async onMessage(iframeId: string, callback: (data: unknown) => void): Promise<() => void> {
    const callbackId = `${this.pluginName}:webview:${iframeId}:onMessage`;

    const existing = this.messageCallbacks.get(iframeId);
    if (existing) {
      unregisterGlobalCallback(existing);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId: existing });
    }

    registerGlobalCallback(callbackId, callback);
    this.messageCallbacks.set(iframeId, callbackId);

    await this.connection.request(PH_REGISTER_CALLBACK, {
      callbackId,
      namespace: 'webviews',
      method: 'onMessage',
      args: [iframeId],
    } satisfies RegisterCallbackPayload);

    return () => {
      unregisterGlobalCallback(callbackId);
      this.messageCallbacks.delete(iframeId);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
    };
  }

  async dispose(iframeId: string): Promise<void> {
    const callbackId = this.messageCallbacks.get(iframeId);
    if (callbackId) {
      unregisterGlobalCallback(callbackId);
      this.messageCallbacks.delete(iframeId);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
    }
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'webviews',
      method: 'dispose',
      args: [iframeId],
    } satisfies ApiRequestPayload);
  }

  disposeCallbacks(): void {
    for (const callbackId of this.messageCallbacks.values()) {
      unregisterGlobalCallback(callbackId);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
    }
    this.messageCallbacks.clear();
  }
}
