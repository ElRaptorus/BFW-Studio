import type {
  NotificationActionObject,
  NotificationContent,
  NotificationType,
} from '#bifrost/contracts/NotificationTypes';

import React, { useEffect, useRef, useState } from 'react';

import type { IconComponent } from '@evil/bifrost_fw_sdk';
import { assertNotNull } from '@evil/bifrost_fw_sdk';

type NotificationRendererProps = {
  options: NotificationOptionsProps;
  iconComponent: IconComponent;
  responseCallback: (response: NotificationActionObject | 'close') => void;

  className?: string;
};

export type NotificationOptionsProps = {
  type: NotificationType;
  content: NotificationContent;
  source: string;
  actions: NotificationActionObject[];
};

type NotificationContentProps = {
  content: NotificationContent;
};

type NotificationActionProps = {
  callback: (action: NotificationActionObject) => void;

  action: string;
  label: string;
  default?: boolean;
  cancel?: boolean;
};

const CLASSNAMES_TYPES: any = {
  info: 'ph-duotone ph-info ph-lg',
  warning: 'ph-duotone ph-warning ph-lg',
  error: 'ph-duotone ph-warning-circle ph-lg',
};

export default function NotificationRenderer(props: NotificationRendererProps): React.JSX.Element {
  const renderedContentRef = useRef<HTMLDivElement>(null);
  const shownContentRef = useRef<HTMLDivElement>(null);

  const [expanded, setExpanded] = useState(false);
  const [showExpandedIcon, setShowExpandedIcon] = useState(false);

  const toggleExpanded = () => setExpanded((prev) => !prev);

  useEffect(() => {
    const renderedContent = renderedContentRef.current;
    const shownContent = shownContentRef.current;

    assertNotNull(renderedContent, 'renderedContent');
    assertNotNull(shownContent, 'shownContent');

    const shouldBeExpanded = renderedContent.offsetHeight > shownContent.offsetHeight;
    setShowExpandedIcon(shouldBeExpanded);
  }, []);

  const Icon = props.iconComponent;

  return (
    <div className={`notification__outer ${props.className}`} role="document" tabIndex={-1}>
      <div className="notification">
        <div className="notification__inner">
          <div className="notification__body">
            <div
              onClick={toggleExpanded}
              className={`notification__type-icon notification__type-icon--${props.options.type}`}
            >
              <Icon id={CLASSNAMES_TYPES[props.options.type || 'info']} />
            </div>
            <div
              onClick={toggleExpanded}
              className={`notification__content ${expanded ? 'notification__content--expanded' : ''}`}
              ref={shownContentRef}
            >
              <div ref={renderedContentRef}>
                <NotificationContentElement content={props.options.content} />
              </div>
            </div>
            {showExpandedIcon && (
              <div className="notification__option" onClick={toggleExpanded}>
                <Icon id={expanded ? 'ph ph-caret-down' : 'ph ph-caret-up'} />
              </div>
            )}

            <div className="notification__option" onClick={() => props.responseCallback('close')}>
              <Icon id="std/notification/closed" />
            </div>
          </div>
          <div className="notification__footer">
            <div className="notification__info">Source: {props.options.source}</div>
            <div className="notification__actions">
              {props.options.actions.map((actionProps: NotificationActionObject) => {
                return (
                  <NotificationAction key={actionProps.action} callback={props.responseCallback} {...actionProps} />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationAction(props: NotificationActionProps): React.JSX.Element {
  const label = props.label || getActionLabel(props.action);
  let className = 'btn btn-sm notification-btn';

  if (props.default) {
    className += ' notification-btn--primary';
  }
  if (!props.default && !props.cancel) {
    className += ' notification-btn--secondary';
  }

  return (
    <>
      <button type="button" className={className} onClick={() => props.callback(props)}>
        {label}
      </button>{' '}
    </>
  );
}

function NotificationContentElement(props: NotificationContentProps) {
  const content = props.content;

  return <>{content}</>;
}

function getActionLabel(name: string): string {
  const [first, ...rest] = name.split('_');
  const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.substring(1);
  const title = rest
    .map((part) => capitalize(part))
    .join(' ')
    .replace(/-/g, ' ');

  return capitalize(first) + ' ' + title;
}
