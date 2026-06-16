import type { MenuBarItem, MenuBarItemArea } from '../contracts/MenuBarTypes';
import type { MenuBarItemModifierConfig } from './types';

/**
 * Menu bar contribution API, mirroring {@link MenuBarMediator}.
 *
 * Plugins register static {@link MenuBarItem} arrays instead of factory
 * functions, and declarative modifier configs instead of modifier closures.
 */
export interface MenuBarApi {
  /**
   * Register menu bar items in a given area.
   *
   * @param area - Target area: `'left'`, `'center'`, or `'right'`.
   * @param items - Static array of {@link MenuBarItem} POJOs.
   */
  registerMenuBarItem(area: MenuBarItemArea, items: MenuBarItem[]): Promise<void>;

  /**
   * Register a menu bar item modifier using a declarative config.
   *
   * The bridge translates the config into a real modifier function
   * using `insertAfterMenuBarItem` or `insertBeforeMenuBarItem`.
   *
   * @param config - Declarative modifier configuration.
   */
  registerMenuBarItemModifier(config: MenuBarItemModifierConfig): Promise<void>;

  /** Whether the menu bar is currently visible. */
  isVisible(): Promise<boolean>;
}
