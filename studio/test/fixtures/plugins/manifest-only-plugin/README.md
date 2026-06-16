# manifest-only-plugin

Fixture plugin that tests **manifest-declared contributions with lazy activation**. Contributions (commands, settings, keybindings) are registered declaratively at discovery time; the plugin code only runs when a command is invoked.

## Purpose

Verifies the split between manifest-time registration and runtime activation:

1. At discovery, the `ContributionRegistrar` registers stub commands, settings, and keybindings from the manifest — **without** loading the plugin code.
2. The plugin stays in `pending` status until its activation event fires.
3. When the user invokes `manifestOnly.doThing`, the `ActivationManager` loads the plugin, which replaces the stub command with its real implementation.

This is the primary fixture for testing that manifest contributions are usable (settings appear in the Settings editor, keybindings are active, commands appear in the command palette) before the plugin has activated.

## Activation

Lazy — activates on `onCommand:manifestOnly.doThing`.

## Manifest contributions

| Type            | Details                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| **Commands**    | `manifestOnly.doThing` — title: `"Do The Thing"`, category: `"Manifest Only"` |
| **Settings**    | `manifestOnly.enabled` (boolean, default: `true`)                             |
| **Keybindings** | `Ctrl+Shift+F12` / `Cmd+Shift+F12` → `manifestOnly.doThing` (when: `*`)       |

## Registered commands

| Command                | Behavior                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `manifestOnly.doThing` | Opens an info notification (`"The thing has been done!"`), returns `{ done: true }` |

## Console output

Logs `[manifest-only-plugin] activated` and `[manifest-only-plugin] deactivated` to stdout.
