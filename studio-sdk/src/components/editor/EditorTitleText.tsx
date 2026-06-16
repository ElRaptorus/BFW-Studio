import React from 'react';

import type { Studio } from '../../../types/Studio';
import { Icon } from '../internal/Icon';
import { renderStudioMenuAsDropdown } from './internal/StudioMenuAsDropdownFunctions';

export type EditorTitleTextProps = {
  studio: Studio;
  label: string | React.JSX.Element;
  sublabel?: string | React.JSX.Element;
  tooltip?: string;
  menuId?: string;
  menuArgs?: any[];
};

export function EditorTitleText(props: EditorTitleTextProps): React.JSX.Element {
  const studio = props.studio;

  let label: string | React.JSX.Element = props.label;
  let menuAsDropdown;

  if (props.menuId != null) {
    label = (
      <button className="btn btn-link editor-title__dropdown" data-bs-toggle="dropdown">
        {props.label}
        <span className="editor-title__dropdown-icon">
          <Icon id="ph-light ph-caret-down" />
        </span>
      </button>
    );
    const menu = studio.menus.getMenuSync(props.menuId, props.menuArgs);
    menuAsDropdown = renderStudioMenuAsDropdown(menu, studio);
  }

  return (
    <div className="editor-title__text" title={props.tooltip} data-bs-toggle="tooltip">
      {props.sublabel && <div className="editor-title__text--small">{props.sublabel}</div>}
      <div className="editor-title__text">
        {label}
        {menuAsDropdown}
      </div>
    </div>
  );
}
