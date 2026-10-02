import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import { isValidPagePattern } from '#bifrost/common/CategoryManager';

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
  header: MenuBarItemFactory[];
  pageBar: MenuBarItemFactory[];
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
      header: [],
      pageBar: [],
    };
    this.serialized = {
      visible: this.visible,
      items: {
        header: [],
        pageBar: [],
      },
    };
  }

  registerMenuBarItem(
    area: MenuBarItemArea,
    factoryFn: MenuBarItemFactoryFn,
    options?: { pages?: string[] },
  ): { dispose: () => void } {
    const pages = options?.pages;
    for (const pattern of pages ?? []) {
      if (!isValidPagePattern(pattern)) {
        throw new Error(`Invalid page '${pattern}'. Expected '<categoryId>/<name>' or '<categoryId>/*'.`);
      }
    }
    const newItem: MenuBarItemFactory = {
      factoryFn:
        pages == null
          ? factoryFn
          : (...factoryFnArgs: any[]) => factoryFn(...factoryFnArgs).map((item) => ({ ...item, pages })),
    };

    this.menuBarItems[area].push(newItem);

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
      header: this.buildMenuBarItemObjects(this.menuBarItems.header, factoryFnArgs),
      pageBar: this.buildMenuBarItemObjects(this.menuBarItems.pageBar, factoryFnArgs),
    };

    const menuBarItemMap = this.menuBarItemModifiers.reduce(
      (previousValue: MenuBarItemMap, currentValue: MenuBarItemModifier) => {
        const modifierFnArgs: [MenuBarItemMap, ...any[]] = [previousValue, ...factoryFnArgs];

        // A failing modifier (e.g. its target item was removed) must not take the whole menu bar down.
        try {
          return currentValue.modifierFn.apply(null, modifierFnArgs);
        } catch (error) {
          console.error(error);
          return previousValue;
        }
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
