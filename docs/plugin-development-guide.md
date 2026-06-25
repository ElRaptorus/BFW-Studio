# Evil Studio — Plugin Development Guide

This guide covers everything you need to build, test, and deploy plugins for Evil Studio.

## Getting Started

### Prerequisites

- Node.js 24+
- npm 11+
- Evil Studio (development build or release)

### Create a new plugin

The scaffold generator creates a ready-to-build plugin project:

```bash
# Interactive mode
node tools/create-evil-plugin/src/cli.js my-plugin

# Non-interactive — minimal (no webview)
node tools/create-evil-plugin/src/cli.js my-plugin --minimal

# Non-interactive — with webview support
node tools/create-evil-plugin/src/cli.js my-plugin --webview
```

### Project structure (minimal)

```
my-plugin/
├── package.json       # Plugin metadata + bifrostStudio manifest
├── tsconfig.json      # TypeScript configuration
├── src/
│   └── index.ts       # Plugin entry point (activate/deactivate)
└── dist/
    └── index.js       # Built output (CommonJS)
```

### Project structure (with webview)

```
my-plugin/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts
├── dist/
│   └── index.js
└── webview/
    ├── package.json    # Separate package for React dependencies
    ├── build.mjs       # esbuild config
    ├── tsconfig.json
    ├── src/
    │   ├── index.html  # Webview entry HTML
    │   ├── main.tsx    # React root
    │   ├── App.tsx     # Application component
    │   └── styles.css  # Styling with Studio theme variables
    └── dist/
        ├── index.html
        ├── main.js
        └── styles.css
```

### Build and install

```bash
cd my-plugin
npm install
npm run build

# For webview plugins, also install webview dependencies:
cd webview && npm install && cd ..
npm run build
```

To load the plugin, copy or symlink the plugin directory into the Studio plugins directory. Override the default directory by setting the `BFR_PLUGINS_DIR` environment variable:

```bash
BFR_PLUGINS_DIR=/path/to/my-plugins-folder ./evil-studio
```

---

## Plugin Lifecycle

Every plugin must export two functions from its `main` entry point:

```typescript
import type { StudioPluginApi } from '@evil/bifrost_fw_sdk';

export async function activate(api: StudioPluginApi): Promise<void> {
  // Register commands, panes, editors, settings, etc.
}

export async function deactivate(): Promise<void> {
  // Cleanup resources (timers, event listeners, etc.)
}
```

**When activation happens**: The plugin's code is loaded and `activate()` is called when one of its `activationEvents` fires. For `onStartup` plugins, this happens during Studio initialization. For event-driven activation (e.g., `onCommand:myPlugin.open`), the plugin remains dormant until the trigger event occurs.

**The `api` object**: A `StudioPluginApi` instance providing access to all Studio subsystems. All methods are asynchronous (return `Promise`) because they cross the IPC boundary between the Plugin Host child process and the Studio renderer.

**`api.env`**: A frozen `PluginEnvironment` object with:

| Property | Description |
|----------|-------------|
| `pluginPath` | Absolute path to the plugin's root directory on disk |
| `pluginName` | The plugin's package name (from `package.json`) |
| `storagePath` | A persistent, plugin-specific storage directory |
| `apiVersion` | The Studio Plugin API version the plugin was loaded with |

---

## Sandbox & Permissions

Bifrost Forge World runs every plugin inside a dedicated sandbox. Understanding these constraints helps you choose the right APIs, declare only the permissions you need, and avoid surprises during development and distribution.

### Execution Environment

- Each enabled plugin runs in its own **Worker Thread** inside the Plugin Host child process (not in the main Studio renderer).
- Inside that thread, your code executes in a **SES (Secure ECMAScript) Compartment** with hardened JavaScript intrinsics.
- Plugins have **no** access to: the DOM, Electron APIs, shared memory (`SharedArrayBuffer`), or network APIs (`fetch`, `http`, `net`, and similar).
- All interaction with the Studio — commands, settings, workspace, webviews, dialogs — flows through **serializable IPC messages** on the `StudioPluginApi` bridge. Treat the API as your only supported integration surface.

Use `api.workspace` for file I/O in project folders instead of raw `fs` when possible; it respects the same scoping rules and continues to work even if you do not bundle Node built-ins.

### Module Restrictions

`require()` inside the sandbox is replaced by a permission-aware **Module Gate**. Attempting to load a blocked module throws; loading a gated module without the matching permission throws `PermissionDeniedModuleError`.

| Category | Modules | Requirement |
|----------|---------|-------------|
| **Always available** | `path`, `url`, `util`, `events`, `stream`, `buffer`, `crypto`, `querystring`, `string_decoder`, `assert`, `zlib` | None |
| **Filesystem** | `fs`, `fs/promises` | `filesystem` permission |
| **System info** | `os` (restricted export: only `platform`, `arch`, `tmpdir`, `EOL`) | `system-info` permission |
| **Always blocked** | `http`, `https`, `net`, `dgram`, `dns`, `tls`, `child_process`, `cluster`, `worker_threads`, `v8`, `vm`, `perf_hooks` | Cannot be granted |
| **Native addons** | Any module resolving to a `.node` binary | `native` permission (loads **outside** the SES compartment — use only when unavoidable) |

npm packages resolved from your plugin directory are allowed if their dependency tree does not pull in blocked built-ins. Prefer pure-JavaScript dependencies; packages that patch prototypes or rely on `vm` / `worker_threads` often fail under SES `lockdown()`.

### Permission Types

Declare every permission your plugin needs in `package.json` (see [Declaring Permissions](#declaring-permissions)). Undeclared capabilities are denied at runtime. Request the minimum set — users review permissions before first enable.

| Permission | What it grants |
|------------|----------------|
| `filesystem` | Read and write files in solution project folders and plugin storage; register file watchers via `api.workspace` |
| `commands.std` | Execute standard workbench, editor, and UI commands in the `std.*` namespace |
| `commands.bpmn` | Execute BPMN editor, diff, and linter commands in the `bpmn.*` namespace |
| `commands.dmn` | Execute DMN editor and diff commands in the `dmn.*` namespace |
| `bpmn` | Read BPMN elements, subscribe to selection/change events, place overlays (badge, icon, action, status) |
| `bpmn.modelling` | All of `bpmn` + modify the BPMN model (updateProperties, removeElement, appendElement, createConnection, moveElement) + contribute palette/context pad entries |
| `bpmn.renderer` | All of `bpmn.modelling` + inject diagram-js modules directly into the renderer process via `bpmnModules` manifest entries |
| `renderer-modules` | _(deprecated — use `bpmn.renderer` instead)_ Legacy alias for renderer module injection |
| `native` | Load compiled native `.node` modules (bypasses the SES sandbox entirely — high trust) |
| `system-info` | Read basic OS information (`platform`, `arch`) through the restricted `os` module |

Your plugin's own commands (`plugin.<pluginName>.*`) are always executable by your plugin without extra permissions.

### Hard-Denied Commands

Some command groups are **unconditionally blocked** for plugins. No permission can override this — not even if you could otherwise run a related `std.*` command.

| Prefix | Reason |
|--------|--------|
| `engine.*` | Engine connectivity and runtime operations |
| `git.*` | Version control |
| `plugins.*` | Plugin management (install, enable, host console, etc.) |
| `dev.*` | Developer tools |
| `std.solution.*` | Solution and project management |

If `api.commands.executeCommand()` targets a hard-denied ID, the bridge throws `CommandBlockedError`. Design your plugin to use supported APIs (`api.workspace`, `api.dialogs`, your own namespaced commands) instead of reaching for internal Studio commands.

### Settings Namespace Isolation

Plugins may **read** any setting key. **Writes** and **registration** are restricted to your plugin namespace:

- Allowed keys: `plugin.<pluginName>.*` (where `<pluginName>` is the `name` field from `package.json`)
- Manifest `contributes.settings` keys are auto-prefixed when registered; use short local keys in the manifest (e.g. `enabled`) and they become `plugin.my-plugin.enabled`

The following throw `PermissionDeniedError` if the key is outside your namespace:

- `api.settings.set()`
- `api.settings.add()`
- `api.settings.removeValue()`
- `api.settings.register()` (every descriptor key must start with `plugin.<pluginName>.`)

### Quarantine

Crash isolation protects the Studio from repeatedly failing plugins:

- If a plugin **crashes 3 times within 60 seconds**, it is automatically **quarantined**.
- Quarantined plugins are not loaded on startup until a user explicitly trusts them again.
- Users restore a plugin via **Trust & Re-enable** in the Plugin Viewer wrench (context) menu.

While quarantined, the plugin remains listed but cannot activate. Fix the underlying error, then ask users to re-enable after review.

### Permission Review Dialog

When a plugin that declares permissions is enabled, the Studio shows a **permission review dialog** listing every permission declared in the manifest. Users can approve or cancel enablement. The dialog fires on all activation paths: eager startup, lazy activation, reload/re-enable, and quarantine recovery.

- **Trust permanently**: The dialog includes a "Trust this plugin permanently" checkbox. When checked, the plugin's approved permission set is remembered and the dialog is suppressed on future loads — unless the plugin's declared permissions change between versions, in which case the dialog re-appears showing added/removed permissions.
- **Without trust**: If the user approves without checking "Trust permanently", the dialog will appear again on every reload, re-enable, or restart.
- **Zero-permission plugins**: Plugins that declare no permissions skip the dialog entirely.
- **Automated testing**: Set `BFR_SKIP_PERMISSION_DIALOG=1` in the environment to bypass the dialog (intended for CI and local integration tests only).

### Declaring Permissions

Add a `permissions` array to the `bifrostStudio` section of `package.json`:

```json
{
  "name": "my-plugin",
  "main": "dist/index.js",
  "bifrostStudio": {
    "apiVersion": "1.0.0",
    "displayName": "My Plugin",
    "activationEvents": ["onStartup"],
    "permissions": ["filesystem", "commands.std"],
    "contributes": {
      "commands": []
    }
  }
}
```

Only list permissions you actually use. Extra permissions erode user trust and complicate security review. If activation fails with permission errors, check the Plugin Host Console for `PermissionDeniedError`, `PermissionDeniedModuleError`, or `CommandBlockedError` messages — they name the missing capability.

---

## Manifest Reference

The `bifrostStudio` field in `package.json` declares the plugin's metadata and contributions:

```json
{
  "bifrostStudio": {
    "apiVersion": "1.0.0",
    "displayName": "My Plugin",
    "description": "Does useful things",
    "icon": "ph ph-puzzle-piece",
    "activationEvents": ["onStartup"],
    "contributes": {
      "commands": [...],
      "menus": {...},
      "settings": [...],
      "keybindings": [...],
      "icons": {...},
      "panes": [...],
      "serviceTaskTypes": [...]
    }
  }
}
```

### `apiVersion` (required)

Semver version of the Studio Plugin API this plugin targets. Must be compatible with the running Studio version. Incompatible plugins are rejected before code loading.

### `activationEvents`

Array of events that trigger plugin activation:

| Event | Description |
|-------|-------------|
| `"onStartup"` | Activate when the Studio starts |
| `"*"` | Equivalent to `"onStartup"` |
| `"onCommand:<commandId>"` | Activate when the specified command is first invoked |
| `"onDocumentType:<typeId>"` | Activate when a document of the specified type is opened |
| `"onUri:<pattern>"` | Activate when a document matching the URI pattern is opened |
| `"onSetting:<key>"` | Activate when the specified setting is accessed |

### `contributes.commands`

```json
{
  "commands": [
    { "id": "hello", "title": "My Plugin: Hello", "icon": "ph ph-hand-waving", "category": "My Plugin" }
  ]
}
```

Command IDs are auto-namespaced to `plugin.<pluginName>.<id>`. The manifest creates stub commands that are replaced by the real handler when `activate()` calls `api.commands.register()`.

### `contributes.menus`

```json
{
  "menus": {
    "editor/context": [
      { "command": "plugin.my-plugin.hello", "group": "navigation", "when": "editorFocused" }
    ]
  }
}
```

### `contributes.settings`

```json
{
  "settings": [
    { "key": "myPlugin.enabled", "type": "boolean", "default": true, "description": "Enable the plugin", "category": "My Plugin" }
  ]
}
```

### `contributes.keybindings`

```json
{
  "keybindings": [
    { "command": "plugin.my-plugin.hello", "key": "Ctrl+Shift+H", "mac": "Cmd+Shift+H", "when": "*" }
  ]
}
```

`when` conditions: `"*"` (always), `"editorFocused"` (any editor), `"editorFocused:<typeId>"` (specific editor type).

### `contributes.panes`

```json
{
  "panes": [
    { "id": "sidebar", "title": "My Pane", "area": "right", "groupId": "property", "icon": "ph ph-info" }
  ]
}
```

The manifest creates a placeholder pane. The actual webview is initialized in `activate()` via `api.panes.registerWebviewPane()`.

### `contributes.paneToggles`

```json
{
  "paneToggles": [
    {
      "id": "my-sidebar",
      "icon": "ph-flask",
      "tooltip": "My Sidebar",
      "paneAreaId": "left",
      "paneId": "my-sidebar-pane",
      "insertAfter": "pane/left/plugins"
    }
  ]
}
```

Declares a pane toggle button in the menu bar. The button appears without loading the plugin's code (lazy loading compatible). `insertAfter` and `insertBefore` control positioning relative to existing menu bar items.

### `contributes.serviceTaskTypes`

```json
{
  "serviceTaskTypes": [
    { "implementation": "MyCustomTask", "label": "My Custom Task" }
  ]
}
```

### `contributes.themes`

```json
{
  "themes": [
    {
      "id": "my-dark-theme",
      "label": "My Dark Theme",
      "type": "dark",
      "tokens": {
        "theme-background": "#1a1a2e",
        "theme-foreground": "#e0e0e0",
        "theme-primary": "#00d4ff"
      }
    }
  ]
}
```

Themes registered via manifest are available immediately at plugin discovery time (before activation). Token keys may omit the `--` prefix — the bridge auto-prepends it. See also [`api.themes`](#apithemes) for runtime registration.

### `contributes.bpmnPalette`

Declares palette entries. Requires `bpmn.modelling` permission.

```json
{
  "bpmnPalette": [
    { "id": "my-tool", "icon": "ph-light ph-wrench", "title": "My Tool", "command": "myCommand" }
  ]
}
```

### `contributes.bpmnContextPad`

Declares context pad entries. Requires `bpmn.modelling` permission.

```json
{
  "bpmnContextPad": [
    { "id": "my-action", "icon": "ph-light ph-info", "title": "Inspect", "command": "inspectCmd", "elementTypes": ["bpmn:Task"] }
  ]
}
```

The `command` handler receives `{ elementId, elementType }` as argument. Use `elementTypes` to restrict which BPMN element types show the entry. Dynamic filtering is also possible via `api.bpmn.updateContextPadEntry()` at runtime.

### `contributes.bpmnModules`

Declares diagram-js modules injected into the renderer. Requires `bpmn.renderer` permission.

```json
{
  "bpmnModules": [
    { "entry": "renderer/my-module.js", "description": "Custom behavior" }
  ]
}
```

See [Renderer module injection](#renderer-module-injection-advanced) for the module authoring pattern.

---

## API Reference

### `api.commands`

| Method | Description |
|--------|-------------|
| `register(id, callback, options?)` | Register a command. `options.visibleInSearch` (default `false`) controls palette visibility; `options.description` sets the palette label |
| `executeCommand(id, args?)` | Execute a command by full ID |
| `tryToExecuteCommand(id, args?)` | Execute, returning `SerializedCommandResult` instead of throwing |
| `isCommandEnabled(id, args?)` | Check if a command is enabled |
| `isRegistered(commandName)` | Check if a command exists |
| `getCommands()` | List all registered commands |

`PluginCommandOptions` fields:

| Field | Default | Purpose |
|-------|---------|---------|
| `visibleInSearch` | `false` | When `true`, the command appears in the command search palette |
| `description` | `undefined` | Palette label (or array of search aliases); used when `visibleInSearch` is `true` |

Example:

```typescript
await api.commands.register('hello', () => {
  api.notifications.open({ type: 'info', content: 'Hello!' });
}, { visibleInSearch: true, description: 'My Plugin: Hello' });
```

### `api.notifications`

| Method | Description |
|--------|-------------|
| `open(options)` | Show a toast notification. Returns a notification ID. |
| `close(notificationId)` | Dismiss a notification |
| `update(notificationId, { content? })` | Update notification content |
| `onResponse(notificationId, callback)` | Register a callback for when the user clicks an action button |

`open` options:

```typescript
{
  type: 'info' | 'warning' | 'error';
  content: string;
  origin?: string;         // Defaults to the plugin name
  sticky?: boolean;        // If true, notification stays until dismissed
  actions?: Array<{
    action: string;        // Action identifier returned in callback
    label: string;         // Button label
    default?: boolean;     // Whether this is the default action
  }>;
}
```

To handle action clicks, register a separate response callback:

```typescript
const id = await api.notifications.open({
  type: 'info',
  content: 'Create .gitignore?',
  actions: [
    { action: 'create', label: 'Create', default: true },
    { action: 'dismiss', label: 'No' },
  ],
});
api.notifications.onResponse(id, (response) => {
  if (response.action === 'create') { /* ... */ }
});
```

### `api.settings`

| Method | Description |
|--------|-------------|
| `register(descriptors)` | Register setting descriptors (key → `SettingDescriptor`) |
| `has(key)` | Check if a setting exists |
| `get<T>(key)` | Read the current value |
| `getSchema(key)` | Get the schema for a setting |
| `getSchemas()` | Get all schemas |
| `getDefault<T>(key)` | Read the default value |
| `getDefaults()` | Get all defaults |
| `set(key, value)` | Write a value |
| `add(key, value)` | Append to an array setting |
| `removeValue(key, value)` | Remove from an array setting |
| `onDidChange(key, callback)` | Subscribe to changes |

### `api.editors`

| Method | Description |
|--------|-------------|
| `registerWebviewDocumentType(options)` | Register a webview-backed editor document type |
| `openDocument(uri)` | Open a document by URI |
| `getFocusedDocumentUri()` | Get the URI of the currently focused editor document (or `null`) |
| `setDirty(uri, isDirty)` | Mark an open document as dirty (has unsaved changes) or clean |
| `onSaveRequest(uri, callback)` | Register a save handler invoked on Ctrl+S / Cmd+S; returns `{ dispose }` |

`registerWebviewDocumentType` options:

```typescript
{
  id: string;              // Document type ID (auto-namespaced)
  displayName: string;     // Shown in the editor tab
  icon: string;            // Icon class
  uriPattern: string;      // Regex matching document URIs
  webviewOptions: {
    entryPoint: string;    // Relative path to HTML entry
    localResourceRoots?: string[];
  };
  onDidOpen?: (iframeId: string, uri: string) => void;
}
```

### `api.panes`

| Method | Description |
|--------|-------------|
| `registerWebviewPane(options)` | Register a webview-backed pane |
| `setVisible(paneId, visible)` | Show or hide a pane (sole runtime visibility control) |

`registerWebviewPane` options:

```typescript
{
  id: string;
  title: string;
  area: 'left' | 'bottom' | 'right';
  groupId?: string;
  icon?: string;
  webviewOptions: { entryPoint: string; localResourceRoots?: string[] };
}
```

**Visibility control**: Panes are visible by default. Call `setVisible(paneId, false)` to hide a pane and `setVisible(paneId, true)` to show it again. This is the sole runtime mechanism — the state persists until changed by another `setVisible` call or plugin disable.

To react to editor focus changes (e.g., show a pane only for certain document types), subscribe to `api.events.on('editorFocusChanged', ...)` and call `setVisible` accordingly.

### `api.webviews`

| Method | Description |
|--------|-------------|
| `createPanel(options)` | Create a standalone webview panel; returns an iframe ID |
| `postMessage(iframeId, data)` | Send data to a webview iframe |
| `onMessage(iframeId, callback)` | Listen for messages from a webview; returns a disposer function |
| `dispose(iframeId)` | Dispose a webview panel |

### `api.statusBar`

| Method | Description |
|--------|-------------|
| `registerStatusBarItem(area, id, items, priority?)` | Register one or more status bar items in `'left'`, `'center'`, or `'right'` area; optional `priority` controls ordering |
| `updateStatusBarItem(id, items)` | Replace the items for a previously registered status bar item |
| `unregisterStatusBarItem(id)` | Remove a registered status bar item |
| `showProgress(label)` | Show a progress indicator in the status bar; returns a `PluginProgressHandle` |
| `isVisible()` | Returns `true` if the status bar is currently visible |

**`PluginProgressHandle`**:

| Method | Description |
|--------|-------------|
| `update(label)` | Change the progress indicator label |
| `done()` | Complete and remove the progress indicator |

### `api.menuBar`

| Method | Description |
|--------|-------------|
| `registerMenuBarItem(area, items)` | Register items in the `'left'`, `'center'`, or `'right'` area of the menu bar |
| `registerMenuBarItemModifier(config)` | Insert items relative to an existing menu bar item |
| `isVisible()` | Returns `true` if the menu bar is currently visible |

**`registerMenuBarItemModifier` config**:

```typescript
{
  insertAfter?: string;   // ID of existing item to insert after
  insertBefore?: string;  // ID of existing item to insert before
  items: MenuBarItem[];   // Items to insert
}
```

### `api.menus`

| Method | Description |
|--------|-------------|
| `registerMenuModifier(menuId, config)` | Inject menu items into an existing menu or submenu |

**`registerMenuModifier` config**:

```typescript
{
  items: MenuItem[];
  position?: {
    type: 'append' | 'prepend' | 'appendToSubmenu' | 'prependToSubmenu' | 'insertAfter' | 'insertBefore';
    submenuId?: string;  // Required for appendToSubmenu / prependToSubmenu
    id?: string;         // Required for insertAfter / insertBefore
  };
}
```

### `api.events`

| Method | Description |
|--------|-------------|
| `on(eventName, callback)` | Subscribe to a Studio event |
| `off(eventName, callback)` | Unsubscribe (same reference as passed to `on`) |

Available events:

| Event | Payload | When fired |
|-------|---------|------------|
| `editorFocusChanged` | `{ uri, documentType }` | The active editor tab changes |
| `settingChanged` | `{ key, value }` | A setting value changes |
| `themeChanged` | `{ themeId }` | The Studio theme changes |
| `solutionChanged` | `{ projectFolders }` | The open solution changes |

### `api.diagnostics`

| Method | Description |
|--------|-------------|
| `set(uri, diagnostics)` | Set diagnostics for a URI (replaces previous entries for that URI) |
| `clear()` | Clear all diagnostics owned by this plugin |
| `get(uri?)` | Get diagnostics — for a specific URI if provided, or all URIs if omitted |
| `getCount()` | Get total diagnostic count across all URIs and owners (`{ errors, warnings, infos }`) |
| `onDidChange(callback)` | Subscribe to diagnostic changes (from any owner) |

Each diagnostic is `{ severity: 'error' | 'warning' | 'info', message: string }`. The `source` field is automatically set to the plugin name. Diagnostics appear in the status bar problems count.

### `api.dialogs`

| Method | Description |
|--------|-------------|
| `open(options)` | Open a custom dialog and await the result |
| `prompt(title, placeholder?)` | Open a text input prompt |
| `showOpenFile(options?)` | Open the native file picker (returns selected paths or `null`) |
| `showOpenDirectory()` | Open the native directory picker |
| `showSaveFile(options?)` | Open the native save-file dialog |

`open` options:

```typescript
{
  title: string;
  content: PluginDialogContentItem[];   // Form fields (text_input, select, checkbox, etc.)
  actions?: PluginDialogAction[];       // Dialog buttons
  size?: { width?: number; height?: number };
}
```

Returns `PluginDialogResult`:

```typescript
{
  wasCancelled: boolean;
  formData?: Record<string, unknown>;   // Key-value pairs from content items
  response?: string;                    // The action button that was clicked
}
```

If a dialog is open when the plugin is disabled, it is automatically force-closed.

### `api.workspace`

| Method | Description |
|--------|-------------|
| `readFile(uri)` | Read a file as UTF-8 string |
| `readBinaryFile(uri)` | Read a file as `Uint8Array` (binary) |
| `writeFile(uri, content)` | Write text content to a file |
| `writeBinaryFile(uri, content)` | Write binary content (`Uint8Array`) to a file |
| `listDirectory(uri)` | List directory entries (returns `{ name, uri, type }[]`) |
| `stat(uri)` | Get file metadata (`{ isDirectory, isFile, exists }`) |
| `deleteFile(uri)` | Delete a file |
| `createDirectory(uri)` | Create a directory (recursively) |
| `getProjectFolders()` | Get the current solution's project folder paths (`{ uri, name }[]`) |
| `onDidChangeFile(uri, callback)` | Watch a file or directory for changes (returns `{ dispose }`) |
| `onDidChangeSolution(callback)` | Subscribe to solution/project changes (returns `{ dispose }`) |

**Scoping**: File operations are restricted to the current solution's project folders and the plugin's storage directory (`api.env.storagePath`). Attempting to access paths outside these boundaries throws an error. Binary data is base64-encoded for IPC transport between child process and renderer.

### `api.views`

| Method | Description |
|--------|-------------|
| `registerTreeView(options)` | Register a custom tree view pane |
| `updateTreeData(viewId, items)` | Push new tree data to a registered view |

`registerTreeView` options:

```typescript
{
  id: string;           // Auto-namespaced to plugin.<name>.<id>
  title: string;        // Pane tab header title
  area: 'left' | 'right' | 'bottom';
  groupId?: string;     // Panes in the same group share a tab bar
  icon?: string;        // Icon class for the tab (e.g. "ph-tree-structure")
}
```

Tree data items (`PluginTreeItem`):

```typescript
{
  id: string;                    // Stable identifier for reconciliation
  type: 'directory' | 'file' | 'section' | 'property';
  label: string;
  sublabel?: string;             // Muted text after the label
  icon?: string;
  expanded?: boolean;
  children?: PluginTreeItem[];   // Nested items (makes item expandable)
  command?: string;              // Command ID to execute on click (auto-namespaced)
  badges?: PluginTreeBadge[];
  contextMenuId?: string;
  metadata?: unknown;            // Forwarded to command handler on click
}
```

The data model is push-based: call `updateTreeData` with the full item hierarchy whenever the tree content changes. The bridge renders it using the SDK's `Tree` component.

### `api.themes`

| Method | Description |
|--------|-------------|
| `register(definition)` | Register a custom theme at runtime |
| `unregister(themeId)` | Remove a previously registered theme |
| `getActiveTheme()` | Get the ID of the currently active theme |

`register` definition:

```typescript
{
  id: string;                      // Auto-namespaced to plugin.<name>.<id>
  label: string;                   // Human-readable name in Settings dropdown
  type: 'dark' | 'light';         // Determines fallback on removal
  tokens: Record<string, string>;  // CSS custom property overrides
}
```

Token keys may omit the `--` prefix (e.g., `theme-background` → `--theme-background`). Only CSS custom property overrides are allowed — no selectors or arbitrary CSS.

When a plugin theme is removed while active, the Studio falls back to **Bifrost Night** (dark themes) or **Bifrost Day** (light themes).

Themes can also be declared in the manifest via `contributes.themes` for availability before plugin activation.

### Dirty State & Save Lifecycle

For plugins that register webview-backed editor document types, the `api.editors` dirty state and save methods enable full save integration:

1. **Mark dirty**: Call `api.editors.setDirty(uri, true)` when the user edits content. The tab shows a dot indicator.
2. **Register save handler**: Call `api.editors.onSaveRequest(uri, callback)` to handle Ctrl+S / Cmd+S. The callback should persist data and resolve. On success, the dirty state is automatically cleared.
3. **Mark clean**: Call `api.editors.setDirty(uri, false)` to manually clear the dirty state (e.g., after an undo-all).

When a dirty tab is closed, the Studio shows a "Save before closing?" dialog. If a save handler is registered, the "Save and close" option invokes it.

All registrations are automatically cleaned up when the plugin is disabled or uninstalled.

### Cross-Window Behavior

Each Studio window runs its own Plugin Host process. When plugins are installed, uninstalled, enabled, or disabled in one window, all other windows automatically refresh their plugin state within 500ms.

Plugin registrations (commands, status bar items, menu bar items, save handlers, etc.) are local to the window that loaded the plugin. There is no cross-window state sharing for plugin runtime data.

---

## BPMN Integration

Plugins can read, modify, and enrich BPMN diagrams through the `api.bpmn` namespace. Capabilities are gated by a tiered permission model.

### Permission requirements

| API surface | Required permission |
|-------------|---------------------|
| `api.bpmn.getElements()`, `api.bpmn.getElement()`, `api.bpmn.getXml()`, `api.bpmn.getFocusedDocumentUri()`, `api.bpmn.onElementSelected()`, `api.bpmn.setOverlays()`, `api.bpmn.registerOverlayFactory()`, `api.bpmn.requestOverlayRefresh()` | `bpmn` |
| `api.bpmn.modeling.*`, `api.bpmn.registerPaletteEntry()`, `api.bpmn.registerContextPadEntry()`, `api.bpmn.updateContextPadEntry()` | `bpmn.modelling` |
| `api.bpmn.postToRendererModule()`, `api.bpmn.onRendererModuleMessage()`, manifest `bpmnModules` | `bpmn.renderer` |

### Getting the active document

Many BPMN API calls require a document URI. Use `getFocusedDocumentUri()` to obtain the currently focused BPMN editor:

```javascript
const uri = await api.bpmn.getFocusedDocumentUri();
if (!uri) return; // no BPMN editor is focused

const elements = await api.bpmn.getElements(uri);
```

For commands triggered by context pad entries, the URI is typically already known to the plugin (stored during an earlier subscription). For palette commands, always use `getFocusedDocumentUri()`.

### Overlays

Place badges or icons on BPMN elements:

```javascript
// Non-interactive badge (requires 'bpmn' permission)
await api.bpmn.setOverlays('file:///my.bpmn', 'StartEvent_1', [
  { type: 'badge', position: 'top-right', text: '!', tooltip: 'Warning', style: 'warning' }
]);

// Interactive icon with command (requires 'bpmn' permission)
await api.bpmn.setOverlays('file:///my.bpmn', 'Task_1', [
  { type: 'icon', position: 'bottom-left', icon: 'ph-light ph-info',
    onClickCommand: 'myPlugin.showInfo', onClickCommandArgs: ['Task_1'] }
]);
```

For dynamic overlays, use overlay factories:

```javascript
await api.bpmn.registerOverlayFactory({
  id: 'my-badge',
  type: 'status',
  position: 'bottom-right',
  elementTypes: ['bpmn:Task', 'bpmn:ServiceTask'],
  factory: (context) => ({ icon: 'ph-light ph-clock', text: 'pending', style: 'neutral' })
});
```

Call `api.bpmn.requestOverlayRefresh()` when your plugin's internal state changes to force re-evaluation.

### Palette & context pad contributions

**Manifest (static):**

```json
{
  "contributes": {
    "bpmnPalette": [{ "id": "my-tool", "icon": "ph-light ph-wrench", "title": "My Tool", "command": "myCmd" }],
    "bpmnContextPad": [{ "id": "my-action", "icon": "ph-light ph-info", "title": "Inspect", "command": "inspectCmd", "elementTypes": ["bpmn:Task"] }]
  }
}
```

**Runtime (dynamic):**

```javascript
await api.bpmn.registerContextPadEntry({
  id: 'conditional-action', icon: 'ph-light ph-flag', title: 'Flag',
  command: 'myPlugin.flagElement', elementTypes: ['bpmn:Task'], elementIds: []
});
```

### Context pad command arguments

When a context pad entry triggers a command, the handler receives a single argument object (not a bare string):

```javascript
// The command is invoked with { elementId, elementType }
api.commands.register('myPlugin.inspect', async (info) => {
  const elementId = info?.elementId;   // e.g. "Task_1"
  const elementType = info?.elementType; // e.g. "bpmn:ServiceTask"
  // ... do something with the element
});
```

This applies to both manifest-declared and runtime-registered context pad entries.

### Context pad dynamic filtering

Since the plugin sandbox is asynchronous but `getContextPadEntries()` is synchronous, use the `elementIds` allowlist pattern:

```javascript
// Start hidden (elementIds: [])
await api.bpmn.registerContextPadEntry({
  id: 'my-entry', elementTypes: ['bpmn:Task'], elementIds: [], /* ... */
});

// React to element changes and compute qualifying IDs
await api.bpmn.onElementsChanged((event) => {
  const qualifying = event.elements.filter(el => shouldShow(el)).map(el => el.id);
  api.bpmn.updateContextPadEntry('my-entry', { elementIds: qualifying });
});

// Show on ALL matching types: set elementIds to null
await api.bpmn.updateContextPadEntry('my-entry', { elementIds: null });
```

### Modeling API

All operations are undoable (Ctrl+Z) and require `bpmn.modelling`:

```javascript
const uri = 'file:///my.bpmn';
await api.bpmn.modeling.updateProperties(uri, 'Task_1', { name: 'New Name' });
await api.bpmn.modeling.appendElement(uri, 'Task_1', { type: 'bpmn:EndEvent', name: 'Done' });
await api.bpmn.modeling.removeElement(uri, 'Task_1');
await api.bpmn.modeling.createConnection(uri, 'Gateway_1', 'Task_2');
await api.bpmn.modeling.moveElement(uri, 'Task_1', { x: 50, y: 0 });
```

### Renderer module injection (advanced)

For full diagram-js access (custom renderers, token simulators), declare `bpmnModules` and request `bpmn.renderer`:

```json
{
  "permissions": ["bpmn.renderer"],
  "contributes": {
    "bpmnModules": [{ "entry": "renderer/my-module.js", "description": "Custom behavior" }]
  }
}
```

The renderer module is a standard diagram-js module with `pluginChannel` DI:

```javascript
function MyService(eventBus, canvas, pluginChannel) {
  eventBus.on('element.hover', function(event) {
    pluginChannel.postMessage({ type: 'hovered', elementId: event.element.id });
  });
  pluginChannel.onMessage(function(data) { /* handle host messages */ });
}
MyService.$inject = ['eventBus', 'canvas', 'pluginChannel'];
module.exports = { __init__: ['myService'], myService: ['type', MyService] };
```

**Multi-plugin coexistence**: Multiple plugins can each declare `bpmnModules` and all run simultaneously. The Studio automatically namespaces each plugin's `pluginChannel` in the DI container so they never interfere with each other. Always use `'pluginChannel'` in your `$inject` array — never use internal prefixed names.

**Module reloading**: When a plugin with renderer modules is disabled or re-enabled, all open BPMN editors are automatically closed and reopened so the modeler picks up the updated module set. The `require` cache is evicted before loading, so code changes take effect immediately on re-enable.

Host-side communication:

```javascript
await api.bpmn.onRendererModuleMessage((data) => { /* handle renderer messages */ });
await api.bpmn.postToRendererModule({ type: 'configure', color: 'red' });
```

### Security considerations

- Renderer modules run in the same V8 isolate as the Studio — do NOT access `window.bifrost`
- `onClickCommand` must reference your own plugin's commands (cross-plugin triggers rejected)
- Overlay types are limited to `badge`, `icon`, `action`, `status` — no arbitrary HTML injection
- Module crashes are caught; the plugin is deactivated with an error notification

---

## Webview Development

Webview content runs inside a sandboxed iframe with no Node.js or Electron access. Communication with the Plugin Host goes through a message bridge.

### Bridge script

Every webview HTML must include the bridge script:

```html
<script src="/studio-bridge.js"></script>
```

This injects `window.acquireStudioApi()` which returns a `StudioWebviewApi` object:

```typescript
const api = window.acquireStudioApi!();

// Send a message to the Plugin Host
api.postMessage({ type: 'ready' });

// Receive messages from the Plugin Host
api.onMessage((data) => {
  console.log('Received:', data);
});

// Persist state across iframe reloads
api.setState({ counter: 42 });
const saved = api.getState(); // { counter: 42 }

// Read the current theme
const theme = api.getThemeType(); // "dark" or "light"
```

### Theming

Studio injects CSS custom properties into the iframe matching the current theme. Use them for consistent styling:

```css
body {
  color: var(--studio-color-text, #ccc);
  background: var(--studio-color-background, #1e1e1e);
  font-family: var(--studio-font-family, sans-serif);
  font-size: var(--studio-font-size, 13px);
}
```

Theme changes are applied automatically — the bridge script updates CSS variables when the theme switches.

### Messaging patterns

**Plugin Host → Webview** (in `src/index.ts`):

```typescript
api.webviews.postMessage(iframeId, { type: 'update', data: { ... } });
```

**Webview → Plugin Host** (in `webview/src/App.tsx`):

```typescript
const studioApi = window.acquireStudioApi!();
studioApi.postMessage({ type: 'user-action', payload: { ... } });
```

**Bidirectional handshake** — a common pattern:

1. Webview sends `{ type: 'ready' }` on mount
2. Plugin Host responds with `{ type: 'init', payload: { ... } }`
3. Subsequent messages follow request/response or event patterns

---

## Development Workflow

### Plugin directory override

Set `BFR_PLUGINS_DIR` to point at a directory containing your plugin(s):

```bash
BFR_PLUGINS_DIR=/path/to/my-plugins ./evil-studio
```

### Per-plugin enable/disable

In the Studio, open the Plugins pane (left sidebar). Right-click a plugin to enable, disable, or uninstall it. Disabled plugins are tracked in the `plugins.disabledPlugins` setting.

### Plugin Host console

The Plugin Host Console pane (`View > Console` or the `plugins.showConsole` command) shows real-time `stdout`/`stderr` output from the Plugin Host child process. Every line is timestamped at capture time (`[HH:MM:SS.mmm]`). Use `console.log()` in your plugin code and the output appears here. Errors from `stderr` are highlighted in red.

The pane offers two filter mechanisms: a multi-select dropdown to filter by plugin name (matches lines containing the selected plugin names) and a text filter for free-text search. Both filters can be used together. The clear button empties the log buffer.

### Manual reload

Use the "Refresh Plugin List" command in the Plugins pane to re-discover and reload all plugins. Individual plugins can be toggled via the context menu.

### Debugging

Open DevTools (`Ctrl+Shift+I`) to inspect the renderer process. Plugin Host child process output is captured in the Plugin Host Console pane and logged to the Studio's main console under `[PluginHost:stdout]` / `[PluginHost:stderr]` prefixes.

---

## Build & Package

### Build requirements

- Output format: **CommonJS** (`format: 'cjs'`)
- Platform: **Node.js** (`platform: 'node'`)
- The main entry must export `activate` and `deactivate` functions

### Recommended build tool: esbuild

```bash
esbuild src/index.ts --bundle --platform=node --format=cjs --outfile=dist/index.js --external:crypto
```

For webview bundles, use IIFE format targeting browsers:

```javascript
await build({
  entryPoints: ['src/main.tsx'],
  outfile: 'dist/main.js',
  bundle: true,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
});
```

### TypeScript configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

The SDK (`@evil/bifrost_fw_sdk`) is a `devDependency` only — it provides type information. At runtime, the `StudioPluginApi` instance is injected by the Plugin Host.

---

## Appendix: SDK Type Exports

The `@evil/bifrost_fw_sdk` package exports the following plugin-relevant types:

### Plugin API interfaces

- `StudioPluginApi` — root API object
- `PluginEnvironment` — `api.env` shape
- `CommandsApi`, `NotificationsApi`, `SettingsApi`, `EventsApi`, `WebviewApi`, `EditorsApi`, `PanesApi`
- `StatusBarApi`, `MenuBarApi`, `MenusApi`
- `DiagnosticsApi`, `DialogsApi`, `WorkspaceApi`, `ViewsApi`, `ThemesApi`

### Parameter/option types

- `SerializedCommandResult<T>`, `SerializedCommandInfo`
- `PluginCommandOptions`
- `PluginNotificationOpenOptions`, `PluginNotificationUpdateOptions`
- `PluginNotificationAction`, `PluginNotificationResponse`
- `PluginDialogOpenOptions`, `PluginDialogResult`, `PluginDialogAction`, `PluginDialogContentItem`
- `PluginFileDialogOpenOptions`, `PluginFileDialogSaveOptions`
- `SettingDescriptorMap`, `SettingDescriptor` (and all per-type variants)
- `WebviewPanelOptions`
- `RegisterWebviewDocumentTypeOptions`, `WebviewDocumentTypeWebviewOptions`
- `RegisterWebviewPaneOptions`, `WebviewPaneWebviewOptions`
- `PluginProgressHandle` — progress indicator handle from `statusBar.showProgress()`
- `MenuBarItemModifierConfig` — declarative modifier for menu bar items
- `MenuModifierConfig`, `MenuModifierPosition` — menu injection configuration
- `PluginTreeItem`, `PluginTreeItemType`, `PluginTreeBadge`, `TreeViewOptions`
- `PluginThemeDefinition`
- `PluginDiagnostic`, `PluginDiagnosticCounts`, `PluginDiagnosticSeverity`
- `FileStat`, `FileChangeEvent`, `FileChangeType`, `ProjectFolder`, `FileListEntry`

### BPMN API types

- `BpmnApi` — Full BPMN editor API interface
- `BpmnModelingApi` — Modeling sub-API (updateProperties, removeElement, appendElement, createConnection, moveElement)
- `BpmnOverlayDescriptor`, `BpmnOverlayType`, `BpmnOverlayPosition`, `BpmnOverlayStyle`
- `BpmnElementSnapshot`, `BpmnElementDetailSnapshot`
- `PluginBpmnPaletteEntry`, `PluginBpmnContextPadEntry`, `ContextPadEntryUpdate`
- `ManifestBpmnModule` — Renderer module manifest declaration
- `Disposable` — Subscription cleanup handle

### Manifest types

- `BifrostStudioManifest`, `ManifestContributions`
- `ManifestCommand`, `ManifestMenuItem`, `ManifestSetting`, `ManifestKeybinding`
- `ManifestPaneContribution`, `ManifestServiceTaskType`
- `ManifestPaneToggle` — declarative pane toggle for the menu bar
- `ManifestTheme` — theme declaration in `contributes.themes`
- `ManifestBpmnModule` — BPMN renderer module declaration in `contributes.bpmnModules`
- `ActivationEvent`, `KeybindingWhenCondition`

### Webview types

- `StudioWebviewApi` — `acquireStudioApi()` return type
- `Window.acquireStudioApi` global augmentation
