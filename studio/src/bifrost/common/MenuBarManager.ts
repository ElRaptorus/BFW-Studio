import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';

import type {
  MenuBarItem,
  MenuBarItemArea,
  MenuBarItemFactoryFn,
  MenuBarItemMap,
  MenuBarItemModifierFn,
  MenuBarSerialized,
} from '../contracts/MenuBarTypes';
import type { ISerializable } from '../contracts/SerializableTypes';

export const EVENT_MENU_BAR_UPDATED = 'EVENT_MENU_BAR_UPDATED';

type MenuBarItemFactory = {
  factoryFn: MenuBarItemFactoryFn;
};

type MenuBarItemModifier = {
  modifierFn: MenuBarItemModifierFn;
};

type MenuBarItemFactoryMap = {
  left: MenuBarItemFactory[];
  center: MenuBarItemFactory[];
  right: MenuBarItemFactory[];
};

export class MenuBarManager extends AbstractEmitter implements ISerializable {
  private visible: boolean;
  private menuBarItems: MenuBarItemFactoryMap;
  private menuBarItemModifiers: MenuBarItemModifier[];
  private serialized: MenuBarSerialized;

  constructor() {
    super();
    this.visible = true;
    this.menuBarItemModifiers = [];
    this.menuBarItems = {
      left: [],
      center: [],
      right: [],
    };
    this.serialized = {
      visible: this.visible,
      items: {
        left: [],
        center: [],
        right: [],
      },
    };
  }

  registerMenuBarItem(area: MenuBarItemArea, factoryFn: MenuBarItemFactoryFn): { dispose: () => void } {
    const newItem: MenuBarItemFactory = { factoryFn };

    if (area === 'right') {
      this.menuBarItems[area].unshift(newItem);
    } else {
      this.menuBarItems[area].push(newItem);
    }

    return {
      dispose: () => {
        const arr = this.menuBarItems[area];
        const idx = arr.indexOf(newItem);
        if (idx !== -1) {
          arr.splice(idx, 1);
        }
      },
    };
  }

  registerMenuBarItemModifier(modifierFn: MenuBarItemModifierFn): { dispose: () => void } {
    const newItem: MenuBarItemModifier = { modifierFn };

    this.menuBarItemModifiers.push(newItem);

    return {
      dispose: () => {
        const idx = this.menuBarItemModifiers.indexOf(newItem);
        if (idx !== -1) {
          this.menuBarItemModifiers.splice(idx, 1);
        }
      },
    };
  }

  show(): void {
    this.setVisibility(true);
  }

  hide(): void {
    this.setVisibility(false);
  }

  toggleVisibility(): void {
    this.setVisibility(!this.visible);
  }

  isVisible(): boolean {
    return this.visible;
  }

  private setVisibility(visible: boolean): void {
    this.visible = visible;

    // TODO: There must be a better way than overwriting readonly data by use of a brute-force any typecasting.
    (this.serialized.visible as any) = visible;

    this.emit(EVENT_MENU_BAR_UPDATED);
  }

  updateMenuBarItems(factoryFnArgs: any[]): void {
    const unmodifiedMenuBarItemMap: MenuBarItemMap = {
      left: this.buildMenuBarItemObjects(this.menuBarItems.left, factoryFnArgs),
      center: this.buildMenuBarItemObjects(this.menuBarItems.center, factoryFnArgs),
      right: this.buildMenuBarItemObjects(this.menuBarItems.right, factoryFnArgs),
    };

    const menuBarItemMap = this.menuBarItemModifiers.reduce(
      (previousValue: MenuBarItemMap, currentValue: MenuBarItemModifier) => {
        const modifierFnArgs: [MenuBarItemMap, ...any[]] = [previousValue, ...factoryFnArgs];

        return currentValue.modifierFn.apply(null, modifierFnArgs);
      },
      unmodifiedMenuBarItemMap,
    );

    const newSerialized = {
      visible: this.visible,
      items: menuBarItemMap,
    };

    if (JSON.stringify(newSerialized) !== JSON.stringify(this.serialized)) {
      this.serialized = newSerialized;

      this.emit(EVENT_MENU_BAR_UPDATED);
    }
  }

  deserialize(dump: any): void {
    const deepCopy = JSON.parse(JSON.stringify(dump));

    this.visible = deepCopy.visible;
  }

  serialize(): MenuBarSerialized {
    return this.serialized;
  }

  private buildMenuBarItemObjects(menuBarItems: MenuBarItemFactory[], factoryFnArgs: any[]): MenuBarItem[] {
    let result: MenuBarItem[] = [];

    menuBarItems.forEach((menuBarItem: MenuBarItemFactory): void => {
      const menuBarItemObjects = menuBarItem.factoryFn.apply(null, factoryFnArgs);
      result = result.concat(menuBarItemObjects);
    });

    return result;
  }
}
