import * as path from 'path';
import { Worker } from 'worker_threads';

import type { PluginPermission } from '../permissions/PermissionTypes';

export interface PluginSandboxOptions {
  pluginName: string;
  pluginPath: string;
  storagePath: string;
  permissions: PluginPermission[];
  resourceLimits?: {
    maxOldGenerationSizeMb?: number;
    maxYoungGenerationSizeMb?: number;
    stackSizeMb?: number;
  };
  startupTimeoutMs?: number;
}

export type SandboxState = 'idle' | 'starting' | 'running' | 'crashed' | 'terminated';

const DEFAULT_STARTUP_TIMEOUT_MS = 60_000;

export class PluginSandbox {
  readonly pluginName: string;
  private worker: Worker | null = null;
  private state: SandboxState = 'idle';
  private messageHandler: ((message: unknown) => void) | null = null;
  private exitHandler: ((code: number) => void) | null = null;

  constructor(private options: PluginSandboxOptions) {
    this.pluginName = options.pluginName;
  }

  async start(): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`[PluginSandbox] Plugin '${this.pluginName}' is in state '${this.state}', cannot start`);
    }

    this.state = 'starting';

    const workerScript = path.resolve(__dirname, 'sandbox-worker.js');
    const timeoutMs = this.options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.state = 'crashed';
        this.worker?.terminate();
        this.worker = null;
        reject(new Error(`Plugin '${this.pluginName}' startup timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.worker = new Worker(workerScript, {
        workerData: {
          pluginName: this.options.pluginName,
          pluginPath: this.options.pluginPath,
          storagePath: this.options.storagePath,
          permissions: this.options.permissions,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this.options.resourceLimits?.maxOldGenerationSizeMb ?? 128,
          maxYoungGenerationSizeMb: this.options.resourceLimits?.maxYoungGenerationSizeMb ?? 16,
          stackSizeMb: this.options.resourceLimits?.stackSizeMb ?? 4,
        },
      });

      this.worker.on('message', (msg: unknown) => {
        const typed = msg as { type: string };

        if (typed.type === 'sandbox:ready') {
          clearTimeout(timer);
          this.state = 'running';
          resolve();
          return;
        }

        if (typed.type === 'sandbox:error') {
          clearTimeout(timer);
          this.state = 'crashed';
          const errorMsg = (msg as { error?: string }).error ?? 'Unknown startup error';
          reject(new Error(`Plugin '${this.pluginName}' failed to start: ${errorMsg}`));
          return;
        }

        this.messageHandler?.(msg);
      });

      this.worker.on('error', (err) => {
        clearTimeout(timer);
        if (this.state === 'starting') {
          this.state = 'crashed';
          reject(
            new Error(`Plugin '${this.pluginName}' Worker error: ${err instanceof Error ? err.message : String(err)}`),
          );
        }
      });

      this.worker.on('exit', (code) => {
        if (this.state === 'running') {
          this.state = 'crashed';
          this.exitHandler?.(code);
        } else if (this.state === 'starting') {
          clearTimeout(timer);
          this.state = 'crashed';
          reject(new Error(`Plugin '${this.pluginName}' Worker exited during startup (code=${code})`));
        }
        this.worker = null;
      });
    });
  }

  async stop(): Promise<void> {
    if (this.worker == null) {
      return;
    }

    this.state = 'terminated';
    this.worker.postMessage({ type: 'sandbox:deactivate' });

    // Give 5 seconds for graceful deactivation
    await Promise.race([
      new Promise<void>((resolve) => {
        this.worker?.once('exit', () => resolve());
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);

    if (this.worker != null) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  terminate(): void {
    this.state = 'terminated';
    this.worker?.terminate();
    this.worker = null;
  }

  postMessage(message: unknown): void {
    this.worker?.postMessage(message);
  }

  onMessage(handler: (message: unknown) => void): void {
    this.messageHandler = handler;
  }

  onExit(handler: (code: number) => void): void {
    this.exitHandler = handler;
  }

  getState(): SandboxState {
    return this.state;
  }

  getThreadId(): number | undefined {
    return this.worker?.threadId;
  }
}
