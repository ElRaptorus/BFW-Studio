export type NotificationActionObject = {
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

export type NotificationAction = NotificationActionObject;

export type Notification = {
  readonly id: string;
  readonly createdAt: Date;
  readonly options: NotificationOptions;

  /**
   * If actions are povided, this callback is triggered with the chosen action
   */
  readonly responseCallbackFn: (response: NotificationActionObject) => void;

  /**
   * Set to `true`, if the notification is shown on screen
   */
  readonly visible: boolean;
};

export type NotificationOptions = {
  /**
   * Type of the notification
   */
  readonly type?: NotificationType;

  /**
   * Content of the notification, can be a `string`
   */
  readonly content: NotificationContent;

  /**
   * Optional: name of the notification's origin (e.g. the name of the module showing the notification)
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

export type NotificationOptionsStrict = {
  readonly type: NotificationType;
  readonly content: NotificationContent;
  readonly source: string;
  readonly actions: NotificationAction[];
  readonly sticky: boolean;
};

export type NotificationType = 'info' | 'warning' | 'error';

export type NotificationContent = string;

export type NotificationsViewData = {
  maximized: boolean;

  notifications: Notification[];
};
