import type { MenuFactoryFunction } from '#bifrost/contracts/MenuFactory';

import type { Menu, MenuItem } from '@evil/bifrost_fw_sdk';

import type { Bifrost } from '../Bifrost';
import type { MenuManager } from '../common/MenuManager';
import {
  appendToMenu,
  appendToSubMenu,
  insertAfterMenuItem,
  insertBeforeMenuItem,
  prependToMenu,
  prependToSubMenu,
} from '../common/MenuModifierFunctions';
import type { EditorsPanesSettingsSolutionEventMediator } from './EditorsPanesSettingsSolutionEventMediator';
import { EVENT_CONTENT_UPDATE } from './EditorsPanesSettingsSolutionEventMediator';

/**
 * Provides access to menus in Bifrost and can update the persistent application menu.
 *
 * Example:
 *
 *    bifrost.menus.registerMenu('foo/bar', (foo: string, bar: number) => {
 *      return [
 *        {
 *          type: 'command',
 *          label: `${foo} ${bar}`,
 *          command: 'std.internal.empty'
 *        },
 *        {
 *          type: 'command',
 *          label: 'Everything is awesome',
 *          command: 'std.internal.empty'
 *        },
 *      ]
 *    })
 *
 * Later, when retrieving a registered menu, we have to provide the arguments to the function as second argument:
 *
 *    // programmatically via Bifrost
 *    bifrost.menus.getMenu('foo/bar', ['catch', 22])
 *
 *    // or in React:
 *    <div onContextMenu={(event) => showContextMenu(event, "foo/bar", ['catch', 22])}>
 *      <div>Content with context menu</div>
 *    </div>
 *
 * In both cases, the label of the first menu item will read "catch 22".
 */
export class MenuMediator {
  private menuManager: MenuManager;
  private bifrost: Bifrost;

  constructor(
    bifrost: Bifrost,
    menuManager: MenuManager,
    editorsPanesSettingsSolutionEventMediator: EditorsPanesSettingsSolutionEventMediator,
  ) {
    this.bifrost = bifrost;
    this.menuManager = menuManager;

    editorsPanesSettingsSolutionEventMediator.on(EVENT_CONTENT_UPDATE, () => this.updateMenus());
  }

  /**
   * Returns the `Menu` for the given `menuId` and applies `menuFactoryFnArgs` to its factory function.
   *
   * Example:
   *
   *    bifrost.menus.registerMenu('foo/bar', (foo: string, bar: number) => {
   *      return [
   *        {
   *          type: 'command',
   *          label: `${foo} ${bar}`,
   *          command: 'std.internal.empty'
   *        },
   *        {
   *          type: 'command',
   *          label: 'Everything is awesome',
   *          command: 'std.internal.empty'
   *        },
   *      ]
   *    })
   *
   * Later, when retrieving a registered menu, we have to provide the arguments to the function as second argument:
   *
   *    bifrost.menus.getMenu('foo/bar', ['catch', 22])
   *
   * The label of the first menu item will read "catch 22".
   */
  getMenu(menuId: string, menuFactoryFnArgs?: any[]): Menu | Promise<Menu> {
    return this.menuManager.getMenu(menuId, menuFactoryFnArgs);
  }

  getMenuSync(menuId: string, menuFactoryFnArgs?: any[]): Menu {
    const result = this.menuManager.getMenu(menuId, menuFactoryFnArgs);

    if (this.isPromise(result)) {
      throw new Error(`Expected to not get a Promise for menu '${menuId}', but got one.`);
    }

    return result as Menu;
  }

  /**
   * Registers a given `menuFactoryFn` under the given `menuId`.
   *
   * When `menuFactoryFn` is called, it is given the arguments provided to `getMenu`/`showContextMenu` when obtaining
   * the menu.
   *
   * Example:
   *
   *    bifrost.menus.registerMenu('foo/bar', (foo: string, bar: number) => {
   *      return [
   *        {
   *          type: 'command',
   *          label: `${foo} ${bar}`,
   *          command: 'std.internal.empty'
   *        },
   *        {
   *          type: 'command',
   *          label: 'Everything is awesome',
   *          command: 'std.internal.empty'
   *        },
   *      ]
   *    })
   *
   * Later, when retrieving a registered menu, we have to provide the arguments to the function as second argument:
   *
   *    // programmatically via Bifrost
   *    bifrost.menus.getMenu('foo/bar', ['catch', 22])
   *
   *    // or in React:
   *    <div onContextMenu={(event) => showContextMenu(event, "foo/bar", ['catch', 22])}>
   *      <div>Content with context menu</div>
   *    </div>
   *
   * In both cases, the label of the first menu item will read "catch 22".
   */
  registerMenu(menuId: string, menuFactoryFn: MenuFactoryFunction): void {
    this.menuManager.registerMenu(menuId, menuFactoryFn);
  }

  /**
   * Registers a given `menuModifierFn` under the given `menuId`.
   *
   * The modifier function is invoked when the menu with the given `menuId` is retrieved. The function is given the
   * already retrieved menu and the factory function's arguments provided to `getMenu`/`showContextMenu`.
   *
   * Example:
   *
   * First, we register a menu using the usual id and factory function combination:
   *
   *    bifrost.menus.registerMenu('foo/bar', (foo: string, bar: number) => {
   *      return [
   *        {
   *          type: 'command',
   *          label: `${foo} ${bar}`,
   *          command: 'std.internal.empty'
   *        },
   *        {
   *          type: 'command',
   *          label: 'Everything is awesome',
   *          command: 'std.internal.empty'
   *        }
   *      ]
   *    })
   *
   * Later, another piece of code can modify this menu, by registering a modifier function:
   *
   *    bifrost.menus.registerMenuModifier('foo/bar', (menu: Menu, foo: string, bar: number) => {
   *      return bifrost.menus.prependMenu(menu, [
   *        {
   *          type: 'command',
   *          label: `Extra entry ${bar}`,
   *          command: 'std.internal.empty'
   *        }
   *      ])
   *    });
   *
   * Note how the modifier functions receives the generated menu as the first argument. The rest of the arguments are
   * the factory function's arguments provided when retrieving the registered menu.
   *
   * We have to provide these arguments to `bifrost.menus.getMenu` as second argument:
   *
   *    // programmatically via Bifrost
   *    bifrost.menus.getMenu('foo/bar', ['catch', 22])
   *
   *    // or in React:
   *    <div onContextMenu={(event) => showContextMenu(event, "foo/bar", ['catch', 22])}>
   *      <div>Content with context menu</div>
   *    </div>
   *
   * In both cases, the label of the first menu item will read "Extra entry 22".
   */
  registerMenuModifier(menuId: string, menuModifierFn: MenuFactoryFunction): { dispose: () => void } {
    return this.menuManager.registerMenuModifier(menuId, menuModifierFn);
  }

  /**
   * Use this function in tandem with `modifiyMenu` to append menu items to a menu.
   *
   *    bifrost.menus.registerMenuModifier('foo/bar', (menu: Menu, ...factoryFnArgs) => {
   *      return bifrost.menus.appendToMenu(menu, [
   *        {
   *          type: 'command',
   *          label: `Appended menu item`,
   *          command: 'std.internal.empty'
   *        }
   *      ])
   *    });
   *
   */
  appendToMenu(menu: Menu, menuItemsToAppend: MenuItem[]): Menu {
    return appendToMenu(menu, menuItemsToAppend);
  }

  appendToSubmenu(menu: Menu, submenuId: string, menuItemsToAppend: MenuItem[]): Menu {
    return appendToSubMenu(menu, submenuId, menuItemsToAppend);
  }

  prependToMenu(menu: Menu, menuItemsToPrepend: MenuItem[]): Menu {
    return prependToMenu(menu, menuItemsToPrepend);
  }

  prependToSubmenu(menu: Menu, submenuId: string, menuItemsToPrepend: MenuItem[]): Menu {
    return prependToSubMenu(menu, submenuId, menuItemsToPrepend);
  }

  insertAfterMenuItem(menu: Menu, id: string, menuItemsToInsert: MenuItem[]): Menu {
    return insertAfterMenuItem(menu, id, menuItemsToInsert);
  }

  insertBeforeMenuItem(menu: Menu, id: string, menuItemsToInsert: MenuItem[]): Menu {
    return insertBeforeMenuItem(menu, id, menuItemsToInsert);
  }

  isMenuRegistered(menuId: string): boolean {
    return this.menuManager.isMenuRegistered(menuId);
  }

  /**
   * Updates persistent menus, e.g. the application menu (when running in Electron).
   */
  async updateMenus(): Promise<void> {
    this.menuManager.updateMenus(this.bifrost);
  }

  private isPromise(thing: any): boolean {
    return typeof thing?.then === 'function';
  }
}
