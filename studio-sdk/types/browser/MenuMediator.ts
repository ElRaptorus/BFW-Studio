import type { Studio } from '../Studio';
import type { Menu, MenuFactoryFunction, MenuItem } from '../contracts/MenuTypes';

/**
 * Provides access to menus in Studio and can update the persistent application menu.
 *
 * Example:
 *
 *    studio.menus.registerMenu('foo/bar', (foo: string, bar: number) => {
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
 *    // programmatically via Studio
 *    studio.menus.getMenu('foo/bar', ['catch', 22])
 *
 *    // or in React:
 *    <div onContextMenu={(event) => showContextMenu(event, "foo/bar", ['catch', 22])}>
 *      <div>Content with context menu</div>
 *    </div>
 *
 * In both cases, the label of the first menu item will read "catch 22".
 */
export declare class MenuMediator {
  /**
   * Returns the `Menu` for the given `menuId` and applies `menuFactoryFnArgs` to its factory function.
   *
   * Example:
   *
   *    studio.menus.registerMenu('foo/bar', (foo: string, bar: number) => {
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
   *    studio.menus.getMenu('foo/bar', ['catch', 22])
   *
   * The label of the first menu item will read "catch 22".
   */
  getMenu(menuId: string, menuFactoryFnArgs?: any[]): Menu | Promise<Menu>;

  /**
   * Same as `getMenu`, but sync.
   *
   * This can only be used with sync menu factory functions and throws if the menu factory function returns a Promise.
   */
  getMenuSync(menuId: string, menuFactoryFnArgs?: any[]): Menu;

  /**
   * Registers a given `menuFactoryFn` under the given `menuId`.
   *
   * When `menuFactoryFn` is called, it is given the arguments provided to `getMenu`/`showContextMenu` when obtaining
   * the menu.
   *
   * Example:
   *
   *    studio.menus.registerMenu('foo/bar', (foo: string, bar: number) => {
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
   *    // programmatically via Studio
   *    studio.menus.getMenu('foo/bar', ['catch', 22])
   *
   *    // or in React:
   *    <div onContextMenu={(event) => showContextMenu(event, "foo/bar", ['catch', 22])}>
   *      <div>Content with context menu</div>
   *    </div>
   *
   * In both cases, the label of the first menu item will read "catch 22".
   */
  registerMenu(menuId: string, menuFactoryFn: MenuFactoryFunction): void;

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
   *    studio.menus.registerMenu('foo/bar', (foo: string, bar: number) => {
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
   *    studio.menus.registerMenuModifier('foo/bar', (menu: Menu, foo: string, bar: number) => {
   *      return studio.menus.prependMenu(menu, [
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
   * We have to provide these arguments to `studio.menus.getMenu` as second argument:
   *
   *    // programmatically via studio
   *    studio.menus.getMenu('foo/bar', ['catch', 22])
   *
   *    // or in React:
   *    <div onContextMenu={(event) => showContextMenu(event, "foo/bar", ['catch', 22])}>
   *      <div>Content with context menu</div>
   *    </div>
   *
   * In both cases, the label of the first menu item will read "Extra entry 22".
   */
  registerMenuModifier(
    menuId:
      | 'std/application/main'
      | 'std/file-explorer/solution'
      | 'std/file-explorer/project'
      | 'std/file-explorer/directory'
      | 'std/file-explorer/file'
      | 'std/editor/editor-tab',
    menuModifierFn: (menu: Menu, studio: Studio) => Menu,
  ): void;

  registerMenuModifier(menuId: string, menuModifierFn: MenuFactoryFunction): void;

  /**
   * Use this function in tandem with `modifiyMenu` to append menu items to a menu.
   *
   *    studio.menus.registerMenuModifier('foo/bar', (menu: Menu, ...factoryFnArgs) => {
   *      return studio.menus.appendToMenu(menu, [
   *        {
   *          type: 'command',
   *          label: `Appended menu item`,
   *          command: 'std.internal.empty'
   *        }
   *      ])
   *    });
   *
   */
  appendToMenu(menu: Menu, menuItemsToAppend: MenuItem[]): Menu;

  appendToSubmenu(menu: Menu, submenuId: string, menuItemsToAppend: MenuItem[]): Menu;

  prependToMenu(menu: Menu, menuItemsToPrepend: MenuItem[]): Menu;

  prependToSubmenu(menu: Menu, submenuId: string, menuItemsToPrepend: MenuItem[]): Menu;

  insertAfterMenuItem(menu: Menu, id: string, menuItemsToInsert: MenuItem[]): Menu;

  insertBeforeMenuItem(menu: Menu, id: string, menuItemsToInsert: MenuItem[]): Menu;

  isMenuRegistered(menuId: string): boolean;
}
