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

export class NotificationsApi {
  private connection: PluginHostConnection;
  private pluginName: string;
  private responseCallbacks = new Map<string, (response: unknown) => void>();

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async open(options: {
    type: 'info' | 'warning' | 'error';
    content: string;
    origin?: string;
    actions?: { action: string; label: string; default?: boolean }[];
    sticky?: boolean;
  }): Promise<string> {
    const payload: ApiRequestPayload = {
      namespace: 'notifications',
      method: 'open',
      args: [{ ...options, origin: options.origin ?? this.pluginName }],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<string>;
  }

  async close(notificationId: string): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'notifications',
      method: 'close',
      args: [notificationId],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async update(notificationId: string, options: { content?: string }): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'notifications',
      method: 'update',
      args: [notificationId, options],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async onResponse(
    notificationId: string,
    callback: (response: { action: string; label: string }) => void,
  ): Promise<void> {
    const callbackId = `${this.pluginName}:notifications:onResponse:${randomUUID()}`;
    this.responseCallbacks.set(callbackId, callback as (...args: unknown[]) => unknown);
    registerGlobalCallback(callbackId, callback as (...args: unknown[]) => unknown);

    const payload: RegisterCallbackPayload = {
      callbackId,
      namespace: 'notifications',
      method: 'onResponse',
      args: [this.pluginName, notificationId],
    };

    await this.connection.request(PH_REGISTER_CALLBACK, payload);
  }

  disposeCallbacks(): void {
    for (const callbackId of this.responseCallbacks.keys()) {
      unregisterGlobalCallback(callbackId);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
    }
    this.responseCallbacks.clear();
  }
}
