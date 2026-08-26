import React, { useEffect } from 'react';

import type { MenuItem } from '../contracts/MenuTypes';
import './PresentationalContextMenu.scss';

export type PresentationalContextMenuProps = {
  items: MenuItem[];
  x: number;
  y: number;
  onCommand: (command: string, commandArgs?: unknown[]) => void;
  onDismiss: () => void;
};

/**
 * Host- and webview-safe context menu. Renders in the same React tree as the caller.
 * No `menuId`, no Studio/Bifrost — the caller supplies items and handles commands.
 */
export function PresentationalContextMenu(props: PresentationalContextMenuProps): React.JSX.Element {
  const { items, x, y, onCommand, onDismiss } = props;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.studio-presentational-context-menu') == null) {
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [onDismiss]);

  return (
    <nav
      role="menu"
      className="studio-presentational-context-menu react-contextmenu react-contextmenu--visible"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => renderItem(item, index, { items, x, y, onCommand, onDismiss }))}
    </nav>
  );
}

function renderItem(item: MenuItem, itemKey: number, props: PresentationalContextMenuProps): React.ReactNode {
  if (item.visible === false) {
    return null;
  }

  switch (item.type) {
    case 'command':
      return (
        <div
          key={item.id ?? itemKey}
          role="menuitem"
          tabIndex={0}
          className="react-contextmenu-item"
          data-menu-item-id={item.id}
          onClick={() => {
            props.onCommand(item.command, item.commandArgs);
            props.onDismiss();
          }}
        >
          {item.icon != null && (
            <span className="react-contextmenu-item__icon">
              <span className={item.icon} />
            </span>
          )}
          <span>{item.label}</span>
        </div>
      );
    case 'divider':
      return (
        <div
          key={item.id ?? itemKey}
          className="react-contextmenu-item react-contextmenu-item--divider"
          data-menu-item-id={item.id}
        />
      );
    case 'menu':
    case 'role':
      return null;
  }
}
