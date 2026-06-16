import type { AbstractSubscription } from '../../src/common/AbstractEmitter';
import type { PluginInfo } from '../../src/contracts/PluginTypes';

/**
 * Renderer-side service for the Plugins pane. Wraps `studio.plugins`
 * calls, manages in-memory state, and re-emits
 * EVENT_PLUGIN_LIST_CHANGED so the pane rerenders when the
 * plugin list changes.
 *
 * Follows the same AbstractEmitter pattern as SettingsMediator:
 * consumers subscribe via `pluginService.on(EVENT_PLUGIN_LIST_CHANGED, ...)`.
 */
export declare class PluginService {
  cacheLogo(logoPath: string, logoDataUrl: string): void;

  isLogoCached(logoPath: string): boolean;

  clearLogoCacheEntry(logoPath: string): void;

  getCachedLogo(logoPath: string | undefined): string | null;

  getPluginList(): PluginInfo[];

  getPluginHostLog(): string[];

  onPluginHostLog(handler: (line: string) => void): AbstractSubscription;

  clearPluginHostLog(): void;
}
