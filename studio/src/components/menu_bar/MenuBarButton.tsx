import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import { Icon } from '@evil/bifrost_fw_sdk';

import { useBifrost } from '../../bifrostContext';

type MenuBarButtonProps = {
  icon: string;
  tooltip: string;
  command: string;
  htmlAttributes: Record<string, any>;
  commandArgs?: any[];
};

export default function MenuBarButton(props: MenuBarButtonProps): React.JSX.Element {
  const bifrost: Bifrost = useBifrost();
  const cmd = bifrost.commands.getClickHandler();
  const enabled = bifrost.commands.isCommandEnabled(props.command, props.commandArgs);
  const inactiveClassName = enabled ? null : 'menu-bar__button--inactive';
  const handlers = {
    onClick: enabled ? cmd(props.command, props.commandArgs) : undefined,
    'data-test--menubar--button-for-command': props.command,
  };

  let tooltip = props.tooltip;
  const formattedKeystrokes = bifrost.keybindings.getAllFormattedKeystrokesForCommand(props.command);
  if (tooltip != null && formattedKeystrokes != null && formattedKeystrokes.length > 0) {
    tooltip += formattedKeystrokes.map((keystroke) => ` [${keystroke}]`);
  }

  return (
    <span
      className={`menu-bar__button ${inactiveClassName}`}
      {...handlers}
      title={tooltip}
      data-bs-toggle="tooltip"
      {...props.htmlAttributes}
    >
      <Icon id={props.icon} />
    </span>
  );
}
