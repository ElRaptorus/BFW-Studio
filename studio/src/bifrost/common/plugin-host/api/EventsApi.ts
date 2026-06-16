import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import {
  PH_REGISTER_CALLBACK,
  PH_UNREGISTER_CALLBACK,
  type RegisterCallbackPayload,
} from '#bifrost/contracts/PluginHostProtocol';
import { randomUUID } from 'crypto';

import { registerGlobalCallback, unregisterGlobalCallback } from '../callbackRegistry';

export class EventsApi {
  private connection: PluginHostConnection;
  private pluginName: string;
  private listeners = new Map<string, { callbackId: string; callback: (...args: unknown[]) => void }[]>();

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async on(eventName: string, callback: (...args: unknown[]) => void): Promise<void> {
    const callbackId = randomUUID();

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)!.push({ callbackId, callback });
    registerGlobalCallback(callbackId, callback);

    const payload: RegisterCallbackPayload = {
      callbackId,
      namespace: 'events',
      method: 'on',
      args: [this.pluginName, eventName],
    };

    await this.connection.request(PH_REGISTER_CALLBACK, payload);
  }

  async off(eventName: string, callback: (...args: unknown[]) => void): Promise<void> {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners == null) {
      return;
    }

    const index = eventListeners.findIndex((entry) => entry.callback === callback);
    if (index === -1) {
      return;
    }

    const { callbackId } = eventListeners.splice(index, 1)[0];
    unregisterGlobalCallback(callbackId);

    this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
  }

  disposeCallbacks(): void {
    for (const [, entries] of this.listeners) {
      for (const { callbackId } of entries) {
        unregisterGlobalCallback(callbackId);
        this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
      }
    }
    this.listeners.clear();
  }
}
