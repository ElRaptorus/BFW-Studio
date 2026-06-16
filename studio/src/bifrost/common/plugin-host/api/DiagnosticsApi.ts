import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import {
  type ApiRequestPayload,
  PH_API_REQUEST,
  PH_REGISTER_CALLBACK,
  PH_UNREGISTER_CALLBACK,
  type RegisterCallbackPayload,
} from '#bifrost/contracts/PluginHostProtocol';
import { randomUUID } from 'crypto';

import { registerGlobalCallback, unregisterGlobalCallback } from '../callbackRegistry';

export class DiagnosticsApi {
  private connection: PluginHostConnection;
  private pluginName: string;
  private changeCallbacks = new Map<string, () => void>();

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async set(uri: string, diagnostics: { severity: string; message: string }[]): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'diagnostics',
      method: 'set',
      args: [this.pluginName, uri, diagnostics],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async clear(): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'diagnostics',
      method: 'clear',
      args: [this.pluginName],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async get(uri?: string): Promise<Record<string, { severity: string; message: string }[]>> {
    const payload: ApiRequestPayload = {
      namespace: 'diagnostics',
      method: 'get',
      args: [uri],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<
      Record<string, { severity: string; message: string }[]>
    >;
  }

  async getCount(): Promise<{ errors: number; warnings: number; infos: number }> {
    const payload: ApiRequestPayload = {
      namespace: 'diagnostics',
      method: 'getCount',
      args: [],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<{
      errors: number;
      warnings: number;
      infos: number;
    }>;
  }

  async onDidChange(callback: () => void): Promise<void> {
    const callbackId = `${this.pluginName}:diagnostics:onDidChange:${randomUUID()}`;
    this.changeCallbacks.set(callbackId, callback);
    registerGlobalCallback(callbackId, callback as (...args: unknown[]) => unknown);

    const payload: RegisterCallbackPayload = {
      callbackId,
      namespace: 'diagnostics',
      method: 'onDidChange',
      args: [this.pluginName],
    };

    await this.connection.request(PH_REGISTER_CALLBACK, payload);
  }

  disposeCallbacks(): void {
    for (const callbackId of this.changeCallbacks.keys()) {
      unregisterGlobalCallback(callbackId);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
    }
    this.changeCallbacks.clear();
  }
}
