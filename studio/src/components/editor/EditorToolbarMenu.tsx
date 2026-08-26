import type { Bifrost } from '#bifrost/Bifrost';

import React, { Fragment } from 'react';

import { Icon } from '../Icon';
import { renderStudioMenuAsDropdown } from './internal/StudioMenuAsDropdownFunctions';

type EditorToolbarMenuProps = {
  studio: Bifrost;

  /**
   * The icon to be displayed, e.g. "std/help".
   */
  icon?: string;

  /**
   * The tooltip to be displayed, e.g. "Show changes".
   */
  tooltip?: string;

  /**
   * An optional label to be displayed, e.g. "Export file ...".
   */
  label?: string;

  menuId: string;

  menuArgs?: any[];
};

/**
 * Describes a button which triggers a menu in the editor-toolbar section of a document.
 */
export function EditorToolbarMenu(props: EditorToolbarMenuProps): React.JSX.Element {
  const studio: Bifrost = props.studio;
  const menu = studio.menus.getMenuSync(props.menuId, props.menuArgs);
  const menuAsDropdown = renderStudioMenuAsDropdown(menu, studio);

  return (
    <Fragment>
      <button className="editor-toolbar__menu" title={props.tooltip} data-bs-toggle="dropdown">
        {props.icon && <Icon id={props.icon} />} {props.label}
        <span className="editor-toolbar__dropdown-icon">
          <Icon id="ph-light ph-caret-down" />
        </span>
      </button>
      {menuAsDropdown}
    </Fragment>
  );
}
