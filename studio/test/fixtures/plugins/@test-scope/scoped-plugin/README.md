# @test-scope/scoped-plugin

Test fixture for **scoped npm package name normalization**.

## Purpose

This plugin has a scoped npm name (`@test-scope/scoped-plugin`). During discovery, the Studio normalizes scoped names into safe identifiers using `pluginNameToHostname`:

```
@test-scope/scoped-plugin  →  test-scope--scoped-plugin
```

The original scoped name is preserved in `PluginInfo.packageName` for display purposes.

This fixture verifies that:

- The normalized name (`test-scope--scoped-plugin`) is used for command namespacing, storage paths, and all internal identifiers.
- The original name (`@test-scope/scoped-plugin`) is displayed in the UI via `packageName`.
- Commands are registered under the normalized namespace: `plugin.test-scope--scoped-plugin.ping`.

## Commands

| Command                                 | Expected result  |
| --------------------------------------- | ---------------- |
| `plugin.test-scope--scoped-plugin.ping` | Returns `'pong'` |

## How to test manually

1. Enable the plugin.
2. Run `bifrost.commands.executeCommand('plugin.test-scope--scoped-plugin.ping')` from DevTools.
3. Check the Plugin Info pane — it should show the **Package** field as `@test-scope/scoped-plugin`.

## Permissions

None required.
