import type { Studio } from '../Studio';
import type { Menu, MenuFactoryFunction } from '../contracts/MenuTypes';

export declare class MenuManager {
  getMenu(menuId: string, menuFactoryFnArgs?: any[]): Menu | Promise<Menu>;
  registerMenu(menuId: string, menuFactoryFn: MenuFactoryFunction): void;
  /**
   * Updates persistent menus, e.g. the application menu (when running in Electron).
   */
  updateMenus(studio: Studio): Promise<void>;
  isMenuRegistered(menuId: string): boolean;
}
