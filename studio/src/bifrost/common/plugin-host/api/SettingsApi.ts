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

export class SettingsApi {
  private connection: PluginHostConnection;
  private changeCallbacks = new Map<string, (value: unknown) => void>();

  constructor(connection: PluginHostConnection) {
    this.connection = connection;
  }

  async register(descriptors: Record<string, unknown>): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'settings',
      method: 'register',
      args: [descriptors],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async has(key: string): Promise<boolean> {
    const payload: ApiRequestPayload = {
      namespace: 'settings',
      method: 'has',
      args: [key],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<boolean>;
  }

  async get<T = unknown>(key: string): Promise<T> {
    const payload: ApiRequestPayload = {
      namespace: 'settings',
      method: 'get',
      args: [key],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<T>;
  }

  async getSchema(key: string): Promise<Record<string, unknown> | undefined> {
    const payload: ApiRequestPayload = {
      namespace: 'settings',
      method: 'getSchema',
      args: [key],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<Record<string, unknown> | undefined>;
  }

  async getSchemas(): Promise<Record<string, Record<string, unknown>>> {
    const payload: ApiRequestPayload = {
      namespace: 'settings',
      method: 'getSchemas',
      args: [],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<Record<string, Record<string, unknown>>>;
  }

  async getDefault<T = unknown>(key: string): Promise<T> {
    const payload: ApiRequestPayload = {
      namespace: 'settings',
      method: 'getDefault',
      args: [key],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<T>;
  }

  async getDefaults(): Promise<Record<string, unknown>> {
    const payload: ApiRequestPayload = {
      namespace: 'settings',
      method: 'getDefaults',
      args: [],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<Record<string, unknown>>;
  }

  async set(key: string, value: unknown): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'settings',
      method: 'set',
      args: [key, value],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async add(key: string, value: unknown): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'settings',
      method: 'add',
      args: [key, value],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async removeValue(key: string, value: string): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'settings',
      method: 'removeValue',
      args: [key, value],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async onDidChange(key: string, callback: (newValue: unknown) => void): Promise<void> {
    const callbackId = randomUUID();
    this.changeCallbacks.set(callbackId, callback);
    registerGlobalCallback(callbackId, callback as (...args: unknown[]) => unknown);

    const payload: RegisterCallbackPayload = {
      callbackId,
      namespace: 'settings',
      method: 'onDidChange',
      args: [key],
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
