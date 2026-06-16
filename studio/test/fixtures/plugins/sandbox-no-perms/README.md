# sandbox-no-perms

Test fixture for **permission enforcement** with an empty permission set.

## Purpose

This plugin declares `permissions: []`. Every API call that requires a permission should be denied with a `PermissionDeniedError`. This verifies that the `PermissionGate` correctly blocks unprivileged operations.

## Commands

| Command                                     | What it tests                                                | Expected result                                 |
| ------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `plugin.sandbox-no-perms.tryWorkspace`      | `api.workspace.readFile`                                     | Error: permission denied (needs `filesystem`)   |
| `plugin.sandbox-no-perms.tryBlockedCommand` | `api.commands.executeCommand('git.commit')`                  | Error: permission denied (needs `commands.std`) |
| `plugin.sandbox-no-perms.tryStdCommand`     | `api.commands.executeCommand('std.notifications.show', ...)` | Error: permission denied (needs `commands.std`) |
| `plugin.sandbox-no-perms.trySettingsWrite`  | `api.settings.set('theme', 'dark')`                          | Error: outside plugin namespace                 |
| `plugin.sandbox-no-perms.tryOwnSettings`    | `api.settings.set('plugin.sandbox-no-perms.foo', 'bar')`     | `'ok'` — own namespace is always allowed        |
| `plugin.sandbox-no-perms.tryFileWatcher`    | `api.workspace.onDidChangeFile(...)`                         | Error: permission denied (needs `filesystem`)   |

## How to test manually

1. Enable the plugin (no permission dialog — it requests nothing).
2. Run each command from the DevTools console or integration tests.
3. Verify that only `tryOwnSettings` succeeds; all others return an error message.

## Permissions

None (empty list — that's the point).
