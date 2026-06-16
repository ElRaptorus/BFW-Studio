import type { MenuModifierConfig } from './types';

/**
 * Application menu modification API, mirroring {@link MenuMediator}.
 *
 * Plugins modify existing menus using declarative configs that the bridge
 * translates into `registerMenuModifier` calls with the appropriate
 * positioning utility function.
 */
export interface MenusApi {
  /**
   * Register a modifier for an existing application menu.
   *
   * @param menuId - The menu ID to modify (e.g. `'std/application/main'`).
   * @param config - Items to add and their positioning.
   */
  registerMenuModifier(menuId: string, config: MenuModifierConfig): Promise<void>;
}
