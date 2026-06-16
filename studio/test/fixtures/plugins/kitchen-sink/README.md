# Kitchen Sink Plugin

Exercises **every Plugin API feature** for manual and automated testing.
This plugin is the canonical fixture for verifying that the Studio's plugin
runtime works correctly across all API namespaces.

---

## Table of Contents

1. [Commands](#commands)
2. [Settings](#settings)
3. [Notifications](#notifications)
4. [Dialogs](#dialogs)
5. [Status Bar](#status-bar)
6. [Menu Bar](#menu-bar)
7. [Menus](#menus)
8. [Editors — Dirty State & Save](#editors--dirty-state--save)
9. [Workspace](#workspace)
10. [Diagnostics](#diagnostics)
11. [Pane Visibility](#pane-visibility)
12. [Events — editorFocusChanged](#events--editorfocuschanged)
13. [Lifecycle](#lifecycle)
14. [Cross-Plugin Communication](#cross-plugin-communication)
15. [Testing Notes](#testing-notes)

---

## Commands

### Lifecycle & Introspection

| Command                            | Description                                  |
| ---------------------------------- | -------------------------------------------- |
| `plugin.kitchen-sink.getStatus`    | Returns the plugin's internal status object  |
| `plugin.kitchen-sink.getLifecycle` | Returns an ordered array of lifecycle events |
| `plugin.kitchen-sink.getEnv`       | Returns `PluginEnvironment`                  |

### Settings

| Command                                 | Arguments       | Description                                                    |
| --------------------------------------- | --------------- | -------------------------------------------------------------- |
| `plugin.kitchen-sink.hasSetting`        | `key: string`   | Checks if a setting key exists                                 |
| `plugin.kitchen-sink.getSettingSchema`  | —               | Returns the schema for `plugin.kitchen-sink.kitchenSinkValue`  |
| `plugin.kitchen-sink.getAllSchemas`     | —               | Returns all registered setting schemas                         |
| `plugin.kitchen-sink.getSettingDefault` | —               | Returns the default for `plugin.kitchen-sink.kitchenSinkValue` |
| `plugin.kitchen-sink.getAllDefaults`    | —               | Returns all registered defaults                                |
| `plugin.kitchen-sink.writeSetting`      | `value: string` | Writes to `plugin.kitchen-sink.kitchenSinkValue`               |
| `plugin.kitchen-sink.readSetting`       | —               | Reads `plugin.kitchen-sink.kitchenSinkValue`                   |
| `plugin.kitchen-sink.addToArraySetting` | `item: string`  | Pushes to `plugin.kitchen-sink.kitchenSinkArray`               |
| `plugin.kitchen-sink.removeFromArray`   | `item: string`  | Removes from `plugin.kitchen-sink.kitchenSinkArray`            |
| `plugin.kitchen-sink.readArraySetting`  | —               | Reads `plugin.kitchen-sink.kitchenSinkArray`                   |

### Notifications

| Command                                           | Arguments         | Description                                    |
| ------------------------------------------------- | ----------------- | ---------------------------------------------- |
| `plugin.kitchen-sink.showInfo`                    | `message: string` | Opens an info notification                     |
| `plugin.kitchen-sink.showWarning`                 | `message: string` | Opens a warning notification                   |
| `plugin.kitchen-sink.showError`                   | `message: string` | Opens an error notification                    |
| `plugin.kitchen-sink.updateNotification`          | `content: string` | Updates the last opened notification           |
| `plugin.kitchen-sink.closeNotification`           | —                 | Closes the last opened notification            |
| `plugin.kitchen-sink.showNotificationWithActions` | —                 | Opens notification with Accept/Decline actions |
| `plugin.kitchen-sink.showStickyNotification`      | —                 | Opens a sticky warning notification            |
| `plugin.kitchen-sink.getLastNotificationResponse` | —                 | Returns the last notification action response  |

### Dialogs

| Command                                     | Description                                         |
| ------------------------------------------- | --------------------------------------------------- |
| `plugin.kitchen-sink.showDialog`            | Opens a custom dialog with text input + checkbox    |
| `plugin.kitchen-sink.showPrompt`            | Opens a simple text prompt dialog                   |
| `plugin.kitchen-sink.showDialogNonBlocking` | Opens a dialog without awaiting (for cleanup tests) |

### Status Bar

| Command                                       | Arguments       | Description                                   |
| --------------------------------------------- | --------------- | --------------------------------------------- |
| _(auto-registered on activate)_               | —               | Registers a "Kitchen Sink: Ready" button      |
| `plugin.kitchen-sink.updateStatusBarItem`     | `label: string` | Replaces the status bar item label            |
| `plugin.kitchen-sink.unregisterStatusBarItem` | —               | Removes the status bar item                   |
| `plugin.kitchen-sink.showProgress`            | `label: string` | Shows a progress indicator, stores the handle |
| `plugin.kitchen-sink.updateProgress`          | `label: string` | Updates the active progress label             |
| `plugin.kitchen-sink.doneProgress`            | —               | Completes the active progress indicator       |
| `plugin.kitchen-sink.isStatusBarVisible`      | —               | Returns whether the status bar is visible     |

### Menu Bar

| Command                                | Description                                               |
| -------------------------------------- | --------------------------------------------------------- |
| _(auto-registered on activate)_        | Registers a quick action button in the right area         |
| _(auto-registered on activate)_        | Registers a pane toggle modifier after the plugins toggle |
| `plugin.kitchen-sink.isMenuBarVisible` | Returns whether the menu bar is visible                   |

### Menus

The plugin registers a menu modifier that appends a "Kitchen Sink View Entry"
to the `View` submenu of the application menu.

### Editors — Dirty State & Save

| Command                              | Arguments      | Description                                       |
| ------------------------------------ | -------------- | ------------------------------------------------- |
| `plugin.kitchen-sink.setDirty`       | `uri, isDirty` | Marks a document dirty or clean                   |
| `plugin.kitchen-sink.registerSave`   | `uri`          | Registers an onSaveRequest handler for a URI      |
| `plugin.kitchen-sink.unregisterSave` | —              | Disposes the onSaveRequest handler                |
| `plugin.kitchen-sink.getSaveCount`   | —              | Returns the number of times save delegate invoked |

### Diagnostics

| Command                                         | Arguments            | Description                                     |
| ----------------------------------------------- | -------------------- | ----------------------------------------------- |
| `plugin.kitchen-sink.setDiagnostics`            | `uri?, diagnostics?` | Sets test diagnostics on a URI                  |
| `plugin.kitchen-sink.clearDiagnostics`          | —                    | Clears all diagnostics for this plugin          |
| `plugin.kitchen-sink.getDiagnostics`            | `uri?`               | Returns diagnostics, optionally for a URI       |
| `plugin.kitchen-sink.getDiagnosticCount`        | —                    | Returns aggregate `{ errors, warnings, infos }` |
| `plugin.kitchen-sink.getDiagnosticsChangeCount` | —                    | Returns how often `onDidChange` fired           |

### Workspace

| Command                                      | Arguments           | Description                                              |
| -------------------------------------------- | ------------------- | -------------------------------------------------------- |
| `plugin.kitchen-sink.readProjectFile`        | `uri`               | Reads a text file from a project folder                  |
| `plugin.kitchen-sink.writeStorageFile`       | `filename, content` | Writes a text file to plugin storage                     |
| `plugin.kitchen-sink.readStorageFile`        | `filename`          | Reads a text file from plugin storage                    |
| `plugin.kitchen-sink.writeBinaryStorageFile` | `filename, base64`  | Writes binary data (base64-encoded) to plugin storage    |
| `plugin.kitchen-sink.readBinaryStorageFile`  | `filename`          | Reads binary data from plugin storage, returns base64    |
| `plugin.kitchen-sink.listProjectDir`         | `uri`               | Lists entries in a project folder                        |
| `plugin.kitchen-sink.statFile`               | `uri`               | Returns `{ isDirectory, isFile, exists }` for a URI      |
| `plugin.kitchen-sink.createStorageDir`       | `dirname`           | Creates a subdirectory in plugin storage                 |
| `plugin.kitchen-sink.deleteStorageFile`      | `filename`          | Deletes a file from plugin storage                       |
| `plugin.kitchen-sink.getProjectFolders`      | —                   | Returns the current solution's project folders           |
| `plugin.kitchen-sink.readOutOfScope`         | —                   | Attempts to read `/etc/passwd` (should fail)             |
| `plugin.kitchen-sink.watchStorageDir`        | —                   | Starts watching the plugin storage directory for changes |
| `plugin.kitchen-sink.getWatcherEvents`       | —                   | Returns file change events captured by the watcher       |
| `plugin.kitchen-sink.disposeWatcher`         | —                   | Stops the active file watcher                            |
| `plugin.kitchen-sink.getSolutionChangeCount` | —                   | Returns how often `onDidChangeSolution` fired            |

### Pane Visibility

| Command                              | Arguments         | Description                                   |
| ------------------------------------ | ----------------- | --------------------------------------------- |
| `plugin.kitchen-sink.setPaneVisible` | `paneId, visible` | Calls `api.panes.setVisible(paneId, visible)` |

### Events — editorFocusChanged

| Command                                      | Description                                       |
| -------------------------------------------- | ------------------------------------------------- |
| _(auto-subscribed on activate)_              | Subscribes to `editorFocusChanged`, stores events |
| `plugin.kitchen-sink.getEditorFocusEvents`   | Returns captured editor focus events              |
| `plugin.kitchen-sink.clearEditorFocusEvents` | Clears the captured focus events                  |

### Cross-Plugin

| Command                                 | Arguments            | Description                                       |
| --------------------------------------- | -------------------- | ------------------------------------------------- |
| `plugin.kitchen-sink.tryExecute`        | `commandId, ...args` | Calls `tryToExecuteCommand`                       |
| `plugin.kitchen-sink.checkEnabled`      | `commandId: string`  | Checks `isCommandEnabled`                         |
| `plugin.kitchen-sink.checkRegistered`   | `commandId: string`  | Checks `isRegistered`                             |
| `plugin.kitchen-sink.listCommands`      | —                    | Returns all registered commands                   |
| `plugin.kitchen-sink.executeExternal`   | `commandId, ...args` | Executes another plugin's command                 |
| `plugin.kitchen-sink.searchableCommand` | —                    | A command registered with `visibleInSearch: true` |

---

## Settings

The plugin registers two settings:

```json
{
  "plugin.kitchen-sink.kitchenSinkValue": {
    "type": "string",
    "label": "Kitchen Sink Value",
    "default": ""
  },
  "plugin.kitchen-sink.kitchenSinkArray": {
    "type": "array",
    "label": "Kitchen Sink Array",
    "default": []
  }
}
```

The plugin observes changes to `plugin.kitchen-sink.kitchenSinkValue` via `onDidChange` and
stores the most recently observed value in its internal status object.

---

## Notifications

The notification commands cover the full lifecycle:

1. **Open** — `showInfo`, `showWarning`, or `showError` each return a notification ID
2. **Update** — `updateNotification` modifies the content
3. **Close** — `closeNotification` dismisses it
4. **Actions** — `showNotificationWithActions` creates a notification with Accept/Decline buttons
5. **Sticky** — `showStickyNotification` creates a notification that stays until explicitly closed
6. **Response** — `onResponse` callback fires when the user clicks an action; result available via `getLastNotificationResponse`

---

## Dialogs

- `showDialog` — opens a modal dialog with a text input and a checkbox, returns the dialog result
- `showPrompt` — opens a quick text prompt, returns the entered text or `null`

---

## Workspace

The workspace API provides scoped file system access:

- **Read/Write** — `readProjectFile` / `writeStorageFile` / `readStorageFile` read and write
  text files within allowed scopes (project folders + plugin storage)
- **Binary Read/Write** — `writeBinaryStorageFile` / `readBinaryStorageFile` handle binary
  data as base64, using `writeBinaryFile` / `readBinaryFile` under the hood
- **Directory ops** — `listProjectDir`, `createStorageDir`, `deleteStorageFile`
- **Stat** — `statFile` returns `{ isDirectory, isFile, exists }`
- **Scope enforcement** — `readOutOfScope` attempts to access `/etc/passwd` and
  verifies the bridge rejects access outside project folders and plugin storage
- **File watching** — `watchStorageDir` starts a chokidar-backed watcher with 100ms
  debounce; `getWatcherEvents` retrieves captured events; `disposeWatcher` stops it
- **Solution changes** — `onDidChangeSolution` is subscribed at activation time;
  the internal counter is accessible via `getSolutionChangeCount`

When the plugin is disabled, all active file watchers are automatically disposed.

---

## Diagnostics

The plugin can contribute diagnostics (errors and warnings) to arbitrary URIs.
`onDidChange` is subscribed at activation time; the internal counter is
accessible via `getDiagnosticsChangeCount`.

When the plugin is disabled, all diagnostics contributed by it are automatically
cleared by the bridge.

---

## Pane Visibility

The plugin exercises the pane visibility API:

- **`setPaneVisible`** — calls `api.panes.setVisible(paneId, visible)` to show or hide a pane

When the plugin is disabled, all visibility state set by it is automatically cleared.

---

## Events — editorFocusChanged

The plugin subscribes to `api.events.on('editorFocusChanged', ...)` at activation time.
Each event `{ uri, documentType }` is stored and retrievable via `getEditorFocusEvents`.
This allows integration tests to verify that editor focus changes are forwarded to plugins.

---

## Lifecycle

During `activate`, the plugin records timestamped events:

```
activate:start → [registrations] → activate:end
```

The `getLifecycle` command returns this array so tests can verify execution order.

---

## Cross-Plugin Communication

The Kitchen Sink plugin can call commands registered by _other_ plugins
(e.g., `plugin.happy-plugin.greet`). This verifies that the command bus properly
routes calls across plugin boundaries.

---

## Integration Test Coverage

The Kitchen Sink plugin is exercised by the following test groups in
`plugin-host.test.ts`:

- `kitchen-sink: settings API` — read/write, schemas, defaults, observation
- `kitchen-sink: commands API` — registration, execution, cross-plugin calls
- `kitchen-sink: notifications API` — open, update, close
- `kitchen-sink: notifications with actions` — actions, sticky, onResponse
- `kitchen-sink: dialogs API` — open, cancel, prompt
- `kitchen-sink: diagnostics API` — set, clear, get, getCount, onDidChange, cleanup
- `kitchen-sink: workspace API` — read, write, list, stat, scope denial, watcher, cleanup
- `kitchen-sink: editors dirty state & save lifecycle` — setDirty, onSaveRequest, cleanup
- `kitchen-sink: pane visibility API` — setVisible, toggle cycle, settings-driven visibility, cleanup, editorFocusChanged, manifest visibleWhen
- `kitchen-sink: lifecycle` — activation order, environment

---

_This plugin is a test fixture and is not intended for production use._
