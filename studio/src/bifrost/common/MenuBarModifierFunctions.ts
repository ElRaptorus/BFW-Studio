import type { MenuBarItem, MenuBarItemArea, MenuBarItemMap } from '../contracts/MenuBarTypes';

const MENU_BAR_AREAS: MenuBarItemArea[] = ['left', 'center', 'right'];

export function insertAfterMenuBarItem(
  menuBarItemMap: MenuBarItemMap,
  id: string,
  modifierFn: () => MenuBarItem[],
): MenuBarItemMap {
  for (const area of MENU_BAR_AREAS) {
    const menuBarItems = menuBarItemMap[area];
    const index = menuBarItems.findIndex((menuBarItem) => menuBarItem.id === id);
    if (index !== -1) {
      const itemsToInsert = modifierFn.apply(null);

      menuBarItems.splice(index + 1, 0, ...itemsToInsert);

      return menuBarItemMap;
    }
  }

  throw new Error(`Could not find item with id '${id}'`);
}

export function insertBeforeMenuBarItem(
  menuBarItemMap: MenuBarItemMap,
  id: string,
  modifierFn: () => MenuBarItem[],
): MenuBarItemMap {
  for (const area of MENU_BAR_AREAS) {
    const menuBarItems = menuBarItemMap[area];
    const index = menuBarItems.findIndex((menuBarItem) => menuBarItem.id === id);
    if (index !== -1) {
      const itemsToInsert = modifierFn.apply(null);

      menuBarItems.splice(index, 0, ...itemsToInsert);

      return menuBarItemMap;
    }
  }

  throw new Error(`Could not find item with id '${id}'`);
}
