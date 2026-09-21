import type { Menu, MenuItem, MenuItem_SubMenu } from '@elraptorus/bfw_studio_sdk';

type TraverseResult = {
  parentMenu: Menu;
  childIndex: number;
};

export function appendToMenu(menu: Menu, itemsToAppend: MenuItem[]): Menu {
  return menu.concat(itemsToAppend);
}

export function appendToSubMenu(menu: Menu, submenuId: string, itemsToAppend: MenuItem[]): Menu {
  const foundMenu = findMenuViaId(menu, submenuId);

  // MenuItem objects are read-only in user-space
  // DO NOT USE this "any trick" without knowing the implications!
  (foundMenu as any).submenu = foundMenu.submenu.concat(itemsToAppend);

  return menu;
}

export function prependToMenu(menu: Menu, itemsToPrepend: MenuItem[]): Menu {
  return [...itemsToPrepend].concat(menu);
}

export function prependToSubMenu(menu: Menu, submenuId: string, itemsToPrepend: MenuItem[]): Menu {
  const foundMenu = findMenuViaId(menu, submenuId);

  // MenuItem objects are read-only in user-space
  // DO NOT USE this "any trick" without knowing the implications!
  (foundMenu as any).submenu = [...itemsToPrepend].concat(foundMenu.submenu);

  return menu;
}

export function insertAfterMenuItem(menu: Menu, id: string, itemsToInsert: MenuItem[]): Menu {
  const { parentMenu, childIndex } = findMenuContainingMenuItemWithId(menu, id);

  parentMenu.splice(childIndex + 1, 0, ...itemsToInsert);

  return menu;
}

export function insertBeforeMenuItem(menu: Menu, id: string, itemsToInsert: MenuItem[]): Menu {
  const { parentMenu, childIndex } = findMenuContainingMenuItemWithId(menu, id);

  parentMenu.splice(childIndex, 0, ...itemsToInsert);

  return menu;
}

function findMenuViaId(menu: Menu, id: string): MenuItem_SubMenu {
  const foundMenu = menu.find((menuItem: MenuItem) => menuItem.id === id);
  if (foundMenu == null) {
    throw new Error(`Could not find menu item with id '${id}'`);
  }
  if (foundMenu.type !== 'menu') {
    throw new Error(`Expected menu item with id '${id}' to be of type 'menu'.`);
  }

  return foundMenu;
}

function findMenuContainingMenuItemWithId(menu: Menu, id: string): TraverseResult {
  const foundMenu = traverseMenuAndFindMenuContainingMenuItemWithId(menu, id);
  if (foundMenu == null) {
    throw new Error(`Could not find menu containing a menu item with id '${id}'`);
  }

  return {
    parentMenu: foundMenu,
    childIndex: foundMenu.findIndex((menuItem: MenuItem) => menuItem.id === id),
  };
}

function traverseMenuAndFindMenuContainingMenuItemWithId(menu: Menu, id: string): Menu | null {
  const foundMenuItem = menu.find((submenuItem: MenuItem) => submenuItem.id === id);

  if (foundMenuItem != null) {
    return menu;
  }

  const menuItems = menu.filter((menuItem: MenuItem) => menuItem.type === 'menu') as MenuItem_SubMenu[];

  for (const menuItem of menuItems) {
    const foundMenu = traverseMenuAndFindMenuContainingMenuItemWithId(menuItem.submenu, id);
    if (foundMenu != null) {
      return foundMenu;
    }
  }

  return null;
}
