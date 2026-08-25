import type { Bifrost } from '#bifrost/Bifrost';
import type { StatusBarItem } from '#bifrost/contracts/StatusBarTypes';

import React from 'react';

import { ErrorBoundary } from '../ErrorBoundary';
import StatusBarButton from './StatusBarButton';
import StatusBarDivider from './StatusBarDivider';
import StatusBarMenu from './StatusBarMenu';

type StatusBarProps = {
  bifrost: Bifrost;
  items: {
    left: StatusBarItem[];
    center: StatusBarItem[];
    right: StatusBarItem[];
  };
  progressLabel: string | null;
};

/**
 * The status bar is primarily an information tool. Items may trigger lightweight, contextual
 * actions (e.g. switching branches, syncing, toggling a setting), but must not be required for
 * core workflow navigation. Users should always be able to accomplish the same action through
 * the command search, menus, or pane controls.
 */
export default function StatusBar(props: StatusBarProps): React.JSX.Element {
  const bifrost: Bifrost = props.bifrost;

  return (
    <div className="status-bar">
      <div className="status-bar__left">
        {renderStatusBarItemObjects(props.items.left, bifrost)}
        {props.progressLabel != null && (
          <div className="status-bar__element status-bar__progress">
            <i className="ph-duotone ph-spinner-gap ph-spin" />
            <span>{props.progressLabel}</span>
          </div>
        )}
      </div>
      <div className="status-bar__center">{renderStatusBarItemObjects(props.items.center, bifrost)}</div>
      <div className="status-bar__right">{renderStatusBarItemObjects(props.items.right, bifrost)}</div>
    </div>
  );
}

function renderStatusBarItemObjects(items: StatusBarItem[], bifrost: Bifrost): React.JSX.Element[] {
  return items.map((item: StatusBarItem) => (
    <ErrorBoundary key={item.id}>{renderStatusBarItemObject(item, bifrost)}</ErrorBoundary>
  ));
}

function renderStatusBarItemObject(item: StatusBarItem, bifrost: Bifrost): any {
  if (item.visible === false) {
    return null;
  }

  switch (item.type) {
    case 'button':
      return <StatusBarButton bifrost={bifrost} item={item} htmlAttributes={getHtmlAttributes(item)} />;
    case 'divider':
      return <StatusBarDivider bifrost={bifrost} item={item} htmlAttributes={getHtmlAttributes(item)} />;
    case 'menu':
      return <StatusBarMenu bifrost={bifrost} item={item} htmlAttributes={getHtmlAttributes(item)} />;
  }

  console.error(`Unknown type for StatusMenuBarObject: '${(item as any).type}' (${JSON.stringify(item, null, 2)})`);
  return null;
}

function getHtmlAttributes(item: StatusBarItem): any {
  const htmlAttributes: any = {};

  htmlAttributes[`data-status-bar-item-id`] = item.id;

  return htmlAttributes;
}
