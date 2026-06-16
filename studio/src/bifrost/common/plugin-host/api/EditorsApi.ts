import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import {
  type ApiRequestPayload,
  PH_API_REQUEST,
  PH_REGISTER_CALLBACK,
  PH_UNREGISTER_CALLBACK,
  type RegisterCallbackPayload,
} from '#bifrost/contracts/PluginHostProtocol';

import { registerGlobalCallback, unregisterGlobalCallback } from '../callbackRegistry';

export interface RegisterWebviewDocumentTypeOptions {
  id: string;
  displayName: string;
  icon: string;
  uriPattern: string;
  webviewOptions: {
    entryPoint: string;
    localResourceRoots?: string[];
  };
  onDidOpen?: (iframeId: string, uri: string) => void;
}

/**
 * Plugin-facing editors API (child process).
 * Allows plugins to register iframe-backed editor document types
 * and open documents programmatically.
 */
export class EditorsApi {
  private connection: PluginHostConnection;
  private pluginName: string;

  private onDidOpenCallbacks = new Map<string, string>();
  private saveRequestCallbacks = new Map<string, string>();

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async registerWebviewDocumentType(options: RegisterWebviewDocumentTypeOptions): Promise<void> {
    const { onDidOpen, ...serializableOptions } = options;

    await this.connection.request(PH_API_REQUEST, {
      namespace: 'editors',
      method: 'registerWebviewDocumentType',
      args: [this.pluginName, serializableOptions],
    } satisfies ApiRequestPayload);

    if (onDidOpen != null) {
      const callbackId = `${this.pluginName}:editors:${options.id}:onDidOpen`;

      const existing = this.onDidOpenCallbacks.get(options.id);
      if (existing) {
        unregisterGlobalCallback(existing);
        this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId: existing });
      }

      registerGlobalCallback(callbackId, (...args: unknown[]) => onDidOpen(args[0] as string, args[1] as string));
      this.onDidOpenCallbacks.set(options.id, callbackId);

      await this.connection.request(PH_REGISTER_CALLBACK, {
        callbackId,
        namespace: 'editors',
        method: 'onDidOpen',
        args: [this.pluginName, options.id],
      } satisfies RegisterCallbackPayload);
    }
  }

  async openDocument(uri: string): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'editors',
      method: 'openDocument',
      args: [uri],
    } satisfies ApiRequestPayload);
  }

  async setDirty(uri: string, isDirty: boolean): Promise<void> {
    await this.connection.request(PH_API_REQUEST, {
      namespace: 'editors',
      method: 'setDirty',
      args: [uri, isDirty],
    } satisfies ApiRequestPayload);
  }

  async onSaveRequest(uri: string, callback: () => Promise<void>): Promise<{ dispose: () => void }> {
    const callbackId = `${this.pluginName}:editors:${uri}:onSaveRequest`;

    const existing = this.saveRequestCallbacks.get(uri);
    if (existing) {
      unregisterGlobalCallback(existing);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId: existing });
    }

    registerGlobalCallback(callbackId, async () => callback());
    this.saveRequestCallbacks.set(uri, callbackId);

    await this.connection.request(PH_REGISTER_CALLBACK, {
      callbackId,
      namespace: 'editors',
      method: 'onSaveRequest',
      args: [this.pluginName, uri],
    } satisfies RegisterCallbackPayload);

    return {
      dispose: () => {
        unregisterGlobalCallback(callbackId);
        this.saveRequestCallbacks.delete(uri);
        this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
      },
    };
  }

  disposeCallbacks(): void {
    for (const callbackId of this.onDidOpenCallbacks.values()) {
      unregisterGlobalCallback(callbackId);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
    }
    this.onDidOpenCallbacks.clear();

    for (const callbackId of this.saveRequestCallbacks.values()) {
      unregisterGlobalCallback(callbackId);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
    }
    this.saveRequestCallbacks.clear();
  }
}
