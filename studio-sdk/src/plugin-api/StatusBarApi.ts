import type { StatusBarItem, StatusBarItemArea } from '../contracts/StatusBarTypes';
import type { PluginProgressHandle } from './types';

/**
 * Status bar contribution API, mirroring {@link StatusBarMediator}.
 *
 * Plugins register static {@link StatusBarItem} arrays instead of factory
 * functions — the bridge wraps them into the factory the manager expects.
 */
export interface StatusBarApi {
  /**
   * Register status bar items in a given area.
   *
   * @param area - Target area: `'left'`, `'center'`, or `'right'`.
   * @param id - Unique identifier for this registration (used for update/unregister).
   * @param items - Static array of {@link StatusBarItem} POJOs.
   * @param priority - Optional sort priority (higher values appear first). Defaults to `0`.
   */
  registerStatusBarItem(area: StatusBarItemArea, id: string, items: StatusBarItem[], priority?: number): Promise<void>;

  /**
   * Replace the items for a previously registered status bar entry.
   *
   * @param id - The registration ID passed to {@link registerStatusBarItem}.
   * @param items - New array of {@link StatusBarItem} POJOs.
   */
  updateStatusBarItem(id: string, items: StatusBarItem[]): Promise<void>;

  /**
   * Remove a status bar registration.
   *
   * @param id - The registration ID passed to {@link registerStatusBarItem}.
   */
  unregisterStatusBarItem(id: string): Promise<void>;

  /**
   * Show a progress indicator in the status bar.
   *
   * @param label - Initial label text.
   * @returns A handle with `update(label)` and `done()` methods.
   */
  showProgress(label: string): Promise<PluginProgressHandle>;

  /** Whether the status bar is currently visible. */
  isVisible(): Promise<boolean>;
}
