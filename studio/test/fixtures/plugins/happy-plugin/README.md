# Happy Plugin

A fixture plugin for Bifrost Forge World that registers greeting commands.

## Features

- **Greeting command** — `plugin.happy-plugin.greet` takes a name and returns a personalized greeting.
- **Environment query** — `plugin.happy-plugin.getEnv` returns the plugin's runtime environment for inspection.

## Usage

Open the command palette and run:

```
plugin.happy-plugin.greet <name>
```

Returns: `Hello, <name>!`

## API Reference

| Command                             | Arguments      | Returns             | Description                                     |
| ----------------------------------- | -------------- | ------------------- | ----------------------------------------------- |
| `plugin.happy-plugin.greet`         | `name: string` | `string`            | Returns a greeting for the given name           |
| `plugin.happy-plugin.getEnv`        | —              | `PluginEnvironment` | Returns the plugin's runtime environment        |
| `plugin.happy-plugin.isDeactivated` | —              | `boolean`           | Returns whether the plugin has been deactivated |

## Architecture

The plugin consists of a single `index.js` file that exports an `activate` function.
During activation, the plugin registers three commands through the `api.commands` API.

### Greeting Flow

1. The user (or test harness) invokes `plugin.happy-plugin.greet` with a name argument.
2. The command handler concatenates the greeting template with the provided name.
3. The result string is returned to the caller.

## Configuration

This plugin does not register any settings. It works out of the box.

## Changelog

### 1.0.0

- Initial release
- Added `greet` and `getEnv` commands

---

> **Note:** This plugin is a test fixture. It is not intended for production use.
