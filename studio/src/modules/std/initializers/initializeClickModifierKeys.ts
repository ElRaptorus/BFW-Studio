import type { Bifrost } from '#bifrost/Bifrost';

export function initializeClickModifierKeys(bifrost: Bifrost): void {
  bifrost.clickModifierKeys.registerModifierKeys({
    client: '*',
    os: 'macos',
    modifiers: {
      '.kbm-quick-jump': {
        cmd: 'open-in-new-window',
        alt: 'open-in-new-split-editor',
      },
    },
  });
}
