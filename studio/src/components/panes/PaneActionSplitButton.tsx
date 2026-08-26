import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import { Icon } from '../Icon';
import { renderStudioMenuAsDropdown } from '../editor/internal/StudioMenuAsDropdownFunctions';

export type PaneActionSplitButtonProps = {
  studio: Bifrost;
  icon?: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  tooltip?: string;
  menuId: string;
  menuArgs?: any[];
  htmlAttributes?: object;
};

export function PaneActionSplitButton(props: PaneActionSplitButtonProps): React.JSX.Element {
  const variant = props.variant ?? 'primary';
  const menu = props.studio.menus.getMenuSync(props.menuId, props.menuArgs);
  const menuAsDropdown = renderStudioMenuAsDropdown(menu, props.studio);

  const baseClass = `pane-action-split-button pane-action-split-button--${variant}`;
  const disabledClass = props.disabled ? ' pane-action-split-button--disabled' : '';

  return (
    <div className={`${baseClass}${disabledClass}`} {...props.htmlAttributes}>
      <button
        className="pane-action-split-button__main"
        onClick={props.disabled ? undefined : props.onClick}
        disabled={props.disabled}
        title={props.tooltip}
      >
        {props.icon && <Icon id={props.icon} />}
        <span>{props.label}</span>
      </button>
      <button
        className="pane-action-split-button__trigger"
        disabled={props.disabled}
        data-bs-toggle={props.disabled ? undefined : 'dropdown'}
      >
        <Icon id="ph-light ph-caret-down" />
      </button>
      {menuAsDropdown}
    </div>
  );
}
