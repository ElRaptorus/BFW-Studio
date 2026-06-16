import type { PluginHostConnection } from '#bifrost/contracts/PluginHostConnection';
import {
  type LoadPluginPayload,
  PH_API_REQUEST,
  PH_CALLBACK_INVOCATION,
  PH_CALLBACK_RESULT,
  PH_EVENT,
  PH_PLUGIN_CRASHED,
  PH_REGISTER_CALLBACK,
  PH_UNREGISTER_CALLBACK,
  type PluginCrashedPayload,
} from '#bifrost/contracts/PluginHostProtocol';
import type { ApiRequestPayload, RegisterCallbackPayload } from '#bifrost/contracts/PluginHostTypes';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { PluginPermission } from '../permissions/PermissionTypes';
import type { PluginHealthReport } from './PluginHealthReport';
import { PluginSandbox, type PluginSandboxOptions } from './PluginSandbox';
import { QuarantineManager } from './QuarantineManager';

interface SandboxWorkerMessage {
  type: string;
  [key: string]: unknown;
}

export class SandboxManager {
  private sandboxes = new Map<string, PluginSandbox>();
  private callbackRouter = new Map<string, string>();
  private activationTimes = new Map<string, number>();
  private startTimes = new Map<string, number>();
  private totalCrashes = new Map<string, number>();
  private connection: PluginHostConnection;
  private storagePath: string;
  readonly quarantineManager: QuarantineManager;

  constructor(connection: PluginHostConnection, storagePath: string) {
    this.connection = connection;
    this.storagePath = storagePath;
    this.quarantineManager = new QuarantineManager(storagePath);
  }

  async initialize(): Promise<void> {
    await this.quarantineManager.load();
  }

  async loadPlugin(payload: LoadPluginPayload): Promise<void> {
    const { pluginName, pluginPath, permissions } = payload;

    if (this.quarantineManager.isQuarantined(pluginName)) {
      throw new Error(`Plugin '${pluginName}' is quarantined and cannot be loaded`);
    }

    if (this.sandboxes.has(pluginName)) {
      throw new Error(`Plugin '${pluginName}' is already loaded`);
    }

    const pluginStoragePath = path.join(this.storagePath, pluginName);
    await fs.mkdir(pluginStoragePath, { recursive: true });

    const options: PluginSandboxOptions = {
      pluginName,
      pluginPath,
      storagePath: pluginStoragePath,
      permissions,
    };

    const sandbox = new PluginSandbox(options);

    sandbox.onMessage((msg) => {
      this.handleWorkerMessage(pluginName, msg as SandboxWorkerMessage);
    });

    sandbox.onExit((code) => {
      console.error(`[SandboxManager] Plugin '${pluginName}' Worker exited (code=${code})`);
      this.cleanupCallbacksForPlugin(pluginName);
      this.sandboxes.delete(pluginName);

      const prev = this.totalCrashes.get(pluginName) ?? 0;
      this.totalCrashes.set(pluginName, prev + 1);

      const quarantined = this.quarantineManager.recordCrash(pluginName, code ?? 1);
      const crashCount = this.quarantineManager.getCrashCount(pluginName);

      const crashPayload: PluginCrashedPayload = {
        pluginName,
        exitCode: code ?? 1,
        quarantined,
        crashCount,
      };
      this.connection.send(PH_PLUGIN_CRASHED, crashPayload);
    });

    // Store the sandbox BEFORE start() so that IPC responses arriving
    // during plugin activation (before sandbox:ready) can find it.
    this.sandboxes.set(pluginName, sandbox);

    const startTime = Date.now();
    try {
      await sandbox.start();
      this.activationTimes.set(pluginName, Date.now() - startTime);
      this.startTimes.set(pluginName, Date.now());
    } catch (err) {
      this.sandboxes.delete(pluginName);
      sandbox.terminate();
      throw err;
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    const sandbox = this.sandboxes.get(name);
    if (sandbox == null) {
      console.warn(`[SandboxManager] Plugin '${name}' is not loaded.`);
      return;
    }

    await sandbox.stop();
    this.cleanupCallbacksForPlugin(name);
    this.sandboxes.delete(name);
    console.log(`[SandboxManager] Plugin '${name}' unloaded.`);
  }

  async reloadPlugin(name: string, pluginPath: string, permissions: PluginPermission[]): Promise<void> {
    await this.unloadPlugin(name);
    await this.loadPlugin({ pluginName: name, pluginPath, permissions });
  }

  async deactivateAll(): Promise<void> {
    const names = [...this.sandboxes.keys()];
    for (const name of names) {
      try {
        await this.unloadPlugin(name);
      } catch (err) {
        console.error(`[SandboxManager] Error unloading '${name}':`, err);
      }
    }
  }

  routeCallback(callbackId: string, args: unknown[], invocationId: string): void {
    const pluginName = this.callbackRouter.get(callbackId);
    if (pluginName == null) {
      console.warn(`[SandboxManager] No owner for callback '${callbackId}'`);
      this.connection.respond(PH_CALLBACK_RESULT, invocationId, {
        success: false,
        error: `No owner for callback '${callbackId}'`,
      });
      return;
    }

    const sandbox = this.sandboxes.get(pluginName);
    if (sandbox == null) {
      console.warn(`[SandboxManager] Plugin '${pluginName}' not running for callback '${callbackId}'`);
      this.connection.respond(PH_CALLBACK_RESULT, invocationId, {
        success: false,
        error: `Plugin '${pluginName}' not running for callback '${callbackId}'`,
      });
      return;
    }

    sandbox.postMessage({
      type: PH_CALLBACK_INVOCATION,
      callbackId,
      args,
      invocationId,
    });
  }

  registerCallbackOwner(callbackId: string, pluginName: string): void {
    this.callbackRouter.set(callbackId, pluginName);
  }

  unregisterCallbackOwner(callbackId: string): void {
    this.callbackRouter.delete(callbackId);
  }

  broadcastEvent(eventName: string, args: unknown[]): void {
    for (const sandbox of this.sandboxes.values()) {
      if (sandbox.getState() === 'running') {
        sandbox.postMessage({
          type: PH_EVENT,
          payload: { eventName, args },
        });
      }
    }
  }

  trustAndReEnable(pluginName: string): void {
    this.quarantineManager.trustAndReEnable(pluginName);
  }

  getLoadedPluginNames(): string[] {
    return [...this.sandboxes.keys()];
  }

  getSandbox(pluginName: string): PluginSandbox | undefined {
    return this.sandboxes.get(pluginName);
  }

  getHealthReport(pluginName: string): PluginHealthReport {
    const sandbox = this.sandboxes.get(pluginName);
    const isQuarantined = this.quarantineManager.isQuarantined(pluginName);

    let state: PluginHealthReport['state'];
    if (isQuarantined) {
      state = 'quarantined';
    } else if (sandbox != null && sandbox.getState() === 'running') {
      state = 'running';
    } else if (sandbox != null && sandbox.getState() === 'crashed') {
      state = 'crashed';
    } else {
      state = 'stopped';
    }

    const startTime = this.startTimes.get(pluginName);
    const uptimeMs = state === 'running' && startTime != null ? Date.now() - startTime : 0;

    return {
      pluginName,
      state,
      crashCount: this.quarantineManager.getCrashCount(pluginName),
      totalCrashes: this.totalCrashes.get(pluginName) ?? 0,
      activationTimeMs: this.activationTimes.get(pluginName) ?? 0,
      uptimeMs,
      workerThreadId: sandbox?.getThreadId(),
    };
  }

  getAllHealthReports(): PluginHealthReport[] {
    const names = new Set([...this.sandboxes.keys(), ...this.activationTimes.keys()]);
    return [...names].map((name) => this.getHealthReport(name));
  }

  private handleWorkerMessage(pluginName: string, msg: SandboxWorkerMessage): void {
    const { type } = msg;

    switch (type) {
      case PH_API_REQUEST: {
        const payload = msg.payload as ApiRequestPayload;
        const requestId = msg.requestId as string;
        // Stamp pluginName onto the payload — this is the trusted attestation
        const attestedPayload: ApiRequestPayload = {
          ...payload,
          pluginName,
        };

        this.connection
          .request(PH_API_REQUEST, attestedPayload)
          .then((result) => {
            const sandbox = this.sandboxes.get(pluginName);
            sandbox?.postMessage({
              type: 'apiResponse',
              requestId,
              payload: { success: true, result },
            });
          })
          .catch((err: Error) => {
            const sandbox = this.sandboxes.get(pluginName);
            sandbox?.postMessage({
              type: 'apiResponse',
              requestId,
              payload: { success: false, error: err.message },
            });
          });
        break;
      }

      case PH_REGISTER_CALLBACK: {
        const payload = msg.payload as RegisterCallbackPayload;
        this.registerCallbackOwner(payload.callbackId, pluginName);

        const requestId = msg.requestId as string;
        this.connection
          .request(PH_REGISTER_CALLBACK, {
            ...payload,
            pluginName,
          })
          .then((result) => {
            const sandbox = this.sandboxes.get(pluginName);
            sandbox?.postMessage({
              type: 'registerCallbackResponse',
              requestId,
              payload: { success: true, result },
            });
          })
          .catch((err: Error) => {
            const sandbox = this.sandboxes.get(pluginName);
            sandbox?.postMessage({
              type: 'registerCallbackResponse',
              requestId,
              payload: { success: false, error: err.message },
            });
          });
        break;
      }

      case PH_UNREGISTER_CALLBACK: {
        const callbackId = (msg.payload as { callbackId: string }).callbackId;
        this.unregisterCallbackOwner(callbackId);
        this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
        break;
      }

      case PH_CALLBACK_RESULT: {
        const requestId = msg.requestId as string;
        const payload = msg.payload;
        this.connection.respond(PH_CALLBACK_RESULT, requestId, payload);
        break;
      }

      case 'console': {
        const level = (msg.level as string) ?? 'log';
        const args = (msg.args as unknown[]) ?? [];
        const prefix = `[Plugin: ${pluginName}]`;
        switch (level) {
          case 'error':
            console.error(prefix, ...args);
            break;
          case 'warn':
            console.warn(prefix, ...args);
            break;
          default:
            console.log(prefix, ...args);
            break;
        }
        break;
      }

      default:
        console.warn(`[SandboxManager] Unknown message type '${type}' from '${pluginName}'`);
    }
  }

  private cleanupCallbacksForPlugin(pluginName: string): void {
    for (const [callbackId, owner] of this.callbackRouter) {
      if (owner === pluginName) {
        this.callbackRouter.delete(callbackId);
        this.connection.send(PH_UNREGISTER_CALLBACK, { callbackId });
      }
    }
  }
}
