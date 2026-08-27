import type { StudioAgent } from '../StudioAgent';

export const PLUGIN_HOST_WAIT_TIMEOUT_MS = 30_000;

export interface PluginInfoRecord {
  name: string;
  status: string;
  enabled: boolean;
  displayName?: string;
  version?: string;
  description?: string;
  author?: string;
  readmePath?: string;
  logoPath?: string;
  homepage?: string;
  keywords?: string[];
  deprecated?: boolean | string;
  manifest?: Record<string, unknown>;
  manifestErrors?: unknown[];
  manifestWarnings?: unknown[];
  errorMessage?: string;
  packageName?: string;
  [key: string]: unknown;
}

export default class PluginHost {
  private studioAgent: StudioAgent;

  constructor(studioAgent: StudioAgent) {
    this.studioAgent = studioAgent;
  }

  async getList(): Promise<PluginInfoRecord[]> {
    const envelope = (await this.studioAgent.getTestDriver().client!.execute(() => ({
      value: (window as any).bifrost.plugins.getPluginList(),
    }))) as { value: PluginInfoRecord[] };

    return envelope.value;
  }

  async getByName(pluginName: string): Promise<PluginInfoRecord | undefined> {
    return (await this.getList()).find((entry) => entry.name === pluginName);
  }

  async waitUntilListCountAtLeast(minimumCount: number): Promise<void> {
    await this.studioAgent.waitUntil(async () => (await this.getList()).length >= minimumCount, {
      timeout: PLUGIN_HOST_WAIT_TIMEOUT_MS,
      timeoutMsg: `Expected at least ${minimumCount} plugins but timed out`,
    });
  }

  async waitUntilStatus(pluginName: string, expectedStatus: string): Promise<void> {
    await this.studioAgent.waitUntil(async () => (await this.getByName(pluginName))?.status === expectedStatus, {
      timeout: PLUGIN_HOST_WAIT_TIMEOUT_MS,
      timeoutMsg: `Plugin '${pluginName}' did not reach status '${expectedStatus}' in time`,
    });
  }

  async isCommandRegistered(commandId: string): Promise<boolean> {
    const envelope = (await this.studioAgent.getTestDriver().client!.execute(
      (command: string) => ({
        value: (window as any).bifrost.commands.isRegistered(command),
      }),
      commandId,
    )) as { value: boolean };

    return envelope.value;
  }

  async waitUntilCommandRegistered(commandId: string): Promise<void> {
    await this.studioAgent.waitUntil(async () => this.isCommandRegistered(commandId), {
      timeout: PLUGIN_HOST_WAIT_TIMEOUT_MS,
      timeoutMsg: `Plugin command '${commandId}' was not registered in time`,
    });
  }

  async isSettingRegistered(settingKey: string): Promise<boolean> {
    const envelope = (await this.studioAgent.getTestDriver().client!.execute(
      (key: string) => ({
        value: (window as any).bifrost.settings.has(key),
      }),
      settingKey,
    )) as { value: boolean };

    return envelope.value;
  }

  async toggle(pluginName: string): Promise<void> {
    await this.studioAgent.getTestDriver().client!.execute((name: string) => {
      return (window as any).bifrost.plugins.togglePlugin(name);
    }, pluginName);
  }

  async toggleAndWaitUntilStatus(pluginName: string, expectedStatus: string): Promise<void> {
    await this.toggle(pluginName);
    await this.waitUntilStatus(pluginName, expectedStatus);
  }

  async getHostLog(): Promise<string[]> {
    const envelope = (await this.studioAgent.getTestDriver().client!.execute(() => ({
      value: (window as any).bifrost.plugins.getPluginHostLog(),
    }))) as { value: string[] };

    return envelope.value;
  }

  async clearHostLog(): Promise<void> {
    await this.studioAgent.getTestDriver().client!.execute(() => (window as any).bifrost.plugins.clearPluginHostLog());
  }
}
