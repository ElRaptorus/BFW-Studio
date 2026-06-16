import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import { EVENT_THEME_CHANGED } from '../../../../studio-sdk/src/contracts/internal/ThemeEvents';
import type { ThemeDefinition } from '../contracts/ThemeTypes';

export class ThemeManager extends AbstractEmitter {
  private themes: Map<string, ThemeDefinition> = new Map();
  private activeThemeId: string = 'dark';

  constructor() {
    super();
  }

  registerTheme(definition: ThemeDefinition): void {
    this.themes.set(definition.id, definition);
  }

  unregisterTheme(id: string): void {
    if (!this.themes.has(id)) {
      throw new Error(`Theme '${id}' is not registered.`);
    }
    this.themes.delete(id);
  }

  getTheme(id: string): ThemeDefinition | undefined {
    return this.themes.get(id);
  }

  getRegisteredThemes(): ThemeDefinition[] {
    return Array.from(this.themes.values());
  }

  getActiveThemeId(): string {
    return this.activeThemeId;
  }

  setActiveThemeId(id: string): void {
    if (!this.themes.has(id)) {
      throw new Error(`Theme '${id}' is not registered.`);
    }
    if (this.activeThemeId === id) {
      return;
    }
    this.activeThemeId = id;
    this.emit(EVENT_THEME_CHANGED, [id]);
  }
}
