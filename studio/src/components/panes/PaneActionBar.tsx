import React from 'react';

import { Icon } from '../Icon';

type PaneActionBarProps = {
  children: React.ReactNode;
};

export type PaneActionButtonProps = {
  icon?: string;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  tooltip?: string;
  htmlAttributes?: object;
};

export function PaneActionBar(props: PaneActionBarProps): React.JSX.Element {
  return <div className="pane-action-bar">{props.children}</div>;
}

export function PaneActionButton(props: PaneActionButtonProps): React.JSX.Element {
  const variant = props.variant ?? 'secondary';
  const className = `pane-action-bar__button pane-action-bar__button--${variant}`;
  const disabledClassName = props.disabled ? ' pane-action-bar__button--disabled' : '';

  return (
    <button
      className={`${className}${disabledClassName}`}
      onClick={props.disabled ? undefined : props.onClick}
      disabled={props.disabled}
      title={props.tooltip}
      {...props.htmlAttributes}
    >
      {props.icon && <Icon id={props.icon} />}
      {props.label && <span>{props.label}</span>}
    </button>
  );
}
