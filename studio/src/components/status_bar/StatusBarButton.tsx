import type { Bifrost } from '#bifrost/Bifrost';
import type { StatusBarItem_Button } from '#bifrost/contracts/StatusBarTypes';

import React from 'react';

import { Icon, assertNotNull, showContextMenu } from '@evil/bifrost_fw_sdk';

import StatusBarContentRenderer from './StatusBarContentRenderer';

type StatusBarButtonProps = {
  bifrost: Bifrost;
  item: StatusBarItem_Button;
  htmlAttributes: any;
};

export default function StatusBarButton(props: StatusBarButtonProps): React.JSX.Element {
  const bifrost: Bifrost = props.bifrost;
  const item = props.item;

  const cmd = bifrost.commands.getClickHandler();
  const enabled = bifrost.commands.isCommandEnabled(item.command, item.commandArgs);
  const inactiveClassName = enabled ? '' : 'status-bar__element--inactive';
  const divProps: any = enabled ? { onClick: cmd(item.command, item.commandArgs) } : {};

  divProps[`data-test-${item.id.replace(/\//g, '-')}`] = true;

  if (item.contextMenuId != null) {
    divProps['onContextMenu'] = (event: any) => {
      assertNotNull(item.contextMenuId, 'item.contextMenu');
      showContextMenu(event, item.contextMenuId, item.contextMenuArgs);
    };
  }

  return (
    <div
      className={`status-bar__element ${item.active ? 'status-bar__element--active' : ''} ${inactiveClassName}`}
      title={item.tooltip}
      {...divProps}
      {...props.htmlAttributes}
    >
      <StatusBarContentRenderer content={item.content} iconComponent={Icon} />
    </div>
  );
}
