import type { Bifrost } from '#bifrost/Bifrost';

export function initializeKeyBindings(bifrost: Bifrost): void {
  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'macos',
    bindings: {
      body: {
        'cmd-alt-l': 'std.workbench.focusPluginsConsole',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'windows',
    bindings: {
      body: {
        'ctrl-alt-l': 'std.workbench.focusPluginsConsole',
      },
    },
  });

  bifrost.keybindings.registerKeyBindings({
    client: '*',
    os: 'linux',
    bindings: {
      body: {
        'ctrl-alt-l': 'std.workbench.focusPluginsConsole',
      },
    },
  });
}
