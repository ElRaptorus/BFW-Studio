import type { StudioClient, StudioOperatingSystem } from '../contracts/StudioTypes';

declare type Wildcard = '*';

export declare type ClickModifierKeysDefinition = {
  client: StudioClient | Wildcard;
  os: StudioOperatingSystem | Wildcard;
  modifiers: {
    [focusSelector: string]: KeystrokeToCommandMap;
  };
};

declare type KeystrokeToCommandMap = {
  [keystroke: string]: string;
};

/**
 * Keymodifiers are pressed keys, like `cmd-shift`, that modify an action like a click or submit and are mapped to a
 * modifier name, like `multi-select-individual`.
 * They are valid in a specified setting, i.e. a focus selector (e.g. `body` or `.my-css-class`),
 * client (`*`, `embed`, `webapp`, `electron`) and os (`*`, `linux`, `macos`, `windows`):
 *
 *    {
 *      client: '*',
 *      os: 'macos',
 *      modifiers: {
 *        '.kbm-treeview': {
 *          cmd: 'selectMultipleItemsIndividually',
 *          shift: 'selectMultipleItemsByRange',
 *        }
 *      }
 *    }
 */
export declare class ClickModifierKeysManager {
  /**
   * Returns an object with any pressed modifiers set to `true`.
   *
   * Example:
   *
   * If the following modifiers are registered:
   *
   *      studio.clickModifierKeys.registerModifierKeys({
   *        client: '*',
   *        os: 'macos',
   *        modifiers: {
   *          '.kbm-treeview': {
   *            cmd: 'selectMultipleItemsIndividually',
   *            shift: 'selectMultipleItemsByRange',
   *          },
   *        },
   *      });
   *
   * `getModifiersForEvent` can now be used inside any `onClick` handler and
   * if `cmd` or `shift` are pressed while clicking on an element inside `.kbm-treeview`, `getModifiersForEvent`
   * will return an object representing the pressed state:
   *
   *      const modifiers = studio.clickModifierKeys.getModifiersForEvent(event);
   *      modifiers.selectMultipleItemsIndividually // `true` if `cmd` was pressed during the click
   *
   * Naturally, these modifiers are highly use-case specific as well as dependent on OS and client.
   */
  getModifiersForEvent<T = any>(event: any): T;

  /**
   * Loads the given modifier keys if the `client` and `os` match.
   */
  registerModifierKeys({ client, os, modifiers }: ClickModifierKeysDefinition): void;
}
