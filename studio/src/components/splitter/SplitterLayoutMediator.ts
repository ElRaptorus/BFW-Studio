import { assertNotNull } from '@evil/bifrost_fw_sdk';

import type { SplitterLayout } from './SplitterLayout';

export class SplitterLayoutMediator {
  private instance: SplitterLayout | null = null;

  setSplitterLayoutInstance(instance: SplitterLayout): void {
    this.instance = instance;
  }

  maximizeSecondaryPane(): void {
    assertNotNull(this.instance, 'this.instance');
    this.instance.maximizeSecondaryPane();
  }

  secondaryPaneIsMinimizedToDefault(): boolean {
    assertNotNull(this.instance, 'this.instance');
    return this.instance.secondaryPaneIsMinimizedToDefault();
  }

  minimizeSecondaryPaneToDefault(): void {
    assertNotNull(this.instance, 'this.instance');
    this.instance.minimizeSecondaryPaneToDefault();
  }
}
