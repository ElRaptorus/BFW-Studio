# sandbox-module-gate

Test fixture for the **Module Gate** — the sandbox layer that controls which Node.js built-in modules a plugin can `require()`.

## Purpose

This plugin declares only the `system-info` permission. The Module Gate maps permissions to allowed modules:

| Permission         | Grants access to                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `filesystem`       | `fs`, `fs/promises`, `path`                                                                    |
| `system-info`      | `os`                                                                                           |
| _(always allowed)_ | `path`, `crypto`, `util`, `buffer`, `stream`, `events`, `string_decoder`, `url`, `querystring` |
| _(always blocked)_ | `http`, `https`, `net`, `dgram`, `tls`, `child_process`, `cluster`, `worker_threads`           |

Because the plugin has `system-info` but **not** `filesystem`, it can `require('os')` and `require('path')` but **not** `require('fs')` or `require('http')`.

## Commands

| Command                                     | Expected result                                               |
| ------------------------------------------- | ------------------------------------------------------------- |
| `plugin.sandbox-module-gate.tryRequireFs`   | Error message (denied — no `filesystem` permission)           |
| `plugin.sandbox-module-gate.tryRequireHttp` | Error message (always blocked)                                |
| `plugin.sandbox-module-gate.tryRequireOs`   | The platform string, e.g. `linux` (allowed via `system-info`) |
| `plugin.sandbox-module-gate.tryRequirePath` | `a/b` (always allowed)                                        |

## How to test manually

1. Enable the plugin and accept permissions.
2. Run each command via the integration test runner or by calling `bifrost.commands.executeCommand('plugin.sandbox-module-gate.tryRequireFs')` from the DevTools console.
3. Verify the returned values match the table above.

## Permissions

- `system-info`
