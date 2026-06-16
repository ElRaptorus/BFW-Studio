import React from 'react';

import type { Studio } from '../../../types/Studio';
import { Icon } from '../internal/Icon';

type PaneInfoBarProps = {
  children: React.ReactNode;
  className?: string;
};

type PaneInfoBarItemProps = {
  icon?: string;
  label: string | React.ReactNode;
  tooltip?: string;
};

type PaneInfoBarActionProps = {
  studio: Studio;
  icon: string;
  tooltip: string;
  command: string;
  commandArgs?: any[];
  visible?: boolean;
};

export function PaneInfoBar(props: PaneInfoBarProps): React.JSX.Element {
  const className = props.className ? `pane-info-bar ${props.className}` : 'pane-info-bar';
  return <div className={className}>{props.children}</div>;
}

export function PaneInfoBarItem(props: PaneInfoBarItemProps): React.JSX.Element {
  return (
    <span className="pane-info-bar__item" title={props.tooltip}>
      {props.icon && <Icon id={props.icon} />}
      <span className="pane-info-bar__item-label">{props.label}</span>
    </span>
  );
}

export function PaneInfoBarAction(props: PaneInfoBarActionProps): React.JSX.Element | null {
  if (props.visible === false) {
    return null;
  }

  const studio = props.studio;
  const isEnabled = studio.commands.isCommandEnabled(props.command, props.commandArgs);
  const handler = isEnabled ? studio.commands.getClickHandler()(props.command, props.commandArgs) : undefined;
  const disabledClassName = isEnabled ? '' : ' pane-info-bar__action--disabled';

  return (
    <a
      className={`pane-info-bar__action${disabledClassName}`}
      title={props.tooltip}
      tabIndex={0}
      href="#"
      onClick={handler}
    >
      <Icon id={props.icon} />
    </a>
  );
}
