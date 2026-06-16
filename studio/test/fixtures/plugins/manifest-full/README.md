# manifest-full

Fixture plugin that exercises the **complete set of manifest contribution types**. Every `contributes` section supported by the manifest schema is declared.

## Purpose

Verifies that the `ContributionRegistrar` correctly processes all contribution types from a single manifest: commands, menus, settings, keybindings, icons, panes, and service task types. Also tests lazy activation via `onCommand`.

## Activation

Lazy — activates on `onCommand:manifestFull.greet`. The plugin remains in `pending` status until one of its commands is invoked.

## Manifest contributions

| Type                   | Details                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Commands**           | `manifestFull.greet` (with icon, category), `manifestFull.farewell` (category only)                                         |
| **Menus**              | `manifestFull.greet` added to `std/application/main` in the `tools` group                                                   |
| **Settings**           | `manifestFull.greeting` (string, default: `"Hello from Manifest Full!"`), `manifestFull.enabled` (boolean, default: `true`) |
| **Keybindings**        | `Ctrl+Shift+F11` → `greet` (when: `*`), `Ctrl+Alt+F11` → `farewell` (when: `editorFocused`)                                 |
| **Icons**              | `manifestFull/logo` → `ph-star`                                                                                             |
| **Panes**              | `manifestFull.sidebar` — right area, `property` group, visible when document type is `bpmn`                                 |
| **Service task types** | `manifestFull.emailSender` — label: `"Email Sender (Test)"`                                                                 |

## Registered commands

| Command                 | Behavior                                                   |
| ----------------------- | ---------------------------------------------------------- |
| `manifestFull.greet`    | Opens an info notification, returns `{ greeted: true }`    |
| `manifestFull.farewell` | Opens an info notification, returns `{ farewelled: true }` |

## Console output

Logs `[manifest-full] activated` and `[manifest-full] deactivated` to stdout.
