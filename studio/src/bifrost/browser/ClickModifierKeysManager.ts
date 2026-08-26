import { AbstractEmitter } from '#bifrost/common/AbstractEmitter';
import { calculateSpecificity } from 'clear-cut';

import type { BifrostClient, BifrostOperatingSystem } from '../contracts/BifrostTypes';

type Wildcard = '*';

export type ClickModifierKeysDefinition = {
  client: BifrostClient | Wildcard;
  os: BifrostOperatingSystem | Wildcard;
  modifiers: { [focusSelector: string]: KeystrokeToCommandMap };
};

type KeystrokeToCommandMap = { [keystroke: string]: string };

type ClickModifierKeyObject = {
  selector: string;
  clickModifier: string;
  specificity: number;
};

type KeybindingObjectLookup = {
  [keystroke: string]: ClickModifierKeyObject[];
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
 *        '.kbm-quick-jump': {
 *          "cmd": 'open-in-new-window',
 *          "alt": 'open-in-new-split-editor',
 *        },
 *        '.kbm-treeview': {
 *          'cmd': 'select-multiple-individually',
 *          'shift': 'select-multiple-by-range'
 *        }
 *      }
 *    }
 */
export class ClickModifierKeysManager extends AbstractEmitter {
  private static WILDCARD = '*';

  private clickModifiersByKeystroke: KeybindingObjectLookup;
  private client: BifrostClient;
  private os: BifrostOperatingSystem;

  constructor(client: BifrostClient, os: BifrostOperatingSystem) {
    super();

    this.client = client;
    this.os = os;
    this.clickModifiersByKeystroke = {};
  }

  /**
   * Internal: Returns a keystroke notation of the given `event`.
   */
  static getKeystrokes(event: any): string[] {
    const platform = navigator.platform;
    const keystroke: string[] = [];
    const { altKey, ctrlKey, metaKey, shiftKey } = event;

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

    return keystroke;
  }

  getModifiersForEvent<T = any>(event: any): T {
    const keystrokes = ClickModifierKeysManager.getKeystrokes(event);
    const results: any = {};

    for (const keystroke of keystrokes) {
      const clickModifiers = this.clickModifiersByKeystroke[keystroke];
      if (clickModifiers) {
        const sortBySpecificityDesc = (left: ClickModifierKeyObject, right: ClickModifierKeyObject): number => {
          if (left.specificity < right.specificity) {
            return 1;
          }
          if (right.specificity > left.specificity) {
            return -1;
          }
          return 0;
        };
        const element = event.target as Element;
        const foundClickModifiers = clickModifiers
          .filter(({ selector }) => element.matches(`${selector}, ${selector} ${element.nodeName}`))
          .sort(sortBySpecificityDesc);

        if (foundClickModifiers.length > 0) {
          const clickModifier = foundClickModifiers[0].clickModifier;
          results[clickModifier] = true;
        }
      }
    }

    return results;
  }

  /**
   * Loads the given modifier keys if the `client` and `os` match.
   */
  registerModifierKeys({ client, os, modifiers }: ClickModifierKeysDefinition): void {
    const clientMatches = client === this.client || client === ClickModifierKeysManager.WILDCARD;
    const osMatches = os === this.os || os === ClickModifierKeysManager.WILDCARD;

    if (clientMatches && osMatches) {
      this.addClickModifierKeysToLookup(modifiers);
    }
  }

  private addClickModifierKeysToLookup(modifiers: any): void {
    for (const selector of Object.keys(modifiers)) {
      const clickModifierMap = modifiers[selector];
      for (const keystroke of Object.keys(clickModifierMap)) {
        const clickModifier = clickModifierMap[keystroke];

        // TODO: validate selector using clear-cut's `isSelectorValid`
        const specificity = calculateSpecificity(selector);
        const clickModifierKeys: ClickModifierKeyObject = { selector, clickModifier, specificity };

        this.clickModifiersByKeystroke[keystroke] = this.clickModifiersByKeystroke[keystroke] || [];
        this.clickModifiersByKeystroke[keystroke].push(clickModifierKeys);
      }
    }
  }
}
