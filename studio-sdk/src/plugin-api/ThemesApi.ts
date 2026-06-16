import type { PluginThemeDefinition } from './types';

/**
 * Theme contribution API for registering custom CSS themes at runtime.
 *
 * Theme IDs are automatically namespaced to `plugin.<pluginName>.<id>`.
 *
 * Themes can also be declared in the manifest (`contributes.themes`)
 * for lazy-load availability before plugin activation.
 */
export interface ThemesApi {
  /**
   * Register a custom theme. The theme appears in the Settings
   * "Theme" dropdown alongside built-in themes.
   *
   * Token keys may omit the leading `--` prefix — it is auto-prepended
   * if missing (e.g. `theme-background` → `--theme-background`).
   *
   * @param definition - Theme metadata and CSS token overrides.
   */
  register(definition: PluginThemeDefinition): Promise<void>;

  /**
   * Remove a previously registered theme.
   *
   * If the removed theme is currently active, the Studio falls back
   * to the matching default theme by type: **Bifrost Night** for
   * `dark` themes, **Bifrost Day** for `light` themes.
   *
   * @param themeId - The local theme ID (without the `plugin.<name>.` prefix).
   */
  unregister(themeId: string): Promise<void>;

  /**
   * Get the ID of the currently active theme.
   */
  getActiveTheme(): Promise<string>;
}
