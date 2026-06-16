import type { StatusBarContent } from '#bifrost/contracts/StatusBarTypes';

import React, { Fragment } from 'react';

import type { IconComponent } from '@evil/bifrost_fw_sdk';

type StatusBarContentProps = {
  content: StatusBarContent;
  iconComponent: IconComponent;
};

export default function StatusBarContentRenderer(props: StatusBarContentProps): React.JSX.Element {
  if (Array.isArray(props.content)) {
    return (
      <>
        {props.content.map((contentItem: StatusBarContent, index: number) => (
          <Fragment key={index}>
            <StatusBarContentRenderer content={contentItem} iconComponent={props.iconComponent} />{' '}
          </Fragment>
        ))}
      </>
    );
  }

  if (typeof props.content === 'string') {
    return <span>{props.content}</span>;
  }

  switch (props.content.type) {
    case 'icon': {
      const Icon = props.iconComponent;
      return (
        <span className="status-bar__icon-clip">
          <Icon id={props.content.icon} />
        </span>
      );
    }
    case 'text':
      return <span>{props.content.label}</span>;
  }

  throw new Error(`Can not render invalid statusbar item:\n\n${JSON.stringify(props, null, 2)}`);
}
