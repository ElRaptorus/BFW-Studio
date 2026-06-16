import React, { Fragment, useLayoutEffect, useState } from 'react';

import type { Menu, MenuItem, Studio } from '@evil/bifrost_fw_sdk';
import { ContextMenuStore, Icon } from '@evil/bifrost_fw_sdk';

/**
 * Renders Bifrost MenuItems as plain HTML elements with preserved CSS class names.
 */
export function renderBifrostMenu(menu: Menu | MenuItem, bifrost: Studio, itemKey: number = 0): any {
  const cmd = bifrost.commands.getClickHandler();

  if (Array.isArray(menu)) {
    return menu.map((menu: any, index: number) => renderBifrostMenu(menu, bifrost, index));
  }

  if (menu.visible === false) {
    return null;
  }

  switch (menu.type) {
    case 'command': {
      const icon = menu.checked && menu.icon == null ? 'std/menu/checked' : menu.icon;
      const formattedKeystroke = bifrost.keybindings.getFormattedKeystrokeForCommand(menu.command);
      const menuItem = { ...menu, formattedKeystroke, icon };

      const enabled = bifrost.commands.isCommandEnabled(menuItem.command, menuItem.commandArgs);
      const clickHandler = cmd(menuItem.command, menuItem.commandArgs);

      const disabledClass = !enabled ? ' react-contextmenu-item--disabled' : '';

      return (
        <div
          key={itemKey}
          role="menuitem"
          tabIndex={enabled ? 0 : -1}
          className={`react-contextmenu-item${disabledClass}`}
          data-menu-item-id={menu.id}
          data-test--context-menu-id={menu.id}
          onClick={(e) => {
            if (!enabled) {
              return;
            }
            clickHandler(e);
            ContextMenuStore.hide();
          }}
        >
          {menuItem.icon && (
            <span className="react-contextmenu-item__icon">
              <Icon id={menuItem.icon} />
            </span>
          )}
          <span>{menuItem.label}</span>
          {menuItem.formattedKeystroke && (
            <span className="keystroke react-contextmenu-item__keystroke">{menuItem.formattedKeystroke}</span>
          )}
        </div>
      );
    }
    case 'menu':
      return <SubmenuItem key={itemKey} label={menu.label} submenu={menu.submenu} bifrost={bifrost} />;
    case 'role':
      return <Fragment key={itemKey} />;
    case 'divider':
      return (
        <div
          key={itemKey}
          className="react-contextmenu-item react-contextmenu-item--divider"
          data-menu-item-id={menu.id}
          data-test--context-menu-id={menu.id}
        />
      );
  }

  throw new Error(`Can not render invalid menu item:\n\n${JSON.stringify(menu, null, 2)}`);
}

type SubmenuItemProps = {
  label: string;
  submenu: MenuItem[];
  bifrost: Studio;
};

function SubmenuItem({ label, submenu, bifrost }: SubmenuItemProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const submenuRef = React.useRef<HTMLDivElement>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || ref.current == null || submenuRef.current == null) {
      return;
    }

    const parentRect = ref.current.getBoundingClientRect();
    const subRect = submenuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = parentRect.right;
    let top = parentRect.top;

    if (left + subRect.width > vw) {
      left = parentRect.left - subRect.width;
    }
    if (top + subRect.height > vh) {
      top = vh - subRect.height;
    }

    left = Math.max(0, left);
    top = Math.max(0, top);

    setSubmenuPosition({ left, top });
  }, [open]);

  const onMouseLeave = (): void => {
    setOpen(false);
    setSubmenuPosition(null);
  };

  return (
    <div
      ref={ref}
      className="react-contextmenu-item react-contextmenu-submenu"
      style={{ position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={onMouseLeave}
    >
      <div className="react-contextmenu-item" role="menuitem" tabIndex={0}>
        <span>{label}</span>
      </div>
      {open && (
        <nav
          ref={submenuRef}
          role="menu"
          className="react-contextmenu react-contextmenu--visible"
          style={{
            position: 'fixed',
            zIndex: 10000,
            opacity: submenuPosition != null ? 1 : 0,
            pointerEvents: submenuPosition != null ? 'auto' : 'none',
            left: submenuPosition?.left,
            top: submenuPosition?.top,
          }}
        >
          {submenu.map((item: MenuItem, index: number) => renderBifrostMenu(item, bifrost, index))}
        </nav>
      )}
    </div>
  );
}
