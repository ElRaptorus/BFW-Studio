# sandbox-crash

Test fixture for **quarantine behaviour**. The plugin activates successfully and registers two commands that deliberately crash or throw when invoked.

## Purpose

This plugin tests the Studio's crash recovery and quarantine system. It does **not** crash at startup — it only crashes when you explicitly invoke a crash command.

The integration tests call `crash` three times in succession, which triggers the `QuarantineManager` to quarantine the plugin (preventing further loads until the user explicitly re-enables it).

## Commands

| Command                              | What it does                                                  |
| ------------------------------------ | ------------------------------------------------------------- |
| `plugin.sandbox-crash.crash`         | Calls `process.exit(1)` — kills the Worker Thread immediately |
| `plugin.sandbox-crash.throwUncaught` | Throws an `Error` — tests uncaught exception handling         |

## How to test manually

1. Enable the plugin. It should activate without errors (Health: **pending** → **loaded**).
2. Open the Command Palette and run **sandbox-crash.crash**.
3. The plugin's Health status should change to **faulted**.
4. Re-enable the plugin and crash it two more times. After the third crash the plugin should be **quarantined**.

## Permissions

None required.
