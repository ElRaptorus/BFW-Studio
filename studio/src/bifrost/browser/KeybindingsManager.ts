import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import { calculateSpecificity } from 'clear-cut';

import type { BifrostClient, BifrostOperatingSystem } from '../contracts/BifrostTypes';

type Wildcard = '*';

export type KeybindingsDefinition = {
  client: BifrostClient | Wildcard;
  os: BifrostOperatingSystem | Wildcard;
  bindings: { [focusSelector: string]: KeystrokeToCommandMap };
  ignoreForFormInput?: boolean;
};

type KeystrokeToCommandMap = { [keystroke: string]: string };

type KeybindingObject = {
  selector: string;
  command: string;
  specificity: number;
  ignoreForFormInput: boolean;
};

type KeybindingObjectLookup = {
  [keystroke: string]: KeybindingObject[];
};

type StringToStringMap = {
  [name: string]: string;
};

export const KEYSTROKES_TO_IGNORE_FOR_FORM_INPUT = [
  'pageup',
  'pagedown',
  'insert',
  'delete',
  'backspace',
  'space',
  'home',
  'end',
  'left',
  'right',
  'up',
  'down',
  'shift-left',
  'shift-right',
  'shift-up',
  'shift-down',
  'cmd-x',
  'cmd-y',
  'cmd-z',
  'cmd-c',
  'cmd-v',
  'cmd-shift-z',
  'cmd-shift-left',
  'cmd-shift-right',
  'cmd-shift-up',
  'cmd-shift-down',
  'cmd-left',
  'cmd-right',
  'cmd-up',
  'cmd-down',
  'ctrl-x',
  'ctrl-y',
  'ctrl-z',
  'ctrl-c',
  'ctrl-v',
  'ctrl-shift-z',
  'ctrl-shift-left',
  'ctrl-shift-right',
  'ctrl-shift-up',
  'ctrl-shift-down',
  'ctrl-left',
  'ctrl-right',
  'ctrl-up',
  'ctrl-down',
];

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
export class KeybindingsManager extends AbstractEmitter {
  private static SPECIAL_KEY_NAMES: StringToStringMap = {
    ' ': 'space',
    Space: 'space',
    CapsLock: 'capslock',
    Enter: 'enter',
    Escape: 'esc',
    Tab: 'tab',
    Backspace: 'backspace',
    ArrowDown: 'down',
    ArrowUp: 'up',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    PageUp: 'pageup',
    PageDown: 'pagedown',
    Insert: 'insert',
    Delete: 'delete',
    Home: 'home',
    End: 'end',
    F1: 'f1',
    F2: 'f2',
    F3: 'f3',
    F4: 'f4',
    F5: 'f5',
    F6: 'f6',
    F7: 'f7',
    F8: 'f8',
    F9: 'f9',
    F10: 'f10',
    F11: 'f11',
    F12: 'f12',
  };

  private static FORMATTED_KEYSTROKES: StringToStringMap = {
    cmd: '⌘',
    ctrl: '⌃',
    alt: '⌥',
    shift: '⇧',
    capslock: '⇪',
    enter: '↵',
    backspace: '⌫',
    tab: '⇥',
    left: '←',
    right: '→',
    up: '↑',
    down: '↓',
  };

  private static KEYSTROKE_KEY_SEPARATOR = '-';
  private static KEYSTROKE_COMBO_SEPARATOR = ' ';
  private static LAST_KEYSTROKE_RESET_TIMEOUT = 1000; // max milliseconds for keycombination like `cmd-k cmd-t`

  private static WILDCARD = '*';

  private keybindingsByKeystroke: KeybindingObjectLookup;
  private client: BifrostClient;
  private os: BifrostOperatingSystem;

  private lastKeyStroke: string | null;
  private lastKeyStrokeTimeoutId: number | null = null;

  constructor(rootElement: Element, client: BifrostClient, os: BifrostOperatingSystem) {
    super();

    this.client = client;
    this.os = os;
    this.keybindingsByKeystroke = {};
    this.lastKeyStroke = null;
    this.resetLastKeystroke();

    rootElement.addEventListener('keydown', (e: any) => this.keydown(e as KeyboardEvent));
  }

  /**
   * Internal: Returns a keystroke notation of the given `event`.
   */
  static getKeystroke(event: KeyboardEvent): string {
    const platform = navigator.platform;
    const keystroke: string[] = [];
    const { altKey, ctrlKey, keyCode, metaKey, shiftKey } = event;
    let key = event.key;
    const isCharacterKey = key.length === 1;
    const isSpecialKey = KeybindingsManager.SPECIAL_KEY_NAMES[key] != null;

    if (isCharacterKey) {
      const isAscii = keyCode < 128;
      if (isAscii) {
        key = String.fromCharCode(keyCode).toLowerCase();
      }
    }

    if (isSpecialKey) {
      key = KeybindingsManager.SPECIAL_KEY_NAMES[key];
    }

    if (metaKey) {
      if (platform.match(/(mac|darwin)/i)) {
        keystroke.push('cmd');
      } else {
        keystroke.push('meta');
      }
    }
    if (ctrlKey) {
      keystroke.push('ctrl');
    }
    if (altKey) {
      keystroke.push('alt');
    }
    if (shiftKey) {
      keystroke.push('shift');
    }

    if (isCharacterKey || isSpecialKey) {
      keystroke.push(key);
    }

    return keystroke.join(KeybindingsManager.KEYSTROKE_KEY_SEPARATOR);
  }

  // Internal
  static getFormattedKeystroke(keystrokeOrKeystrokeCombo: string): string {
    return (
      keystrokeOrKeystrokeCombo
        // replace instances where '-' denotes the key '-'
        .replace(/--/g, '-😱')
        .split(KeybindingsManager.KEYSTROKE_COMBO_SEPARATOR)
        .map((keystroke: string) => {
          return keystroke
            .split(KeybindingsManager.KEYSTROKE_KEY_SEPARATOR)
            .map((key: string) => KeybindingsManager.FORMATTED_KEYSTROKES[key] || key.toUpperCase())
            .join('');
        })
        .join(' ')
        // insert the key '-' again
        .replace(/😱/g, '-')
    );
  }

  /**
   * Loads the given keybindings if the `client` and `os` match.
   */
  registerKeyBindings({ client, os, bindings, ignoreForFormInput }: KeybindingsDefinition): void {
    const clientMatches = client === this.client || client === KeybindingsManager.WILDCARD;
    const osMatches = os === this.os || os === KeybindingsManager.WILDCARD;

    if (clientMatches && osMatches) {
      this.addKeybindingsToLookup(bindings, ignoreForFormInput ?? true);
    }
  }

  /**
   * Removes keybindings that were previously registered via `registerKeyBindings`.
   * Only removes bindings whose selector, keystroke, and command all match.
   */
  unregisterKeyBindings({ client, os, bindings }: KeybindingsDefinition): void {
    const clientMatches = client === this.client || client === KeybindingsManager.WILDCARD;
    const osMatches = os === this.os || os === KeybindingsManager.WILDCARD;
    if (!clientMatches || !osMatches) {
      return;
    }

    for (const selector of Object.keys(bindings)) {
      const commandMap = bindings[selector];
      for (const keystroke of Object.keys(commandMap)) {
        const command = commandMap[keystroke];
        const list = this.keybindingsByKeystroke[keystroke];
        if (list == null) {
          continue;
        }
        const index = list.findIndex((binding) => binding.selector === selector && binding.command === command);
        if (index !== -1) {
          list.splice(index, 1);
          if (list.length === 0) {
            delete this.keybindingsByKeystroke[keystroke];
          }
        }
      }
    }
  }

  private addKeybindingsToLookup(bindings: any, ignoreForFormInput: boolean): void {
    for (const selector of Object.keys(bindings)) {
      const commandMap = bindings[selector];

      for (const keystroke of Object.keys(commandMap)) {
        const command = commandMap[keystroke];
        // TODO: validate selector using clear-cut's `isSelectorValid`
        const specificity = calculateSpecificity(selector);
        const keybinding: KeybindingObject = { selector, command, specificity, ignoreForFormInput };
        this.keybindingsByKeystroke[keystroke] = this.keybindingsByKeystroke[keystroke] || [];
        this.keybindingsByKeystroke[keystroke].push(keybinding);
      }
    }
  }

  getAllKeyBindings(): Record<string, any[]> {
    const formattedKeyBindings = {};

    for (const keystroke of Object.keys(this.keybindingsByKeystroke)) {
      const commandsForKeystroke = this.keybindingsByKeystroke[keystroke].map((binding) => binding.command);

      formattedKeyBindings[keystroke] = commandsForKeystroke;
    }

    return formattedKeyBindings;
  }

  /**
   * Returns all keystrokes registered for the given `commandName`.
   *
   *    > bifrost.keybindings.getKeystrokesForCommand('std.editor.saveFocusedDocument')
   *    ["cmd-s"]
   */
  getKeystrokesForCommand(commandName: string): string[] {
    const foundKeystrokes: string[] = [];

    for (const keystroke of Object.keys(this.keybindingsByKeystroke)) {
      const allKeybindings = this.keybindingsByKeystroke[keystroke];
      const foundCommand = allKeybindings.some((keybinding: KeybindingObject) => keybinding.command === commandName);

      if (foundCommand) {
        foundKeystrokes.push(keystroke);
      }
    }

    return foundKeystrokes;
  }

  /**
   * Returns the first keystroke registered for the given `commandName` and formats it nicely,
   * i.e. `cmd-shift-j` is returned as `⌘⇧J`
   *
   *    > bifrost.keybindings.getFormattedKeystrokeForCommand('std.editor.saveFocusedDocument')
   *    "⌘ S"
   */
  getFormattedKeystrokeForCommand(commandName: string): string {
    const keystrokes = this.getAllFormattedKeystrokesForCommand(commandName);

    return keystrokes[0];
  }

  /**
   * Returns all keystrokes registered for the given `commandName` and formats them nicely,
   * i.e. `cmd-shift-j` is returned as `⌘⇧J`
   */
  getAllFormattedKeystrokesForCommand(commandName: string): string[] {
    const keystrokes = this.getKeystrokesForCommand(commandName);

    return keystrokes.map((keystroke: string) => KeybindingsManager.getFormattedKeystroke(keystroke));
  }

  private keydown(event: KeyboardEvent): void {
    const keystroke: string = KeybindingsManager.getKeystroke(event);
    const bindings: KeybindingObject[] =
      this.keybindingsByKeystroke[`${this.lastKeyStroke} ${keystroke}`] || this.keybindingsByKeystroke[keystroke];

    if (bindings) {
      const sortBySpecificityDesc = (left: KeybindingObject, right: KeybindingObject): number => {
        if (left.specificity < right.specificity) {
          return 1;
        }
        if (right.specificity > left.specificity) {
          return -1;
        }
        return 0;
      };
      const element = event.target as Element;
      const foundBindings = bindings
        .filter(({ selector }) => element.matches(`${selector}, ${selector} ${element.nodeName}`))
        .sort(sortBySpecificityDesc);

      if (foundBindings.length > 0) {
        const binding = foundBindings[0];
        const isTextInput =
          element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA' || element.nodeName === 'SELECT';
        const shouldExecute =
          !isTextInput ||
          (isTextInput && !binding.ignoreForFormInput) ||
          (isTextInput && binding.ignoreForFormInput && !this.isIgnorableKeystroke(keystroke));

        if (shouldExecute) {
          this.emit('executeCommand', [binding.command, event]);
          this.resetLastKeystroke();
        }

        return;
      }
    }

    this.setLastKeystroke(keystroke);
  }

  private setLastKeystroke(keystroke: string): void {
    this.lastKeyStroke = keystroke;
    this.lastKeyStrokeTimeoutId = window.setTimeout(
      () => this.resetLastKeystroke(),
      KeybindingsManager.LAST_KEYSTROKE_RESET_TIMEOUT,
    );
  }

  private resetLastKeystroke(): void {
    this.lastKeyStroke = null;
    if (this.lastKeyStrokeTimeoutId != null) {
      window.clearTimeout(this.lastKeyStrokeTimeoutId);
      this.lastKeyStrokeTimeoutId = null;
    }
  }

  private isIgnorableKeystroke(keystroke: string): boolean {
    return keystroke.length === 1 || KEYSTROKES_TO_IGNORE_FOR_FORM_INPUT.includes(keystroke);
  }
}
