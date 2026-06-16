# Settings Plugin

Observes settings changes for testing the plugin settings API.

## How It Works

The Settings Plugin subscribes to changes on a specific setting key using
`api.settings.onDidChange`. Whenever the observed setting is updated,
the plugin stores the new value internally. Tests can then retrieve the
last observed value via a command.

## Commands

| Command                                         | Description                                           |
| ----------------------------------------------- | ----------------------------------------------------- |
| `plugin.settings-plugin.getLastObservedSetting` | Returns the last value observed through `onDidChange` |

## Observed Setting

The plugin watches `test.settingsPluginValue`. When this setting changes
(e.g., from the Settings editor or programmatically via `bifrost.settings.set`),
the plugin captures the new value.

### Example

```javascript
// From the test harness:
bifrost.settings.set('test.settingsPluginValue', 42);

// Then query the plugin:
const observed = await bifrost.commands.executeCommand('plugin.settings-plugin.getLastObservedSetting');
// observed === 42
```

## Version History

| Version | Changes                         |
| ------- | ------------------------------- |
| 1.2.0   | Added `onDidChange` observation |
| 1.1.0   | Initial setting registration    |
| 1.0.0   | Initial release                 |
