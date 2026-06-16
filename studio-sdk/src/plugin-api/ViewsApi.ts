import type { PluginTreeItem, TreeViewOptions } from './types';

/**
 * Tree view API for registering custom tree views hosted in pane areas.
 *
 * Tree data is push-based: the plugin pushes a full `PluginTreeItem[]`
 * hierarchy via {@link updateTreeData} and the bridge renders it using
 * the SDK's `Tree` component.
 *
 * View IDs are automatically namespaced to `plugin.<pluginName>.<id>`.
 */
export interface ViewsApi {
  /**
   * Register a tree view pane in one of the Studio's layout areas.
   *
   * The tree starts empty — call {@link updateTreeData} to populate it.
   *
   * @param options - Tree view configuration (area, title, icon, etc.).
   */
  registerTreeView(options: TreeViewOptions): Promise<void>;

  /**
   * Push new tree data to a registered tree view. Replaces any
   * previously set items and triggers a re-render.
   *
   * @param viewId - The local view ID (without the `plugin.<name>.` prefix).
   * @param items - The full tree hierarchy to display.
   */
  updateTreeData(viewId: string, items: PluginTreeItem[]): Promise<void>;
}
