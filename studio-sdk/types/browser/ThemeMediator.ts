import { AbstractEmitter } from '../common/AbstractEmitter';

export type ThemeType = 'light' | 'dark';

export type ThemeDefinition = {
  readonly id: string;
  readonly label: string;
  readonly type: ThemeType;
};

/**
 * Manages the Studio's color theme. Provides methods for registering, switching, and querying themes.
 *
 * Access via `studio.theme`.
 *
 * The ThemeMediator extends AbstractEmitter, so plugins can subscribe to theme events:
 *
 *    import { EVENT_THEME_CHANGED } from '@evil/bifrost_fw_sdk/contracts/internal/ThemeEvents';
 *
 *    studio.theme.on(EVENT_THEME_CHANGED, (themeId) => {
 *      // react to theme change
 *    });
 */
export declare class ThemeMediator extends AbstractEmitter {
  /**
   * Registers a custom theme with the Studio.
   *
   * Theme tokens (CSS custom properties) are defined in SCSS under
   * `.bifrost.bifrost-theme--<id>` selectors — not via this API.
   * This method only registers the theme's metadata so the Studio
   * can list and switch to it.
   *
   * Example:
   *
   *    studio.theme.registerTheme({
   *      id: 'dark-high-contrast',
   *      label: 'Dark High Contrast',
   *      type: 'dark',
   *    });
   *
   * @param definition The theme definition to register.
   */
  registerTheme(definition: ThemeDefinition): void;

  /**
   * Switches the active theme to the one identified by `id`.
   *
   * The theme must have been registered beforehand via `registerTheme`.
   * This persists the choice to the `workbench.theme` setting.
   *
   * Example:
   *
   *    studio.theme.setTheme('dark');
   *
   * @param id The id of the theme to activate.
   */
  setTheme(id: string): void;

  /**
   * Returns the id of the currently active theme.
   *
   * Example:
   *
   *    const themeId = studio.theme.getCurrentTheme(); // 'dark'
   */
  getCurrentTheme(): string;

  /**
   * Returns the type (`'light'` or `'dark'`) of the currently active theme.
   *
   * Example:
   *
   *    const type = studio.theme.getCurrentThemeType(); // 'dark'
   */
  getCurrentThemeType(): ThemeType;

  /**
   * Returns `true` if the currently active theme is a dark theme.
   *
   * Shorthand for `getCurrentThemeType() === 'dark'`.
   *
   * Example:
   *
   *    const monacoTheme = studio.theme.isCurrentThemeDark() ? 'vs-dark' : 'vs-light';
   */
  isCurrentThemeDark(): boolean;

  /**
   * Returns all registered theme definitions, including the built-in `light` and `dark` themes.
   */
  getRegisteredThemes(): ThemeDefinition[];
}
