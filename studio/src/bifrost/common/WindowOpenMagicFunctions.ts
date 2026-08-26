import type { Bifrost } from '../Bifrost';

type WindowOpenMagicLinkOptions = WindowOpenMagicLinkOptions_Command;

type WindowOpenMagicLinkOptions_Command = {
  type: 'command';
  command: string;
  commandArgs?: any[];
};

// This URL is not real. It is used as a surrogate to detect when in-app hover/help links should be handled by Bifrost instead of a new window.
// We use a UUID for this so that it is highly unlikely that the hostname will be mistaken for anything else.
const WINDOW_OPEN_MAGIC_LINK_PREFIX = 'https://bifrost-10d4dacf-4a55-4c00-9cb0-57fd7676fa45/magic/';

export function initializeBifrostWindowOpenMagic(bifrost: Bifrost): void {
  const originalWindowOpen = window.open;
  (window as any).open = function (...args: any[]) {
    let urlArg = '';
    if (args[0] != null) {
      urlArg = typeof args[0] === 'string' ? args[0] : String(args[0]);
    }
    const magicOptions = getWindowOpenMagicOptions(urlArg);

    if (magicOptions == null) {
      originalWindowOpen.apply(window, args as Parameters<typeof window.open>);
    } else {
      switch (magicOptions.type) {
        case 'command':
          bifrost.commands.executeCommand(magicOptions.command, magicOptions.commandArgs);
          return;
        default:
          throw new Error(`Unexpected type: ${JSON.stringify(magicOptions)}`);
      }
    }
  };
}

/**
 * Returns a URL that, when used with `window.open`, will trigger the given `command`.
 *
 * This is useful for hover widgets that would otherwise call `window.open`.
 *
 * Example:
 *
 *      getWindowOpenMagicCommandUrl('std.editor.gotoSymbolInDocument', [
 *        editorDocumentUri,
 *        element.id,
 *      ])
 */
export function getWindowOpenMagicCommandUrl(command: string, commandArgs?: any[]): string {
  return getWindowOpenMagicUrl({
    type: 'command',
    command,
    commandArgs,
  });
}

export function getWindowOpenMagicUrl(options: WindowOpenMagicLinkOptions): string {
  return WINDOW_OPEN_MAGIC_LINK_PREFIX + encodeURIComponent(JSON.stringify(options));
}

export function getWindowOpenMagicOptions(url: string): WindowOpenMagicLinkOptions | null {
  if (!url.startsWith(WINDOW_OPEN_MAGIC_LINK_PREFIX)) {
    return null;
  }

  return JSON.parse(decodeURIComponent(url.slice(WINDOW_OPEN_MAGIC_LINK_PREFIX.length)));
}
