import type {
  PluginNotificationOpenOptions,
  PluginNotificationResponse,
  PluginNotificationUpdateOptions,
} from './types';

/**
 * Toast notification API for showing, updating, and closing user-facing messages.
 *
 * The `origin` field in {@link PluginNotificationOpenOptions} defaults to the
 * plugin's name when omitted.
 */
export interface NotificationsApi {
  /**
   * Show a notification toast.
   *
   * @param options - Notification content, severity, and optional actions.
   * @returns A unique notification ID that can be used with {@link update}, {@link close}, and {@link onResponse}.
   */
  open(options: PluginNotificationOpenOptions): Promise<string>;

  /** Dismiss a notification by its ID. */
  close(notificationId: string): Promise<void>;

  /** Update the content of an existing notification. */
  update(notificationId: string, options: PluginNotificationUpdateOptions): Promise<void>;

  /**
   * Register a callback invoked when the user clicks an action button on a notification.
   *
   * @param notificationId - The ID returned by {@link open}.
   * @param callback - Called with the clicked action's details.
   */
  onResponse(notificationId: string, callback: (response: PluginNotificationResponse) => void): Promise<void>;
}
