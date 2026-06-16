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

export class WorkspaceApi {
  private connection: PluginHostConnection;
  private pluginName: string;
  private watcherCallbacks = new Map<string, (...args: unknown[]) => unknown>();

  constructor(connection: PluginHostConnection, pluginName: string) {
    this.connection = connection;
    this.pluginName = pluginName;
  }

  async readFile(uri: string): Promise<string> {
    const payload: ApiRequestPayload = {
      namespace: 'workspace',
      method: 'readFile',
      args: [this.pluginName, uri],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<string>;
  }

  async readBinaryFile(uri: string): Promise<Uint8Array> {
    const payload: ApiRequestPayload = {
      namespace: 'workspace',
      method: 'readBinaryFile',
      args: [this.pluginName, uri],
    };
    const base64: string = (await this.connection.request(PH_API_REQUEST, payload)) as string;
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  async writeFile(uri: string, content: string): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'workspace',
      method: 'writeFile',
      args: [this.pluginName, uri, content],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async writeBinaryFile(uri: string, content: Uint8Array): Promise<void> {
    const base64 = Buffer.from(content).toString('base64');
    const payload: ApiRequestPayload = {
      namespace: 'workspace',
      method: 'writeBinaryFile',
      args: [this.pluginName, uri, base64],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async listDirectory(uri: string): Promise<{ name: string; uri: string; type: 'file' | 'directory' }[]> {
    const payload: ApiRequestPayload = {
      namespace: 'workspace',
      method: 'listDirectory',
      args: [this.pluginName, uri],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<
      { name: string; uri: string; type: 'file' | 'directory' }[]
    >;
  }

  async stat(uri: string): Promise<{ isDirectory: boolean; isFile: boolean; exists: boolean }> {
    const payload: ApiRequestPayload = {
      namespace: 'workspace',
      method: 'stat',
      args: [this.pluginName, uri],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<{
      isDirectory: boolean;
      isFile: boolean;
      exists: boolean;
    }>;
  }

  async createDirectory(uri: string): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'workspace',
      method: 'createDirectory',
      args: [this.pluginName, uri],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async deleteFile(uri: string): Promise<void> {
    const payload: ApiRequestPayload = {
      namespace: 'workspace',
      method: 'deleteFile',
      args: [this.pluginName, uri],
    };
    await this.connection.request(PH_API_REQUEST, payload);
  }

  async onDidChangeFile(
    uri: string,
    callback: (event: { type: string; uri: string }) => void,
  ): Promise<{ dispose: () => void }> {
    const callbackId = `${this.pluginName}:workspace:onDidChangeFile:${randomUUID()}`;
    this.watcherCallbacks.set(callbackId, callback as (...args: unknown[]) => unknown);
    registerGlobalCallback(callbackId, callback as (...args: unknown[]) => unknown);

    const payload: RegisterCallbackPayload = {
      callbackId,
      namespace: 'workspace',
      method: 'onDidChangeFile',
      args: [this.pluginName, uri],
    };

    await this.connection.request(PH_REGISTER_CALLBACK, payload);

    return {
      dispose: () => {
        unregisterGlobalCallback(callbackId);
        this.watcherCallbacks.delete(callbackId);
        this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
      },
    };
  }

  async onDidChangeSolution(callback: () => void): Promise<{ dispose: () => void }> {
    const callbackId = `${this.pluginName}:workspace:onDidChangeSolution:${randomUUID()}`;
    this.watcherCallbacks.set(callbackId, callback as (...args: unknown[]) => unknown);
    registerGlobalCallback(callbackId, callback as (...args: unknown[]) => unknown);

    const payload: RegisterCallbackPayload = {
      callbackId,
      namespace: 'workspace',
      method: 'onDidChangeSolution',
      args: [this.pluginName],
    };

    await this.connection.request(PH_REGISTER_CALLBACK, payload);

    return {
      dispose: () => {
        unregisterGlobalCallback(callbackId);
        this.watcherCallbacks.delete(callbackId);
        this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
      },
    };
  }

  async getProjectFolders(): Promise<{ uri: string; name: string }[]> {
    const payload: ApiRequestPayload = {
      namespace: 'workspace',
      method: 'getProjectFolders',
      args: [this.pluginName],
    };
    return this.connection.request(PH_API_REQUEST, payload) as Promise<{ uri: string; name: string }[]>;
  }

  disposeCallbacks(): void {
    for (const callbackId of this.watcherCallbacks.keys()) {
      unregisterGlobalCallback(callbackId);
      this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
    }
    this.watcherCallbacks.clear();
  }
}
