import type { ProgressHandle, StatusBarItemArea, StatusBarItemFactoryFn } from '../contracts/StatusBarTypes';

export declare class StatusBarMediator {
  registerStatusBarItem(
    area: StatusBarItemArea,
    statusBarItemId: string,
    factoryFn: StatusBarItemFactoryFn,
    priority?: number,
  ): void;

  unregisterStatusBarItem(statusBarItemId: string): void;

  showProgress(label: string): ProgressHandle;

  isVisible(): boolean;

  hide(): void;

  show(): void;

  toggleVisibility(): void;
}
