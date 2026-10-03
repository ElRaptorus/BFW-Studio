import type { ManifestPageContribution } from './manifest';

/** A page added to an existing workbench category. Same shape as `contributes.pages` in the manifest. */
export type PluginPageDefinition = ManifestPageContribution;

/** Workbench pages. Pages are removed automatically when the plugin unloads. */
export interface WorkbenchApi {
  /**
   * Adds a page to an existing category. The `id` has the form `<categoryId>/<name>`.
   * Rejects when the definition is malformed, the category does not exist, or the ID is already taken.
   */
  registerPage(definition: PluginPageDefinition): Promise<void>;

  /** Removes a page this plugin added. Rejects for pages registered by someone else. */
  unregisterPage(pageId: string): Promise<void>;
}
