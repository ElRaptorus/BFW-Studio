import type {
  MenuBarItem,
  MenuBarItemArea,
  MenuBarItemFactoryFn,
  MenuBarItemMap,
  MenuBarItemModifierFn,
} from '../contracts/MenuBarTypes';

export declare class MenuBarMediator {
  registerMenuBarItem(area: MenuBarItemArea, factoryFn: MenuBarItemFactoryFn): { dispose: () => void };

  registerMenuBarItemModifier(factoryFn: MenuBarItemModifierFn): { dispose: () => void };

  insertAfterMenuBarItem(menuBarItemMap: MenuBarItemMap, id: string, modifierFn: () => MenuBarItem[]): MenuBarItemMap;

  insertBeforeMenuBarItem(menuBarItemMap: MenuBarItemMap, id: string, modifierFn: () => MenuBarItem[]): MenuBarItemMap;

  show(): void;

  hide(): void;

  toggleVisibility(): void;

  isVisible(): boolean;
}
