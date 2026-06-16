import React from 'react';

import type { Studio } from '../../../types/Studio';
import { Icon } from '../internal/Icon';

type PaneHeaderIconProps = {
  studio: Studio;
  icon: string;
  tooltip: string;
  command: string;
  commandArgs?: any[];
  dataTestId?: string;
};

export function PaneHeaderIcon(props: PaneHeaderIconProps): React.JSX.Element {
  const studio: Studio = props.studio;
  const cmd = studio.commands.getClickHandler();
  const isCommandEnabled = studio.commands.isCommandEnabled(props.command, props.commandArgs);
  const inactiveClassName = isCommandEnabled ? '' : 'pane-header__icon--inactive';
  const handlers = isCommandEnabled ? { onClick: cmd(props.command, props.commandArgs) } : {};
  const testAttr = props.dataTestId != null ? { [`data-test--${props.dataTestId}`]: true } : {};

  return (
    <a
      className={`pane-header__icon ${inactiveClassName}`}
      title={props.tooltip}
      data-bs-toggle="tooltip"
      tabIndex={0}
      href="#"
      {...handlers}
      {...testAttr}
    >
      <Icon id={props.icon} />
    </a>
  );
}
