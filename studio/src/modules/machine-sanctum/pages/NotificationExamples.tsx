import type { Bifrost } from '#bifrost/Bifrost';
import type { NotificationOptions } from '#bifrost/contracts/NotificationTypes';

import React, { Fragment } from 'react';

import {
  EditorContent,
  EditorTitle,
  EditorTitleHeroIcon,
  EditorTitleLeft,
  EditorTitleRight,
  EditorTitleText,
} from '@evil/bifrost_fw_sdk';

import type { MachineSanctumExample } from '../contracts/MachineSanctumTypes';
import { NotificationExampleRenderer } from './NotificationExampleRenderer';

type NotificationExample = MachineSanctumExample<NotificationOptions>;

export const NOTIFICATION_EXAMPLES: NotificationExample[] = [
  {
    data: {
      type: 'error',
      content: 'Unknown Error: Something happend!',
    },
  },
  {
    data: {
      type: 'warning',
      content: `Warning: Long text follows: Failed prop type: The prop \`title\` is marked as required in \`SubMenu\`, but its value is \`undefined\`.
    in SubMenu (created by MenuBar)
    in MenuBar (created by Workbench)
    in div (created by Workbench)`,
    },
  },
  {
    data: {
      type: 'error',
      content: 'The editor has crashed.',
      actions: [
        {
          action: 'submit',
          label: 'Submit bug report',
          default: true,
        },
      ],
    },
  },
  {
    data: {
      type: 'info',
      content: 'An update is available!',
      actions: [
        {
          label: 'Skip release',
          action: 'cancel',
          cancel: true,
        },
        {
          action: 'submit',
          label: 'Install new version',
          default: true,
        },
      ],
    },
  },
];

export default function NotificationExamples(props: any): React.JSX.Element {
  const bifrost: Bifrost = props.bifrost;

  const launchRandomNotification = () => {
    const example = NOTIFICATION_EXAMPLES[Math.floor(Math.random() * NOTIFICATION_EXAMPLES.length)];

    props.bifrost.notifications.open(example.data, (response: any) =>
      console.log('Notification response was', response),
    );
  };

  const launchMultipleRandomNotifications = async () => {
    for (let i = 0; i < 5; i++) {
      launchRandomNotification();
    }
  };

  return (
    <>
      <EditorTitle>
        <EditorTitleLeft>
          <EditorTitleHeroIcon studio={bifrost} icon="ph-duotone ph-globe" />
          <EditorTitleText
            studio={bifrost}
            label="Introduction"
            sublabel="Notifications"
            menuId="machine-sanctum/notifications/editor-title"
          />
        </EditorTitleLeft>
        <EditorTitleRight>
          <button className="btn btn-sm btn-secondary" onClick={() => launchRandomNotification()}>
            Launch random
          </button>
          &nbsp;
          <button className="btn btn-sm btn-secondary" onClick={() => launchMultipleRandomNotifications()}>
            Launch multiple
          </button>
        </EditorTitleRight>
      </EditorTitle>

      <EditorContent>
        <div className="machine-sanctum-subpage">
          <p className="lead">
            Notifications are a great UX instrument when we need to tell the user something &quot;out of context&quot;.
          </p>
          <p>
            An extension has crashed unexpectedly, an update is available, an urgent message has been received. This is
            where notifications shine.
          </p>
          <p>Notifications are not modal and do not require the user to take immediate action.</p>
          <p>
            <b>DO NOT</b> use notifications if something is happening in the user&apos;s current context: entering a
            search term with no results, entering any invalid data (e.g. wrong password) or successfully completing an
            operation should be dealt with inside the window/component where the operation takes place.
          </p>

          <hr />

          <h3>Examples</h3>

          {NOTIFICATION_EXAMPLES.map((example: NotificationExample, index: number) => (
            <Fragment key={`notification-example-${index}`}>
              <NotificationExampleRenderer
                bifrost={props.bifrost}
                editorDocument={props.editorDocument}
                title={example.title}
                data={example.data}
                viewMediatorId={`notification-example-${index}`}
              />
              <hr />
            </Fragment>
          ))}
        </div>
      </EditorContent>
    </>
  );
}
