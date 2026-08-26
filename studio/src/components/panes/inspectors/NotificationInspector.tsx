import { Bifrost } from '#bifrost/Bifrost';
import type { Notification } from '#bifrost/contracts/NotificationTypes';
import type { PaneComponentProps, PaneProvider } from '#bifrost/contracts/PaneTypes';
import { Pane } from '#components/panes/Pane';
import { PaneHeader } from '#components/panes/PaneHeader';
import dayjs from 'dayjs';

import React, { useCallback, useMemo, useState } from 'react';

import { Table, type TableColumnDef } from '../../Table';

export const paneProvider: PaneProvider = {
  getPaneTitle: getPaneTitle,
  Pane: PaneFull,
  PaneTabOptions: PaneTabOptions,
  PaneContent: PaneContent,
};

function getPaneTitle(): string {
  return 'Notifications';
}

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId}>
        <PaneTabOptions {...props} />
      </PaneHeader>
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}

function PaneTabOptions(props: any): React.JSX.Element {
  const onChange = (event: any): void => {
    props.onChangeDataFromPaneTabOptions({ filterText: event.target.value });
  };

  return (
    <div className="pane-tab-input__outer">
      <input
        type="text"
        className="pane-tab-input"
        placeholder="Filter, e.g. by name, type, ..."
        style={{ width: 160 }}
        onChange={onChange}
      />
    </div>
  );
}

function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const bifrost = Bifrost.cast(props.studio);

  const filterText = props.dataFromPaneTabOptions && props.dataFromPaneTabOptions.filterText;
  const lowercaseFilterText = (filterText || '').toLowerCase();
  const notifications = [...bifrost.notifications.getAllNotifications()].filter((notification: Notification) => {
    return notification.options.content.toString().toLowerCase().indexOf(lowercaseFilterText) !== -1;
  });

  return <NotificationInspector notifications={notifications} />;
}

function NotificationInspector(props: { notifications: Notification[] }): React.JSX.Element {
  const { notifications } = props;

  const [expandedNotificationIds, setExpandedNotificationIds] = useState<Record<string, boolean>>({});

  const toggleNotification = useCallback((notificationId: string) => {
    setExpandedNotificationIds((prev) => ({ ...prev, [notificationId]: !prev[notificationId] }));
  }, []);

  const columns = useMemo<TableColumnDef<Notification>[]>(
    () => [
      {
        id: 'time',
        header: 'Time',
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => dayjs(row.original.createdAt).format('HH:mm:ss'),
      },
      {
        id: 'type',
        header: 'Type',
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => row.original.options.type ?? '',
      },
      {
        id: 'expand',
        header: '',
        enableSorting: false,
        enableResizing: false,
        size: 30,
        cell: ({ row }) => {
          const fullContent = row.original.options.content.toString();
          const expandable = fullContent.match(/\n.+/) != null;
          const expanded = expandedNotificationIds[row.original.id] === true;
          if (!expandable) {
            return null;
          }
          return (
            <span className="caret-icon" onClick={() => toggleNotification(row.original.id)}>
              <i className={`ph ${expanded ? 'ph-caret-down' : 'ph-caret-right'}`} />
            </span>
          );
        },
      },
      {
        id: 'message',
        header: 'Message',
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => {
          const fullContent = row.original.options.content.toString();
          const contentToShow = fullContent.split('\n')[0];
          const expanded = expandedNotificationIds[row.original.id] === true;
          return expanded ? <pre style={{ margin: 0 }}>{fullContent}</pre> : contentToShow;
        },
      },
      {
        id: 'source',
        header: 'Source',
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => row.original.options.source ?? '',
      },
    ],
    [expandedNotificationIds, toggleNotification],
  );

  const handleRowClick = useCallback(
    (notification: Notification) => {
      const fullContent = notification.options.content.toString();
      const expandable = fullContent.match(/\n.+/) != null;
      if (expandable) {
        toggleNotification(notification.id);
      }
    },
    [toggleNotification],
  );

  return (
    <div className="pane__content pane__content--table" style={{ minHeight: '60px' }}>
      <Table<Notification>
        data={notifications}
        columns={columns}
        getRowId={(row) => row.id}
        onRowClick={handleRowClick}
      />
    </div>
  );
}
