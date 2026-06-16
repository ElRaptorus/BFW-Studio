import type { NotificationAction, NotificationOptions } from '../contracts/NotificationTypes';

export declare class NotificationManager {
  close(...notificationIds: string[]): void;

  toggle(): void;

  open(
    notificationOptions: NotificationOptions | string,
    responseCallbackFn?: (action: NotificationAction) => void,
  ): string;

  update(notificationId: string, notificationOptions: NotificationOptions | string): void;
}
