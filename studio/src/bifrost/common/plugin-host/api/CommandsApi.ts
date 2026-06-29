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

/**
 * Serializable version of CommandResult for cross-process transfer.
 * Error objects are converted to plain objects with message and stack.
 */
export type SerializedCommandResult<T = unknown> =
  { success: true; returnValue: T } | { success: false; error: { message: string; stack?: string } };

/**
 * Serializable subset of a Command for cross-process transfer.
 * Functions (callbackFn, enabledPredicateFn) are stripped.
 */
export interface SerializedCommandInfo {
  name: string;
  description: string;
  visibleInSearch: boolean;
}

export class CommandsApi {
  private connection: PluginHostConnection;
  private pluginName: string;
  private registeredCallbacks = new Map<string, (...args: unknown[]) => unknown>();

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async register(
    id: string,
    callback: (...args: unknown[]) => unknown,
    options?: { description?: string | string[]; visibleInSearch?: boolean },
  ): Promise<void> {
    const namespacedId = `plugin.${this.pluginName}.${id}`;
    const callbackId = randomUUID();

    this.registeredCallbacks.set(callbackId, callback);
    registerGlobalCallback(callbackId, callback);

    const payload: RegisterCallbackPayload = {
      callbackId,
      namespace: 'commands',
      method: 'register',
      args: [namespacedId, options ?? {}],
    };

    await this.connection.request(PH_REGISTER_CALLBACK, payload);
  }

  async executeCommand(id: string, args?: unknown[]): Promise<unknown> {
    const payload: ApiRequestPayload = {
      namespace: 'commands',
      method: 'executeCommand',
      args: [id, args ?? []],
    };

    return this.connection.request(PH_API_REQUEST, payload);
  }

  async tryToExecuteCommand(id: string, args?: unknown[]): Promise<SerializedCommandResult> {
    const payload: ApiRequestPayload = {
      namespace: 'commands',
      method: 'tryToExecuteCommand',
      args: [id, args ?? []],
    };

    return this.connection.request(PH_API_REQUEST, payload) as Promise<SerializedCommandResult>;
  }

  async isCommandEnabled(id: string, args?: unknown[]): Promise<boolean> {
    const payload: ApiRequestPayload = {
      namespace: 'commands',
      method: 'isCommandEnabled',
      args: [id, args ?? []],
    };

    return this.connection.request(PH_API_REQUEST, payload) as Promise<boolean>;
  }

  async isRegistered(commandName: string): Promise<boolean> {
    const payload: ApiRequestPayload = {
      namespace: 'commands',
      method: 'isRegistered',
      args: [commandName],
    };

    return this.connection.request(PH_API_REQUEST, payload) as Promise<boolean>;
  }

  async getCommands(): Promise<SerializedCommandInfo[]> {
    const payload: ApiRequestPayload = {
      namespace: 'commands',
      method: 'getCommands',
      args: [],
    };

    return this.connection.request(PH_API_REQUEST, payload) as Promise<SerializedCommandInfo[]>;
  }

  invokeCallback(callbackId: string, args: unknown[]): unknown {
    const callback = this.registeredCallbacks.get(callbackId);
    if (callback == null) {
      throw new Error(`Unknown callback: ${callbackId}`);
    }
    return callback(...args);
  }

  disposeCallbacks(): void {
    for (const callbackId of this.registeredCallbacks.keys()) {
      unregisterGlobalCallback(callbackId);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
    }
    this.registeredCallbacks.clear();
  }
}
