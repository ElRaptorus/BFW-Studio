import type { KeybindingsDefinition } from './KeybindingsManager';

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
export declare class KeybindingsMediator {
  /**
   * Loads the given keybindings, if the `client` and `os` match.
   *
   *
   *    > studio.keybindings.registerKeyBindings({
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
  registerKeyBindings(keymap: KeybindingsDefinition): void;

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
   * Returns the first keystroke registered for the given `commandName` and formats it nicely,
   * i.e. `cmd-shift-j` is returned as `⌘⇧J`
   *
   *    > studio.keybindings.getFormattedKeystrokeForCommand('std.editor.saveFocusedDocument')
   *    "⌘ S"
   */
  getFormattedKeystrokeForCommand(commandName: string): string;

  /**
   * Returns the first keystroke registered for the given `commandName`.
   *
   *    > studio.keybindings.getFormattedKeystrokeForCommand('std.editor.saveFocusedDocument')
   *    "cmd-s"
   */
  getKeystrokeForCommand(commandName: string): string | null;
}
