import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import type { PaneAreaName } from '@evil/bifrost_fw_sdk';
import { Icon } from '@evil/bifrost_fw_sdk';

import { useBifrost } from '../../bifrostContext';

type MenuBarPaneContentToggleProps = {
  icon: string;
  tooltip: string;
  paneAreaId: PaneAreaName;
  paneId: string;
  htmlAttributes: Record<string, any>;
};

export default function MenuBarPaneContentToggle(props: MenuBarPaneContentToggleProps): React.JSX.Element {
  const bifrost: Bifrost = useBifrost();

  const isActive = bifrost.panes.isPaneGroupVisibleByPaneId(props.paneId);

  const classNames = ['menu-bar__button'];
  const htmlAttributes: Record<string, any> = { ...props.htmlAttributes };

  if (isActive) {
    classNames.push('menu-bar__button--active');
    htmlAttributes['data-test--active'] = true;
  }

  const handleClick = () => {
    bifrost.panes.setVisibilityOfPaneAreaByPaneId(props.paneId, true);
  };

  return (
    <span
      className={classNames.join(' ')}
      onClick={handleClick}
      data-bs-title={props.tooltip}
      data-bs-toggle="tooltip"
      {...htmlAttributes}
    >
      <Icon id={props.icon} />
    </span>
  );
}
