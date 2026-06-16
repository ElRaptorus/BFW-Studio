import type { CommandContext, CommandResult } from '@evil/bifrost_fw_sdk';
import { AbstractEmitter } from '@evil/bifrost_fw_sdk';

import type { BifrostClient, BifrostOperatingSystem } from '../contracts/BifrostTypes';
import type { KeybindingsDefinition } from './KeybindingsManager';
import { KeybindingsManager } from './KeybindingsManager';

interface ICommandExecutor {
  executeCommand<T = any>(name: string, args: any[], commandContext?: CommandContext): CommandResult<T>;
}

/**
 * Keybindings are keystrokes, like `cmd-ctrl-alt-shift-a`, that are mapped to a command, like `std.internal.empty`.
 *
 * They are valid in a specified setting, i.e. a focus selector (e.g. `body` or `.my-css-class`),
 * client (`*`, `embed`, `webapp`, `electron`) and os (`*`, `linux`, `macos`, `windows`):
 *
 *    {
 *      client: '*',
 *      os: 'macos',
 *      bindings: {
 *        body: {
 *          'cmd-j': 'std.quickJump.show',
 *          'cmd-s': 'std.editor.saveFocusedDocument',
 *        },
 *        '.kbm-quick-jump': {
 *          up: 'std.quickJump.selectPrevious',
 *          down: 'std.quickJump.selectNext',
 *          esc: 'std.quickJump.hide'
 *        },
 *        '.kbm-dialog': {
 *          esc: 'std.dialog.close'
 *        }
 *      }
 *    }
 *
 * The KeybindingsMediator connects Keybindings to a CommandMediator to execute the triggered commands.
 */
export class KeybindingsMediator extends AbstractEmitter {
  private keybindingsManager: KeybindingsManager;

  constructor(
    htmlElement: HTMLElement,
    bindToHtmlElement: boolean,
    client: BifrostClient,
    os: BifrostOperatingSystem,
    commands: ICommandExecutor,
  ) {
    super();

    let keyboardElement;
    if (bindToHtmlElement) {
      keyboardElement = htmlElement;
      keyboardElement.tabIndex = 0;
    } else {
      keyboardElement = document.body;
    }

    this.keybindingsManager = new KeybindingsManager(keyboardElement, client, os);
    this.keybindingsManager.on('executeCommand', (commandName, keyboardEvent) => {
      const context: CommandContext = { type: 'keybinding', keyboardEvent: keyboardEvent };
      keyboardEvent.preventDefault();
      try {
        commands.executeCommand(commandName, [], context);
      } catch (error) {
        if (error.message.startsWith('Executed command is not enabled')) {
          /**
           * Triggering a deactivated command via hotkey (e.g. save document) should not throw any
           * errors as long as the deactivated (command) state can be identified as the reason
           * for the errors occurence (by matching the error message)
           */
        } else {
          throw error;
        }
      }
    });
  }

  /**
   * Loads the given keybindings, if the `client` and `os` match.
   *
   *
   *    > bifrost.keybindings.registerKeyBindings({
   *        client: '*',
   *        os: 'macos',
   *        bindings: {
   *          body: {
   *            'cmd-j': 'std.quickJump.show',
   *            'cmd-n': 'bpmn.editor.newBpmnDocument',
   *            'cmd-s': 'std.editor.saveFocusedDocument',
   *          },
   *          '.kbm-quick-jump': {
   *            up: 'std.quickJump.selectPrevious',
   *            down: 'std.quickJump.selectNext',
   *            esc: 'std.quickJump.hide'
   *          },
   *          '.kbm-dialog': {
   *            esc: 'std.dialog.close'
   *          }
   *        }
   *      })
   */
  registerKeyBindings(keymap: KeybindingsDefinition): void {
    this.keybindingsManager.registerKeyBindings(keymap);
  }

  unregisterKeyBindings(keymap: KeybindingsDefinition): void {
    this.keybindingsManager.unregisterKeyBindings(keymap);
  }

  /**
   * Gets all os-specific key bindings that are currently registered.
   *
   * Example Result:
   * ```js
   * {
   *   'cmd-shift-1': ['some.command', 'some.other.command']
   * }
   * ```
   */
  getAllKeyBindings(): Record<string, any[]> {
    return this.keybindingsManager.getAllKeyBindings();
  }

  /**
   * Returns all keystrokes registered for the given `commandName` and formats them nicely,
   * i.e. `cmd-shift-j` is returned as `⌘⇧J`
   */
  getAllFormattedKeystrokesForCommand(commandName: string): string[] {
    return this.keybindingsManager.getAllFormattedKeystrokesForCommand(commandName);
  }

  /**
   * Returns the first keystroke registered for the given `commandName` and formats it nicely,
   * i.e. `cmd-shift-j` is returned as `⌘⇧J`
   *
   *    > bifrost.keybindings.getFormattedKeystrokeForCommand('std.editor.saveFocusedDocument')
   *    "⌘ S"
   */
  getFormattedKeystrokeForCommand(commandName: string): string {
    return this.keybindingsManager.getFormattedKeystrokeForCommand(commandName);
  }

  getAllKeystrokesForCommand(commandName: string): string[] {
    return this.keybindingsManager.getKeystrokesForCommand(commandName);
  }

  getKeystrokeForCommand(commandName: string): string | null {
    const keystrokes = this.keybindingsManager.getKeystrokesForCommand(commandName);
    return keystrokes[0];
  }
}
