import type { MenuBarItem, MenuBarItemMap } from '../contracts/MenuBarTypes';

export function insertAfterMenuBarItem(
  menuBarItemMap: MenuBarItemMap,
  id: string,
  modifierFn: () => MenuBarItem[],
): MenuBarItemMap {
  const index = menuBarItemMap.header.findIndex((menuBarItem) => menuBarItem.id === id);
  if (index === -1) {
    throw new Error(`Could not find item with id '${id}'`);
  }
  menuBarItemMap.header.splice(index + 1, 0, ...modifierFn());
  return menuBarItemMap;
}

export function insertBeforeMenuBarItem(
  menuBarItemMap: MenuBarItemMap,
  id: string,
  modifierFn: () => MenuBarItem[],
): MenuBarItemMap {
  const index = menuBarItemMap.header.findIndex((menuBarItem) => menuBarItem.id === id);
  if (index === -1) {
    throw new Error(`Could not find item with id '${id}'`);
  }
  menuBarItemMap.header.splice(index, 0, ...modifierFn());
  return menuBarItemMap;
}
