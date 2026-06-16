import type { StudioClient, StudioOperatingSystem } from '../contracts/StudioTypes';

declare type Wildcard = '*';
export declare type KeybindingsDefinition = {
  client: StudioClient | Wildcard;
  os: StudioOperatingSystem | Wildcard;
  bindings: {
    [focusSelector: string]: KeystrokeToCommandMap;
  };
  ignoreForFormInput?: boolean;
};
declare type KeystrokeToCommandMap = {
  [keystroke: string]: string;
};
export declare const KEYSTROKES_TO_IGNORE_FOR_FORM_INPUT: string[];
/**
 * Keybindings are keystrokes, like `cmd-ctrl-alt-shift-a`, that are mapped to a command, like `std.internal.empty`.
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
 */
export declare class KeybindingsManager {
  static getFormattedKeystroke(keystrokeOrKeystrokeCombo: string): string;

  /**
   * Loads the given keybindings if the `client` and `os` match.
   */
  registerKeyBindings({ client, os, bindings, ignoreForFormInput }: KeybindingsDefinition): void;

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
  getAllKeyBindings(): Record<string, any[]>;

  /**
   * Returns all keystrokes registered for the given `commandName`.
   *
   *    > studio.keybindings.getKeystrokesForCommand('std.editor.saveFocusedDocument')
   *    ["cmd-s"]
   */
  getKeystrokesForCommand(commandName: string): string[];

  /**
   * Returns the first keystroke registered for the given `commandName` and formats it nicely,
   * i.e. `cmd-shift-j` is returned as `⌘⇧J`
   *
   *    > studio.keybindings.getFormattedKeystrokeForCommand('std.editor.saveFocusedDocument')
   *    "⌘ S"
   */
  getFormattedKeystrokeForCommand(commandName: string): string;

  /**
   * Returns all keystrokes registered for the given `commandName` and formats them nicely,
   * i.e. `cmd-shift-j` is returned as `⌘⇧J`
   */
  getAllFormattedKeystrokesForCommand(commandName: string): string[];
}
export {};
