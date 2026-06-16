import type { RegisterWebviewPaneOptions } from './types';

/**
 * Pane registration API for adding webview-backed panels to the Studio layout.
 *
 * Pane IDs are automatically namespaced to `plugin.<pluginName>.<id>`.
 */
export interface PanesApi {
  /**
   * Register a webview-backed pane in one of the Studio's layout areas.
   *
   * @param options - Pane configuration including area, group, and webview settings.
   */
  registerWebviewPane(options: RegisterWebviewPaneOptions): Promise<void>;

  /**
   * Show or hide a pane. This is the sole runtime control for plugin pane
   * visibility — newly registered panes are visible by default; call
   * `setVisible(id, false)` to hide them.
   *
   * The visibility state persists until changed by another `setVisible` call
   * or until the plugin is disabled (at which point all state is cleared).
   *
   * @param paneId - The local pane ID (without the `plugin.<name>.` prefix).
   * @param visible - `true` to show the pane, `false` to hide it.
   */
  setVisible(paneId: string, visible: boolean): Promise<void>;
}
