import type { IconComponent } from '#bifrost/contracts/IconTypes';
import type { StatusBarContent } from '#bifrost/contracts/StatusBarTypes';

import React, { Fragment } from 'react';

type StatusBarContentProps = {
  content: StatusBarContent;
  iconComponent: IconComponent;
};

export default function StatusBarContentRenderer(props: StatusBarContentProps): React.JSX.Element | null {
  if (Array.isArray(props.content)) {
    const pieces = props.content.filter(isRenderableStatusBarContent);
    if (pieces.length === 0) {
      return null;
    }
    const occurrenceByKey = new Map<string, number>();
    return (
      <>
        {pieces.map((contentItem) => {
          const baseKey = statusBarContentItemKey(contentItem);
          const occurrence = (occurrenceByKey.get(baseKey) ?? 0) + 1;
          occurrenceByKey.set(baseKey, occurrence);
          return (
            <Fragment key={`${baseKey}:${occurrence}`}>
              <StatusBarContentRenderer content={contentItem} iconComponent={props.iconComponent} />
            </Fragment>
          );
        })}
      </>
    );
  }

  if (typeof props.content === 'string') {
    return <span>{props.content}</span>;
  }

  if (props.content == null || typeof props.content !== 'object') {
    return null;
  }

  switch (props.content.type) {
    case 'icon': {
      if (typeof props.content.icon !== 'string' || props.content.icon === '') {
        return null;
      }
      const Icon = props.iconComponent;
      return (
        <span className="status-bar__icon-clip">
          <Icon id={props.content.icon} />
        </span>
      );
    }
    case 'text':
      return <span>{props.content.label}</span>;
    default:
      return null;
  }
}

function isRenderableStatusBarContent(contentItem: StatusBarContent): boolean {
  if (typeof contentItem === 'string') {
    return contentItem !== '';
  }
  if (Array.isArray(contentItem)) {
    return contentItem.some(isRenderableStatusBarContent);
  }
  if (contentItem == null || typeof contentItem !== 'object') {
    return false;
  }
  return contentItem.type === 'icon' || contentItem.type === 'text';
}

function statusBarContentItemKey(contentItem: StatusBarContent): string {
  if (Array.isArray(contentItem)) {
    return contentItem.map(statusBarContentItemKey).join('|');
  }
  if (typeof contentItem === 'string') {
    return `string:${contentItem}`;
  }
  if (contentItem == null || typeof contentItem !== 'object') {
    return 'invalid';
  }
  switch (contentItem.type) {
    case 'icon':
      return `icon:${contentItem.icon}`;
    case 'text':
      return `text:${contentItem.label}`;
    default:
      return 'unknown';
  }
}
