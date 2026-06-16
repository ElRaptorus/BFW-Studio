import type { Menu, MenuFactoryFunction } from '@evil/bifrost_fw_sdk';

import type { Bifrost } from '../Bifrost';

type MenuManagerEntry = {
  factoryFn: MenuFactoryFunction;
};

export class MenuManager {
  private menus: { [menuId: string]: MenuManagerEntry } = {};

  getMenu(menuId: string, menuFactoryFnArgs?: any[]): Menu | Promise<Menu> {
    if (this.menus[menuId] == null) {
      throw new Error(`Menu not registered: ${menuId}`);
    }

    const { factoryFn } = this.menus[menuId];
    const factoryFnArgs = menuFactoryFnArgs ?? [];

    try {
      return factoryFn(...factoryFnArgs);
    } catch (error) {
      this.deferError(error);
      return [];
    }
  }

  registerMenu(menuId: string, menuFactoryFn: MenuFactoryFunction): void {
    if (this.menus[menuId]) {
      throw new Error(`Menu already registered: ${menuId}`);
    }

    this.menus[menuId] = { factoryFn: menuFactoryFn };
  }

  /**
   * Internal: Registers a `menuModifierFn` which is applied to the menu generated for `menuId`.
   * Returns a disposer that restores the previous factory function when called.
   */
  registerMenuModifier(menuId: string, menuModifierFn: MenuFactoryFunction): { dispose: () => void } {
    if (this.menus[menuId] == null) {
      throw new Error(`Menu not registered: ${menuId}`);
    }

    const originalFactoryFn = this.menus[menuId].factoryFn;
    let disposed = false;

    const modifiedFactoryfn = (...menuFactoryFnArgs: any[]): Menu | Promise<Menu> => {
      const originalFactoryFnArgs = menuFactoryFnArgs ?? [];
      let originalMenu: Menu | Promise<Menu> = [];

      try {
        originalMenu = originalFactoryFn(...originalFactoryFnArgs);
      } catch (error) {
        this.deferError(error);
        return [];
      }

      if (disposed) {
        return originalMenu;
      }

      if (typeof (originalMenu as any)?.then === 'function') {
        return (originalMenu as Promise<Menu>).then(
          (resolvedMenu) => {
            if (disposed) {
              return resolvedMenu;
            }
            try {
              return menuModifierFn(resolvedMenu, ...originalFactoryFnArgs);
            } catch (error) {
              this.deferError(error);
              return resolvedMenu;
            }
          },
          (error) => {
            this.deferError(error);
            return [];
          },
        );
      }

      try {
        return menuModifierFn(originalMenu, ...originalFactoryFnArgs);
      } catch (error) {
        this.deferError(error);
        return originalMenu;
      }
    };

    this.menus[menuId].factoryFn = modifiedFactoryfn;

    return {
      dispose: () => {
        disposed = true;
      },
    };
  }

  /**
   * Updates persistent menus, e.g. the application menu (when running in Electron).
   */
  async updateMenus(_bifrost: Bifrost): Promise<void> {
    //
  }

  isMenuRegistered(menuId: string): boolean {
    if (this.menus[menuId] == null) {
      return false;
    }

    return true;
  }

  private deferError(error: Error): void {
    setTimeout(() => {
      throw error;
    }, 10);
  }
}
