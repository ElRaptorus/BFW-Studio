import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

import { type Menu, type MenuItem } from '@evil/bifrost_fw_sdk';

import { Icon } from '../../Icon';

export function renderStudioMenuAsDropdown(menu: Menu | MenuItem, studio: Bifrost, itemKey: number = 0): any {
  const cmd = studio.commands.getClickHandler();

  if (Array.isArray(menu)) {
    return (
      <div className="dropdown-menu">
        {menu.map((menu: any, index: number) => renderStudioMenuAsDropdown(menu, studio, index))}
      </div>
    );
  }

  if (menu.visible === false) {
    return null;
  }

  switch (menu.type) {
    case 'command': {
      const icon = menu.checked && menu.icon == null ? 'std/menu/checked' : menu.icon;
      const formattedKeystroke = studio.keybindings.getFormattedKeystrokeForCommand(menu.command);
      const menuWithKeystrokeAndChecked = { ...menu, formattedKeystroke, icon };
      const enabled = studio.commands.isCommandEnabled(
        menuWithKeystrokeAndChecked.command,
        menuWithKeystrokeAndChecked.commandArgs,
      );

      let onClick;
      if (enabled) {
        onClick = cmd(menuWithKeystrokeAndChecked.command, menuWithKeystrokeAndChecked.commandArgs);
      }

      return (
        <a className={`dropdown-item ${enabled ? '' : 'disabled'}`} href="#" onClick={onClick} key={itemKey}>
          {menuWithKeystrokeAndChecked.icon && (
            <span className="dropdown-item__icon">
              <Icon id={menuWithKeystrokeAndChecked.icon} />
            </span>
          )}
          <span>{menuWithKeystrokeAndChecked.label}</span>

          {menuWithKeystrokeAndChecked.formattedKeystroke && (
            <span className="keystroke dropdown-item__keystroke">{menuWithKeystrokeAndChecked.formattedKeystroke}</span>
          )}
        </a>
      );
    }
    case 'divider':
      return <div className="dropdown-divider" key={itemKey} />;
  }

  throw new Error(`Can not render invalid menu item:\n\n${JSON.stringify(menu, null, 2)}`);
}
