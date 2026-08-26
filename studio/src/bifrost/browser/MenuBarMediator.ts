import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';

import type { Bifrost } from '../Bifrost';
import type { MenuBarManager } from '../common/MenuBarManager';
import { EVENT_MENU_BAR_UPDATED } from '../common/MenuBarManager';
import { insertAfterMenuBarItem, insertBeforeMenuBarItem } from '../common/MenuBarModifierFunctions';
import type {
  MenuBarItem,
  MenuBarItemArea,
  MenuBarItemFactoryFn,
  MenuBarItemMap,
  MenuBarItemModifierFn,
  MenuBarViewData,
} from '../contracts/MenuBarTypes';
import type { EditorsPanesSettingsSolutionEventMediator } from './EditorsPanesSettingsSolutionEventMediator';
import { EVENT_CONTENT_UPDATE } from './EditorsPanesSettingsSolutionEventMediator';

export class MenuBarMediator extends AbstractEmitter {
  private menuBarManager: MenuBarManager;
  private bifrost: Bifrost;

  constructor(
    bifrost: Bifrost,
    menuBarManager: MenuBarManager,
    editorsPanesSettingsSolutionEventMediator: EditorsPanesSettingsSolutionEventMediator,
  ) {
    super();
    this.bifrost = bifrost;
    this.menuBarManager = menuBarManager;

    this.menuBarManager.on(EVENT_MENU_BAR_UPDATED, () => this.emit(EVENT_MENU_BAR_UPDATED));

    editorsPanesSettingsSolutionEventMediator.on(EVENT_CONTENT_UPDATE, () => this.updateMenuBarItems());
  }

  registerMenuBarItem(area: MenuBarItemArea, factoryFn: MenuBarItemFactoryFn): { dispose: () => void } {
    return this.menuBarManager.registerMenuBarItem(area, factoryFn);
  }

  registerMenuBarItemModifier(factoryFn: MenuBarItemModifierFn): { dispose: () => void } {
    return this.menuBarManager.registerMenuBarItemModifier(factoryFn);
  }

  insertAfterMenuBarItem(menuBarItemMap: MenuBarItemMap, id: string, modifierFn: () => MenuBarItem[]): MenuBarItemMap {
    return insertAfterMenuBarItem(menuBarItemMap, id, modifierFn);
  }

  insertBeforeMenuBarItem(menuBarItemMap: MenuBarItemMap, id: string, modifierFn: () => MenuBarItem[]): MenuBarItemMap {
    return insertBeforeMenuBarItem(menuBarItemMap, id, modifierFn);
  }

  show(): void {
    this.menuBarManager.show();
  }

  hide(): void {
    this.menuBarManager.hide();
  }

  toggleVisibility(): void {
    this.menuBarManager.toggleVisibility();
  }

  isVisible(): boolean {
    return this.menuBarManager.isVisible();
  }

  getViewData(): MenuBarViewData {
    return this.menuBarManager.serialize();
  }

  updateMenuBarItems(): void {
    this.menuBarManager.updateMenuBarItems([this.bifrost]);
  }
}
