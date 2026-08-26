import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';

import type { Bifrost } from '../Bifrost';
import { EVENT_CLOSE_NOTIFICATION, EVENT_OPEN_NOTIFICATION } from '../common/NotificationManager';
import type { StatusBarManager } from '../common/StatusBarManager';
import { EVENT_STATUS_BAR_UPDATED } from '../common/StatusBarManager';
import type {
  ProgressHandle,
  StatusBarItemArea,
  StatusBarItemFactoryFn,
  StatusBarViewData,
} from '../contracts/StatusBarTypes';
import type { EditorsPanesSettingsSolutionEventMediator } from './EditorsPanesSettingsSolutionEventMediator';
import { EVENT_CONTENT_UPDATE } from './EditorsPanesSettingsSolutionEventMediator';

export class StatusBarMediator extends AbstractEmitter {
  private statusBarManager: StatusBarManager;
  private bifrost: Bifrost;

  constructor(
    bifrost: Bifrost,
    statusBarManager: StatusBarManager,
    editorsPanesSettingsSolutionEventMediator: EditorsPanesSettingsSolutionEventMediator,
  ) {
    super();
    this.bifrost = bifrost;
    this.statusBarManager = statusBarManager;

    this.statusBarManager.on(EVENT_STATUS_BAR_UPDATED, () => this.emit(EVENT_STATUS_BAR_UPDATED));

    editorsPanesSettingsSolutionEventMediator.on(EVENT_CONTENT_UPDATE, () => this.updateStatusBarItems());

    this.bifrost.notifications.on(EVENT_OPEN_NOTIFICATION, () => this.updateStatusBarItems());
    this.bifrost.notifications.on(EVENT_CLOSE_NOTIFICATION, () => this.updateStatusBarItems());
  }

  registerStatusBarItem(
    area: StatusBarItemArea,
    statusBarItemId: string,
    factoryFn: StatusBarItemFactoryFn,
    priority?: number,
  ): void {
    this.statusBarManager.registerStatusBarItem(area, statusBarItemId, factoryFn, priority);
  }

  unregisterStatusBarItem(statusBarItemId: string): void {
    this.statusBarManager.unregisterStatusBarItem(statusBarItemId);
  }

  showProgress(label: string): ProgressHandle {
    return this.statusBarManager.showProgress(label);
  }

  isVisible(): boolean {
    return this.statusBarManager.isVisible();
  }

  hide(): void {
    this.statusBarManager.hide();
  }

  show(): void {
    this.statusBarManager.show();
  }

  toggleVisibility(): void {
    this.statusBarManager.toggleVisibility();
  }

  getViewData(): StatusBarViewData {
    return this.statusBarManager.serialize();
  }

  updateStatusBarItems(): void {
    this.statusBarManager.updateStatusBarItems([this.bifrost]);
  }
}
