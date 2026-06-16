import { AbstractEmitter, type PluginInfo } from '@evil/bifrost_fw_sdk';

import type { IPluginHost } from '../../contracts/PluginHostTypes';
import { PluginPermissionStore } from './PluginPermissionStore';

const NULL_STORAGE = {
  save(_data: any): void {},
  load(): any {
    return null;
  },
  clear(): void {},
};

/**
 * No-op PluginHost for non-Electron targets (webapp, embed).
 * Satisfies the IPluginHost contract so modules can call
 * `bifrost.plugins.*` unconditionally without null guards.
 */
export class NullPluginHost extends AbstractEmitter implements IPluginHost {
  private permissionStore = new PluginPermissionStore(NULL_STORAGE as any);

  async start(): Promise<void> {}
  async discoverAndLoadPlugins(_disabledPlugins?: string[]): Promise<void> {}
  async refresh(): Promise<void> {}
  async unloadPlugin(_name: string): Promise<void> {}
  removePlugin(_name: string): void {}
  async reloadPlugin(_name: string): Promise<void> {}
  async trustAndReEnablePlugin(_name: string): Promise<void> {}
  getPluginList(): PluginInfo[] {
    return [];
  }
  getPermissionStore(): PluginPermissionStore {
    return this.permissionStore;
  }
  getPluginsDirectory(): string {
    return '';
  }
  isRunning(): boolean {
    return false;
  }
  async dispose(): Promise<void> {}
  getLog(): string[] {
    return [];
  }
  onLog(_handler: (line: string) => void): void {}
  clearLog(): void {}
}
