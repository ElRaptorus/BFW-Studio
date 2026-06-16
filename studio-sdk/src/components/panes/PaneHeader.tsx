import React from 'react';

import type { Studio } from '../../../index';
import { assertNotNull, showContextMenu } from '../../../index';
import { Icon } from '../internal/Icon';

export type PaneHeaderProps = {
  studio: Studio;
  className?: string;
  title: string;
  /**
   * ID of the menu that is display in top-right corner of the header
   */
  menuId?: string;
  children?: any;

  paneId: string;
  collapsed?: boolean;
};

export function PaneHeader(props: PaneHeaderProps): React.JSX.Element {
  const studio: Studio = props.studio;
  const cmd = studio.commands.getClickHandler();
  const isCollapsible = props.collapsed != null;
  const onClick = isCollapsible ? cmd('std.workbench.setPaneCollapsed', [props.paneId, !props.collapsed]) : undefined;
  const onKeyDown = isCollapsible
    ? (event) => {
        const targetIsHeader =
          (event.target as HTMLElement).className.includes('pane-header') &&
          (event.target as HTMLElement).tagName === 'DIV';

        if (!targetIsHeader || (event.key !== 'Enter' && event.key !== ' ')) {
          return;
        }

        event.preventDefault();

        studio.commands.executeCommand('std.workbench.setPaneCollapsed', [props.paneId, !props.collapsed]);
      }
    : undefined;

  let onMenuClick: any;
  if (props.menuId != null) {
    onMenuClick = (event: any) => {
      assertNotNull(props.menuId, 'props.menuId');
      showContextMenu(event, props.menuId, [studio, props.paneId, props.collapsed]);
    };
  }

  return (
    <div
      className={`pane-header ${props.className} ${props.collapsed ? 'pane-header--collapsed' : ''}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <span className="pane-header__title" onClick={onClick}>
        {isCollapsible && (
          <span className="pane-header__twistie">
            <Icon
              id={
                props.collapsed
                  ? 'ph-light ph-caret-right treeview__icon--ph-caret-closed'
                  : 'ph-fill ph-caret-right treeview__icon--ph-caret-open'
              }
            />
          </span>
        )}
        <span>{props.title}</span>
      </span>

      <span className="pane-header__options">
        {props.children}
        {props.menuId && (
          <a href="#" className="pane-header__icon" onClick={onMenuClick} onContextMenu={onMenuClick}>
            <Icon id="ph ph-dots-three-vertical" />
          </a>
        )}
      </span>
    </div>
  );
}
