import { ipcRenderer } from 'electron';

import type { MenuItem } from '@evil/bifrost_fw_sdk';

import type { Bifrost } from '../Bifrost';
import { MenuManager } from '../common/MenuManager';
import { IPC_MESSAGE_EXECUTE_COMMAND_AT_RENDERER, IPC_MESSAGE_UPDATE_MAIN_MENU } from '../contracts/IpcEvents';

const KEYSTROKES_TO_ACCELERATORS: { [name: string]: string } = {
  cmd: 'Command',
  ctrl: 'Control',
  alt: 'Alt',
  shift: 'Shift',
  capslock: 'Capslock',
  enter: 'Enter',
  backspace: 'Backspace',
  tab: 'Tab',
  left: 'Left',
  right: 'Right',
  up: 'Up',
  down: 'Down',
};

const UPDATE_MENU_TIMEOUT = 400;

export default class MenuManagerElectron extends MenuManager {
  private updateMainMenuTimeoutId: number | null = null;
  private bifrost: Bifrost | null = null;

  constructor() {
    super();

    ipcRenderer.on(IPC_MESSAGE_EXECUTE_COMMAND_AT_RENDERER, (event, commandName, commandArgs) => {
      if (this.bifrost == null) {
        console.warn(`MenuManagerElectron: Ignoring IPC command '${commandName}' — bifrost not initialized yet.`);
        return;
      }
      this.bifrost.commands.executeCommand(commandName, commandArgs);
    });
  }

  async updateMenus(bifrost: Bifrost): Promise<void> {
    this.bifrost = bifrost;
    if (this.updateMainMenuTimeoutId != null) {
      window.clearTimeout(this.updateMainMenuTimeoutId);
    }

    this.updateMainMenuTimeoutId = window.setTimeout(() => {
      if (this.bifrost?.isInitialized) {
        this.updateMainMenu(bifrost);
      }
    }, UPDATE_MENU_TIMEOUT);
  }

  async updateMainMenu(bifrost: Bifrost): Promise<void> {
    this.bifrost = bifrost;
    const appMenu = await bifrost.menus.getMenu('std/application/main', [bifrost]);

    const appMenuTemplate = appMenu
      .filter((menuObject) => menuObject.visible != false)
      .map((menuObject) => this.convertMenuToElectronMenu(menuObject, bifrost));

    ipcRenderer.send(IPC_MESSAGE_UPDATE_MAIN_MENU, appMenuTemplate);
  }

  private convertMenuToElectronMenu(menuItem: MenuItem, bifrost: Bifrost): any {
    switch (menuItem.type) {
      case 'command': {
        const keystroke = bifrost.keybindings.getKeystrokeForCommand(menuItem.command);
        const accelerator = keystroke == null ? null : this.convertKeystrokeToAccelerator(keystroke);

        return {
          type: menuItem.checked == null ? 'normal' : 'checkbox',
          label: menuItem.label,
          checked: menuItem.checked,
          enabled: bifrost.commands.isCommandEnabled(menuItem.command, menuItem.commandArgs),
          accelerator: accelerator,
          command: menuItem.command,
          commandArgs: menuItem.commandArgs,
        };
      }

      case 'role':
        return {
          role: menuItem.role,
          label: menuItem.label,
        };
      case 'menu': {
        const submenu: any[] = menuItem.submenu
          .filter((submenuObject) => submenuObject.visible != false)
          .map((submenuObject) => this.convertMenuToElectronMenu(submenuObject, bifrost));
        return {
          label: menuItem.label,
          submenu: submenu,
        };
      }
      case 'divider':
        return {
          type: 'separator',
        };
    }

    throw new Error(`Could not convert menuObject: ${JSON.stringify(menuItem)}`);
  }

  private convertKeystrokeToAccelerator(keystroke: string): string {
    const accellerator = keystroke
      .replace(/-\+/g, '-Plus')
      .split(' ')
      .map((keystroke: string) => {
        return keystroke
          .split('-')
          .map((key: string) => KEYSTROKES_TO_ACCELERATORS[key] || key.toUpperCase())
          .join('+');
      })
      .join(' ');

    return accellerator;
  }
}
