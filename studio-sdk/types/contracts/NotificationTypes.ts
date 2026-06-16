export declare type NotificationOptions = {
  /**
   * Type of the notification
   */
  readonly type?: NotificationType;
  /**
   * Content of the notification, can be a `string`
   */
  readonly content: NotificationContent;
  /**
   * Optional: name of the notification's origin (e.g. the name of the plugin showing the notification)
   */
  readonly source?: string;
  /**
   * Actions which the user can take
   */
  readonly actions?: NotificationAction[];
  /**
   * Set to `true`, if the notification should stay fixed on screen
   */
  readonly sticky?: boolean;
};

export declare type NotificationOptionsStrict = {
  readonly type: NotificationType;
  readonly content: NotificationContent;
  readonly source: string;
  readonly actions: NotificationAction[];
  readonly sticky: boolean;
};

export declare type NotificationType = 'info' | 'warning' | 'error';

export declare type NotificationContent = string;

export declare type NotificationAction = NotificationActionObject;

export declare type NotificationActionObject = {
  /**
   * A string representing the reponse by the user. When an action is triggered by the user,
   * this string is given to the response handler of the dialog.
   */
  readonly action: string;
  /**
   * Label of the button representing the action
   */
  readonly label: string;
  /**
   * Optional: If `true`, enables the action as the default choice
   */
  readonly default?: boolean;
  /**
   * Optional: If `true`, enables the action as the ESC choice
   */
  readonly cancel?: boolean;
};
