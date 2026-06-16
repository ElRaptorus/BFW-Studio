import { AbstractEmitter, assertNotNull } from '@evil/bifrost_fw_sdk';

import type {
  Notification,
  NotificationAction,
  NotificationOptions,
  NotificationOptionsStrict,
  NotificationsViewData,
} from '../contracts/NotificationTypes';

export const EVENT_OPEN_NOTIFICATION = 'EVENT_OPEN_NOTIFICATION';
export const EVENT_CLOSE_NOTIFICATION = 'EVENT_CLOSE_NOTIFICATION';

const DEFAULT_NOTIFICATION_OPTIONS_TYPE = 'info';
const DEFAULT_NOTIFICATION_OPTIONS_SOURCE = 'unknown';

export class NotificationManager extends AbstractEmitter {
  private notifications: Notification[];
  private idCounter: number;
  private maximized: boolean;

  constructor() {
    super();

    this.notifications = [];
    this.idCounter = 0;
    this.maximized = false;
  }

  static normalizeNotificationOptions(
    givenNotificationOptions: NotificationOptions | string,
  ): NotificationOptionsStrict {
    const notificationOptions =
      typeof givenNotificationOptions === 'string' ? { content: givenNotificationOptions } : givenNotificationOptions;
    const type = notificationOptions.type ?? DEFAULT_NOTIFICATION_OPTIONS_TYPE;
    const source = notificationOptions.source ?? DEFAULT_NOTIFICATION_OPTIONS_SOURCE;
    const actions = notificationOptions.actions ?? [];
    const sticky = notificationOptions.sticky ?? false;

    return { ...notificationOptions, type, source, actions, sticky };
  }

  getVisibleNotifications(): Notification[] {
    const visibleNotifications = this.notifications.filter((notification: Notification) => notification.visible);

    const visibleStickyNotifications = visibleNotifications.filter((notification) => notification.options.sticky);
    const visibleNonStickyNotifications = visibleNotifications.filter((notification) => !notification.options.sticky);

    return [...visibleNonStickyNotifications, ...visibleStickyNotifications];
  }

  getAllNotifications(): Notification[] {
    return this.notifications;
  }

  close(...notificationIds: string[]): void {
    notificationIds.forEach((notificationId: string) => {
      const notification = this.notifications.find((notification: Notification) => notification.id === notificationId);

      if (notification) {
        this.UNSAFE_updateNotificationVisibility(notification, false);
      }
    });

    this.emit(EVENT_CLOSE_NOTIFICATION);

    if (this.getVisibleNotifications().length === 0) {
      this.toggle();
    }
  }

  toggle(): void {
    this.maximized = !this.maximized;
    this.emit(EVENT_OPEN_NOTIFICATION);
  }

  open(
    notificationOptions: NotificationOptions | string,
    responseCallbackFn: (action: NotificationAction) => void = () => {},
  ): string {
    const notificationId = this.generateNewId();

    const notification: Notification = {
      options: NotificationManager.normalizeNotificationOptions(notificationOptions),
      responseCallbackFn: responseCallbackFn,
      id: notificationId,
      createdAt: new Date(),
      visible: true,
    };

    this.notifications.push(notification);

    this.maximized = true;

    this.emit(EVENT_OPEN_NOTIFICATION);

    return notificationId;
  }

  update(notificationId: string, notificationOptions: NotificationOptions | string): void {
    const existingNotification = this.notifications.find((notification) => notification.id === notificationId);
    assertNotNull(existingNotification, 'existingNotification');

    const updatedNotificationOptions = NotificationManager.normalizeNotificationOptions(notificationOptions);
    this.UNSAFE_updateNotificationOptions(existingNotification, updatedNotificationOptions);

    this.maximized = true;

    this.emit(EVENT_OPEN_NOTIFICATION);
  }

  getViewData(): NotificationsViewData {
    return {
      maximized: this.maximized,
      notifications: this.getVisibleNotifications(),
    };
  }

  private generateNewId(): string {
    this.idCounter++;

    return `notification/${this.idCounter}`;
  }

  private UNSAFE_updateNotificationOptions(notification: Notification, options: NotificationOptionsStrict): void {
    // Notification objects are read-only in user-space
    // DO NOT USE this "any trick" without knowing the implications!
    (notification as any).options = options;
  }

  private UNSAFE_updateNotificationVisibility(notification: Notification, visible: boolean): void {
    // Notification objects are read-only in user-space
    // DO NOT USE this "any trick" without knowing the implications!
    (notification as any).visible = visible;
  }
}
