import type { Bifrost } from '#bifrost/Bifrost';
import { showContextMenu } from '#components/ContextMenuFunctions';

import React from 'react';

import { useBifrost } from '../../bifrostContext';
import { Icon } from '../Icon';

type MenuBarMenuProps = {
  menu: string;
  icon: string;
  htmlAttributes: Record<string, any>;
  tooltip?: string;
};

export default function MenuBarMenu(props: MenuBarMenuProps): React.JSX.Element {
  const bifrost: Bifrost = useBifrost();

  return (
    <span
      className="menu-bar__button"
      data-bs-title={props.tooltip}
      data-bs-toggle="tooltip"
      onClick={(event: any) => showContextMenu(event, props.menu, [bifrost])}
      onContextMenu={(event: any) => showContextMenu(event, props.menu, [bifrost])}
      {...props.htmlAttributes}
    >
      <Icon id={props.icon} />
    </span>
  );
}
