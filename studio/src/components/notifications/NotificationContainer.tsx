import type { Notification, NotificationActionObject, NotificationOptions } from '#bifrost/contracts/NotificationTypes';

import React, { useCallback } from 'react';

import type { IconComponent } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

import { AutoScrollContainer } from '../../../../studio-sdk/src/components/internal/AutoScrollContainer';
import { useBifrost } from '../../bifrostContext';
import type { NotificationOptionsProps } from './NotificationRenderer';
import NotificationRenderer from './NotificationRenderer';

type NotificationContainerProps = {
  notifications: Notification[];
};

type NotificationContainerEmptyStateProps = {
  Icon: IconComponent;
  toggleNotifications: () => void;
};

export default function NotificationContainer(props: NotificationContainerProps): React.JSX.Element {
  const bifrost = useBifrost();

  const toggleNotifications = useCallback(() => bifrost.notifications.toggle(), [bifrost.notifications]);
  const closeAllNotifications = useCallback(
    () => bifrost.notifications.close(...props.notifications.map((notification) => notification.id)),
    [bifrost.notifications, props.notifications],
  );

  const notifications: Notification[] = props.notifications;
  if (notifications.length === 0) {
    return <NotificationContainerEmptyState Icon={Icon} toggleNotifications={toggleNotifications} />;
  }

  const showHeader = notifications.length > 1;
  const hasUnexpectedNotifications = notifications.some((notification: Notification) => {
    return notification.options.type === 'error' || notification.options.type === 'warning';
  });
  const divProps: any = {
    'data--test--notifications': true,
    'data--test--unexpected-notifications': hasUnexpectedNotifications ? true : undefined,
  };
  const lastNotificationIndex = notifications.length - 1;

  return (
    <div className="notification-container" {...divProps}>
      {showHeader && (
        <div className="notification-container__header">
          Notifications
          <span
            className="notification__option"
            data-bs-toggle="tooltip"
            title="Close all Notifications"
            onClick={() => closeAllNotifications()}
          >
            <Icon id="std/notification/closed" />
          </span>
          <span
            className="notification__option"
            data-bs-toggle="tooltip"
            title="Hide Notifications"
            onClick={() => toggleNotifications()}
          >
            <Icon id="ph ph-rotate-180 ph-x-square" />
          </span>
        </div>
      )}
      <AutoScrollContainer elementClassName="notification--newest" className="notification-container__body">
        {notifications.map((notification: Notification, index: number) => {
          const isNewestNotification = index === lastNotificationIndex;
          const options = convertNotificationOptionsToNotificationOptionsProps(notification.options);
          const wrappedResponseCallback = (response: NotificationActionObject | 'close'): void => {
            if (response === 'close') {
              bifrost.notifications.close(notification.id);
            }
            if (notification.responseCallbackFn) {
              notification.responseCallbackFn(response as NotificationActionObject);
            }
          };

          return (
            <NotificationRenderer
              key={`${index}-${isNewestNotification}-${notification.createdAt.getTime()}`}
              className={isNewestNotification ? 'notification--newest' : undefined}
              responseCallback={wrappedResponseCallback}
              options={options}
              iconComponent={Icon}
            />
          );
        })}
      </AutoScrollContainer>
    </div>
  );
}

function convertNotificationOptionsToNotificationOptionsProps(options: NotificationOptions): NotificationOptionsProps {
  const type = options.type || 'info';
  const source = options.source || 'unknown';
  const actions = options.actions || [];

  return { ...options, type, source, actions };
}

export function NotificationContainerEmptyState({
  Icon,
  toggleNotifications,
}: NotificationContainerEmptyStateProps): React.JSX.Element {
  return (
    <div className="notification-container">
      <div className="notification-container__header">
        No new notifications
        <span className="notification__option" onClick={() => toggleNotifications()}>
          <Icon id="ph ph-rotate-180 ph-x-square" />
        </span>
      </div>
    </div>
  );
}
