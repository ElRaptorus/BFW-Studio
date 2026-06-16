import type { Bifrost } from '#bifrost/Bifrost';

export function initializeKeyBindings(bifrost: Bifrost): void {
  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'macos',
    bindings: {
      body: {
        'cmd-alt-j': 'engine.debugger.workbench.openAndFocusExpressionRunner',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'windows',
    bindings: {
      body: {
        'ctrl-shift-j': 'engine.debugger.workbench.openAndFocusExpressionRunner',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'linux',
    bindings: {
      body: {
        'ctrl-shift-j': 'engine.debugger.workbench.openAndFocusExpressionRunner',
      },
    },
  });
}
