import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import { EVENT_SETTINGS_CHANGED } from '#bifrost/contracts/internal/SettingsEvents';
import { EVENT_THEME_CHANGED } from '#bifrost/contracts/internal/ThemeEvents';

import type { SettingsMediator } from '../common/SettingsMediator';
import { ThemeManager } from '../common/ThemeManager';
import type { ThemeDefinition, ThemeType } from '../contracts/ThemeTypes';

export class ThemeMediator extends AbstractEmitter {
  private themeManager: ThemeManager;
  private settings: SettingsMediator;
  private rootElement: HTMLElement | null = null;

  constructor(settings: SettingsMediator) {
    super();

    this.settings = settings;

    this.themeManager = new ThemeManager();

    this.themeManager.on(EVENT_THEME_CHANGED, (themeId: string) => {
      this.applyTheme(themeId);
      this.emit(EVENT_THEME_CHANGED, [themeId]);
    });

    this.settings.on(EVENT_SETTINGS_CHANGED, (name: string, value: any) => {
      if (name === 'workbench.general.theme' && value !== this.themeManager.getActiveThemeId()) {
        this.themeManager.setActiveThemeId(value);
      }
    });
  }

  setRootElement(element: HTMLElement): void {
    this.rootElement = element;
    this.applyTheme(this.themeManager.getActiveThemeId());
  }

  registerTheme(definition: ThemeDefinition): void {
    this.themeManager.registerTheme(definition);
  }

  unregisterTheme(id: string): void {
    this.themeManager.unregisterTheme(id);
  }

  setTheme(id: string): void {
    this.themeManager.setActiveThemeId(id);
    this.settings.set('workbench.general.theme', id);
  }

  getTheme(id: string): ThemeDefinition | undefined {
    return this.themeManager.getTheme(id);
  }

  getCurrentTheme(): string {
    return this.themeManager.getActiveThemeId();
  }

  getCurrentThemeType(): ThemeType {
    const theme = this.themeManager.getTheme(this.themeManager.getActiveThemeId());
    return theme?.type ?? 'dark';
  }

  isCurrentThemeDark(): boolean {
    return this.getCurrentThemeType() === 'dark';
  }

  getRegisteredThemes(): ThemeDefinition[] {
    return this.themeManager.getRegisteredThemes();
  }

  /**
   * Returns the CSS class names that must be on the root element for the
   * given theme.  Plugin themes only provide partial token overrides, so
   * they are layered on top of the matching base theme (`dark` / `light`).
   */
  getThemeClassNames(themeId: string): string {
    const classes = ['bifrost'];

    const themeDef = this.themeManager.getTheme(themeId);
    if (themeDef != null && themeId.startsWith('plugin.')) {
      const baseThemeId = themeDef.type === 'light' ? 'light' : 'dark';
      classes.push(`bifrost-theme--${baseThemeId}`);
    }

    classes.push(`bifrost-theme--${themeId}`);
    return classes.join(' ');
  }

  private applyTheme(themeId: string): void {
    if (this.rootElement == null) {
      return;
    }

    const allThemes = this.themeManager.getRegisteredThemes();
    for (const theme of allThemes) {
      this.rootElement.classList.remove(`bifrost-theme--${theme.id}`);
    }
    this.rootElement.classList.remove('bifrost-theme--dark');
    this.rootElement.classList.remove('bifrost-theme--light');

    const themeDef = this.themeManager.getTheme(themeId);
    if (themeDef != null && themeId.startsWith('plugin.')) {
      const baseThemeId = themeDef.type === 'light' ? 'light' : 'dark';
      this.rootElement.classList.add(`bifrost-theme--${baseThemeId}`);
    }

    this.rootElement.classList.add(`bifrost-theme--${themeId}`);
  }
}
