import type { Bifrost } from '#bifrost/Bifrost';
import type { AbstractSubscription } from '#bifrost/common/AbstractEmitter';
import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import { IPC_INVOKE_UNINSTALL_PLUGIN, IPC_MESSAGE_PLUGIN_STATE_CHANGED } from '#bifrost/contracts/IpcEvents';
import type { IPluginHost } from '#bifrost/contracts/PluginHostTypes';
import { EVENT_PLUGIN_LIST_CHANGED } from '#bifrost/contracts/PluginHostTypes';
import type { PluginInfo } from '#bifrost/contracts/PluginHostTypes';

export const EVENT_PLUGIN_HOST_LOG = 'EVENT_PLUGIN_HOST_LOG';

/**
 * Renderer-side service for the Plugins pane. Wraps `bifrost.plugins`
 * calls, manages in-memory state, and re-emits
 * {@link EVENT_PLUGIN_LIST_CHANGED} so the pane rerenders when the
 * plugin list changes.
 *
 * Follows the same AbstractEmitter pattern as SettingsMediator:
 * consumers subscribe via `pluginService.on(EVENT_PLUGIN_LIST_CHANGED, ...)`.
 */
export class PluginService extends AbstractEmitter {
  private bifrost: Bifrost;
  private pluginHost: IPluginHost;
  private logoCache = new Map<string, string>();
  private suppressHostSync = false;
  private resyncTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(bifrost: Bifrost, pluginHost: IPluginHost) {
    super();
    this.bifrost = bifrost;
    this.pluginHost = pluginHost;

    this.pluginHost.on(EVENT_PLUGIN_LIST_CHANGED, () => {
      if (this.suppressHostSync) {
        return;
      }
      this.emit(EVENT_PLUGIN_LIST_CHANGED);
    });

    this.pluginHost.onLog((line) => {
      this.emit(EVENT_PLUGIN_HOST_LOG, [line]);
    });

    this.listenForCrossWindowChanges();
  }

  async initialize(): Promise<void> {
    try {
      await this.pluginHost.start();
      const disabledPlugins = (this.bifrost.settings.get('plugins.disabledPlugins') as string[] | undefined) ?? [];
      await this.pluginHost.discoverAndLoadPlugins(disabledPlugins);
    } catch (err) {
      console.error('[Bifrost] Plugin Host failed to start:', err);
      this.bifrost.notifications.open({
        type: 'error',
        content: `Plugin Host failed to start: ${err instanceof Error ? err.message : String(err)}`,
        source: 'Plugin Host',
      });
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.pluginHost.dispose();
    } catch (err) {
      console.error('[PluginService] Failed to dispose plugin host:', err);
    }
  }

  cacheLogo(logoPath: string, logoDataUrl: string): void {
    this.logoCache.set(logoPath, logoDataUrl);
  }

  isLogoCached(logoPath: string): boolean {
    return this.logoCache.has(logoPath);
  }

  clearLogoCache(): void {
    this.logoCache.clear();
  }

  clearLogoCacheEntry(logoPath: string): void {
    this.logoCache.delete(logoPath);
  }

  getPluginsDirectory(): string {
    return this.pluginHost.getPluginsDirectory();
  }

  getCachedLogo(logoPath: string | undefined): string | null {
    if (!logoPath) {
      return null;
    }
    return this.logoCache.get(logoPath) ?? null;
  }

  getPluginList(): PluginInfo[] {
    return this.pluginHost.getPluginList();
  }

  async refreshFromHost(): Promise<void> {
    this.clearLogoCache();
    await this.pluginHost.refresh();
    this.emit(EVENT_PLUGIN_LIST_CHANGED);
    this.closeOrphanedReadmeTabs();
    this.notifyPluginStateChanged('refresh', '*');
  }

  async togglePlugin(pluginName: string): Promise<void> {
    const disabledPlugins: string[] = (this.bifrost.settings.get('plugins.disabledPlugins') as string[]) ?? [];
    const isCurrentlyDisabled = disabledPlugins.includes(pluginName);
    const plugin = this.pluginHost.getPluginList().find((entry) => entry.name === pluginName);

    if (isCurrentlyDisabled) {
      this.bifrost.settings.set(
        'plugins.disabledPlugins',
        disabledPlugins.filter((name) => name !== pluginName),
      );
      await this.pluginHost.reloadPlugin(pluginName);
      this.notifyPluginStateChanged('enable', pluginName);
    } else if (plugin?.status === 'error') {
      await this.pluginHost.reloadPlugin(pluginName);
      this.notifyPluginStateChanged('reload', pluginName);
    } else {
      this.bifrost.settings.set('plugins.disabledPlugins', [...disabledPlugins, pluginName]);
      await this.pluginHost.unloadPlugin(pluginName);
      this.closePluginReadmeTab(pluginName);
      this.notifyPluginStateChanged('disable', pluginName);
    }

    if (plugin?.logoPath) {
      this.clearLogoCacheEntry(plugin.logoPath);
    }
  }

  async disablePlugin(pluginName: string): Promise<void> {
    const disabledPlugins: string[] = (this.bifrost.settings.get('plugins.disabledPlugins') as string[]) ?? [];
    if (!disabledPlugins.includes(pluginName)) {
      this.bifrost.settings.set('plugins.disabledPlugins', [...disabledPlugins, pluginName]);
    }

    const plugin = this.pluginHost.getPluginList().find((entry) => entry.name === pluginName);
    await this.pluginHost.unloadPlugin(pluginName);
    this.closePluginReadmeTab(pluginName);
    this.notifyPluginStateChanged('disable', pluginName);

    if (plugin?.logoPath) {
      this.clearLogoCacheEntry(plugin.logoPath);
    }
  }

  async trustAndReEnablePlugin(pluginName: string): Promise<void> {
    await this.pluginHost.trustAndReEnablePlugin(pluginName);
    const plugin = this.pluginHost.getPluginList().find((entry) => entry.name === pluginName);
    if (plugin?.logoPath) {
      this.clearLogoCacheEntry(plugin.logoPath);
    }
    this.notifyPluginStateChanged('enable', pluginName);
  }

  async uninstallPlugin(plugin: PluginInfo): Promise<void> {
    const dialogResult = await this.bifrost.dialog.open({
      title: 'Uninstall Plugin',
      content: `Uninstall plugin '${plugin.displayName}'? This will move the plugin folder to trash.`,
      actions: [
        { label: 'Cancel', response: 'cancel', cancel: true },
        { label: 'Uninstall', response: 'uninstall', dangerous: true, default: true },
      ],
    });

    if (dialogResult.wasCancelled || dialogResult.response !== 'uninstall') {
      return;
    }

    try {
      this.suppressHostSync = true;

      if (plugin.enabled) {
        await this.pluginHost.unloadPlugin(plugin.name);
      }
      this.closePluginReadmeTab(plugin.name);

      const { ipcRenderer } = await import('electron');
      await ipcRenderer.invoke(IPC_INVOKE_UNINSTALL_PLUGIN, plugin.path);

      this.pluginHost.removePlugin(plugin.name);
      this.pluginHost.getPermissionStore().remove(plugin.name);

      const disabledPlugins: string[] = (this.bifrost.settings.get('plugins.disabledPlugins') as string[]) ?? [];
      if (disabledPlugins.includes(plugin.name)) {
        this.bifrost.settings.set(
          'plugins.disabledPlugins',
          disabledPlugins.filter((name) => name !== plugin.name),
        );
      }

      if (plugin.logoPath) {
        this.clearLogoCacheEntry(plugin.logoPath);
      }

      this.emit(EVENT_PLUGIN_LIST_CHANGED);
      this.notifyPluginStateChanged('uninstall', plugin.name);
    } catch (err) {
      this.bifrost.notifications.open({
        type: 'error',
        content: `Failed to uninstall '${plugin.displayName}': ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      this.suppressHostSync = false;
    }
  }

  getPluginHostLog(): string[] {
    return this.pluginHost.getLog();
  }

  onPluginHostLog(handler: (line: string) => void): AbstractSubscription {
    return this.on(EVENT_PLUGIN_HOST_LOG, handler);
  }

  clearPluginHostLog(): void {
    this.pluginHost.clearLog();
  }

  private closeOrphanedReadmeTabs(): void {
    const pluginNames = new Set(this.pluginHost.getPluginList().map((plugin) => plugin.name));
    const PREFIX = 'about:plugin-readme/';

    const orphanedDocs = this.bifrost.editors
      .getOpenEditorDocuments()
      .filter((doc) => doc.uri.startsWith(PREFIX) && !pluginNames.has(doc.uri.slice(PREFIX.length)));

    if (orphanedDocs.length > 0) {
      this.bifrost.editors.closeEditorDocumentsUntilUserCancels(orphanedDocs, true);
    }
  }

  private closePluginReadmeTab(pluginName: string): void {
    const uri = `about:plugin-readme/${pluginName}`;
    const docs = this.bifrost.editors.getOpenEditorDocuments().filter((doc) => doc.uri === uri);
    if (docs.length > 0) {
      this.bifrost.editors.closeEditorDocumentsUntilUserCancels(docs, true);
    }
  }

  private notifyPluginStateChanged(action: string, pluginName: string): void {
    try {
      const electron = require('electron') as { ipcRenderer: { send: (...args: any[]) => void } };
      electron.ipcRenderer.send(IPC_MESSAGE_PLUGIN_STATE_CHANGED, action, pluginName);
    } catch {
      // Not running in Electron (e.g. tests) — ignore
    }
  }

  private listenForCrossWindowChanges(): void {
    try {
      const electron = require('electron') as { ipcRenderer: { on: (...args: any[]) => void } };
      electron.ipcRenderer.on(IPC_MESSAGE_PLUGIN_STATE_CHANGED, (_event: any) => {
        this.debouncedResync();
      });
    } catch {
      // Not running in Electron (e.g. tests) — ignore
    }
  }

  private debouncedResync(): void {
    if (this.resyncTimeout != null) {
      clearTimeout(this.resyncTimeout);
    }
    this.resyncTimeout = setTimeout(async () => {
      this.resyncTimeout = null;
      try {
        this.clearLogoCache();
        await this.pluginHost.refresh();
        this.closeOrphanedReadmeTabs();
        this.emit(EVENT_PLUGIN_LIST_CHANGED);
      } catch (err) {
        console.error('[PluginService] Cross-window resync failed:', err);
      }
    }, 500);
  }
}
