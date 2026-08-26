import type { Bifrost } from '#bifrost/Bifrost';
import type { StatusBarItem_Menu } from '#bifrost/contracts/StatusBarTypes';
import { showContextMenu } from '#components/ContextMenuFunctions';

import React from 'react';

import { Icon } from '../Icon';
import StatusBarContentRenderer from './StatusBarContentRenderer';

type StatusBarMenuProps = {
  bifrost: Bifrost;
  item: StatusBarItem_Menu;
  htmlAttributes: any;
};

export default function StatusBarMenu(props: StatusBarMenuProps): React.JSX.Element {
  const bifrost: Bifrost = props.bifrost;
  const item = props.item;

  return (
    <div
      className="status-bar__element"
      data-bs-title={item.tooltip}
      data-bs-toggle="tooltip"
      onClick={(event: any) => showContextMenu(event, item.menu, [bifrost])}
      onContextMenu={(event: any) => showContextMenu(event, item.menu, [bifrost])}
      {...props.htmlAttributes}
    >
      <StatusBarContentRenderer content={item.content} iconComponent={Icon} />
    </div>
  );
}
