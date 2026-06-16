import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import type { ISerializable } from '../contracts/SerializableTypes';
import type {
  ProgressHandle,
  StatusBarItem,
  StatusBarItemArea,
  StatusBarItemFactoryFn,
  StatusBarSerialized,
} from '../contracts/StatusBarTypes';

export const EVENT_STATUS_BAR_UPDATED = 'EVENT_STATUS_BAR_UPDATED';

type StatusBarItemFactory = {
  id: string;
  factoryFn: StatusBarItemFactoryFn;
  priority: number;
};

export class StatusBarManager extends AbstractEmitter implements ISerializable {
  private statusBarItemFactoryIdMap: any;
  private statusBarItemFactories: any;
  private visible: boolean;
  private progressItems: Map<number, string> = new Map();
  private nextProgressId = 0;

  private serialized: StatusBarSerialized;

  constructor() {
    super();

    this.visible = true;
    this.statusBarItemFactoryIdMap = {};
    this.statusBarItemFactories = {
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
      progressLabel: null,
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

    // StatusBarItem objects are read-only in user-space
    // DO NOT USE this "any trick" without knowing the implications!
    (this.serialized as any).visible = visible;

    this.emit(EVENT_STATUS_BAR_UPDATED);
  }

  deserialize(dump: any): void {
    const deepCopy = JSON.parse(JSON.stringify(dump));

    this.visible = deepCopy.visible;
  }

  serialize(): StatusBarSerialized {
    return this.serialized;
  }

  registerStatusBarItem(area: StatusBarItemArea, id: string, factoryFn: StatusBarItemFactoryFn, priority = 0): void {
    if (this.statusBarItemFactoryIdMap[id] != null) {
      throw new Error(`StatusBarItemFactory already registered: ${id}`);
    }
    const newItemFactory: StatusBarItemFactory = { id, factoryFn, priority };

    this.statusBarItemFactories[area].push(newItemFactory);
    this.statusBarItemFactories[area].sort(
      (left: StatusBarItemFactory, right: StatusBarItemFactory) => right.priority - left.priority,
    );
    this.statusBarItemFactoryIdMap[id] = true;
  }

  unregisterStatusBarItem(id: string): void {
    if (this.statusBarItemFactoryIdMap[id] == null) {
      return;
    }

    for (const area of ['left', 'center', 'right'] as StatusBarItemArea[]) {
      const factories: StatusBarItemFactory[] = this.statusBarItemFactories[area];
      const idx = factories.findIndex((factory) => factory.id === id);
      if (idx !== -1) {
        factories.splice(idx, 1);
        break;
      }
    }

    delete this.statusBarItemFactoryIdMap[id];
  }

  showProgress(label: string): ProgressHandle {
    const handleId = this.nextProgressId++;
    this.progressItems.set(handleId, label);
    this.emitProgressUpdate();

    return {
      update: (newLabel: string) => {
        if (this.progressItems.has(handleId)) {
          this.progressItems.set(handleId, newLabel);
          this.emitProgressUpdate();
        }
      },
      done: () => {
        this.progressItems.delete(handleId);
        this.emitProgressUpdate();
      },
    };
  }

  getProgressLabel(): string | null {
    if (this.progressItems.size === 0) {
      return null;
    }
    const entries = Array.from(this.progressItems.values());
    return entries[entries.length - 1];
  }

  updateStatusBarItems(factoryFnArgs: any[]): void {
    const newSerialized: StatusBarSerialized = {
      visible: this.visible,
      items: {
        left: this.buildStatusBarItems(this.statusBarItemFactories.left, factoryFnArgs),
        center: this.buildStatusBarItems(this.statusBarItemFactories.center, factoryFnArgs),
        right: this.buildStatusBarItems(this.statusBarItemFactories.right, factoryFnArgs),
      },
      progressLabel: this.getProgressLabel(),
    };

    if (JSON.stringify(newSerialized) !== JSON.stringify(this.serialized)) {
      this.serialized = newSerialized;

      this.emit(EVENT_STATUS_BAR_UPDATED);
    }
  }

  private buildStatusBarItems(statusBarItemFactories: StatusBarItemFactory[], factoryFnArgs: any[]): StatusBarItem[] {
    let result: StatusBarItem[] = [];

    statusBarItemFactories.forEach((statusBarItemFactory: StatusBarItemFactory): void => {
      const statusBarItems = statusBarItemFactory.factoryFn.apply(null, factoryFnArgs);
      result = result.concat(statusBarItems);
    });

    return result;
  }

  private emitProgressUpdate(): void {
    const progressLabel = this.getProgressLabel();
    if (progressLabel !== this.serialized.progressLabel) {
      (this.serialized as any).progressLabel = progressLabel;
      this.emit(EVENT_STATUS_BAR_UPDATED);
    }
  }
}
