# Plugin Host

> **Phase**: 1 (infrastructure) + 2 (management UI) + 3 (webview UI) + 4 (declarative contributions) + 7 (per-plugin sandboxing) of the [Extension v2 roadmap](../extensions-v2/extension-v2-roadmap.md)
> **Status**: Implemented (Batches 1.1–1.7, 2.1–2.3, 3.7–3.8, 3.1–3.6, 4.1–4.6, 7.1–7.5), migrated to renderer (2026-05-13), integrated as `bifrost.plugins` (2026-05-15), full Settings & Commands API bridged (2026-05-15), selective plugin reload (2026-05-18), architecture streamlined (2026-05-18): PluginService is now the sole public API, PluginHost is hidden; iframe infrastructure + messaging (2026-05-19); iframe as editor document type (2026-05-19); iframe as pane, theming bridge, webview architecture docs (2026-05-20); declarative manifest contributions + lazy activation + API versioning (Phase 4); per-plugin Worker Thread + SES Compartment sandboxing (Phase 7)

## Overview

The Plugin Host is a process-isolated runtime for external plugins. Each renderer window owns its own Plugin Host instance, forking a dedicated child process. Inside that child process, **each plugin runs in its own Worker Thread** inside a **SES Compartment** (Secure EcmaScript). This three-layer model (renderer → child process → worker + compartment) aligns with VSCode/Cursor's Extension Host architecture while adding per-plugin JavaScript isolation.

| Layer | Target | Role |
|-------|--------|------|
| **Renderer** (`electron-renderer`) | Electron renderer | Bifrost instance, UI, `PluginService` facade, `PluginHost` lifecycle, `PluginHostBridge` (API execution), `PermissionGate`, `CommandDenylist` |
| **Plugin Host child process** (`plugin-host`) | Plain Node.js (`ELECTRON_RUN_AS_NODE`) | `SandboxManager` orchestration, IPC to renderer, `QuarantineManager` persistence |
| **Worker Thread** (`sandbox-worker.ts`, one per plugin) | `worker_threads` | SES `lockdown()`, `Compartment`, `ModuleGate`-gated `require()`, plugin `activate()` / `deactivate()` |
| **SES Compartment** | In-worker | Restricted global scope: no `eval`, no `Function()`, no network globals |

Plugins never execute in the renderer process. They communicate with Bifrost through a typed message protocol. Plugins have **no access** to the DOM, Electron APIs, or shared memory with the renderer — all interaction flows through serializable IPC messages. Caller identity on API requests is **attested** by `SandboxManager` (see _IPC caller attestation_ below); plugin code cannot forge `pluginName`.

```
Renderer (PluginHost + PluginHostBridge + PermissionGate)
    │  Node IPC (PH_* messages)
    ▼
Child process (plugin-host-main → SandboxManager)
    │  Worker postMessage per plugin
    ▼
Worker Thread (sandbox-worker: SES lockdown + Compartment + ModuleGate)
    │  activate(api) / require(main)
    ▼
Plugin JavaScript (untrusted)
```

### Per-window model

Each Electron window creates its own `PluginService` (which internally creates a `PluginHost`) in the renderer process. The host forks `out/plugin-host.js` and manages its lifecycle independently. This means:

- Multi-window scenarios work correctly — each window has its own plugin state.
- No relay layer — API requests flow directly between the child process and the renderer.
- Settings, commands, and events are resolved against the window's own `Bifrost` instance.

### Sandbox orchestration (Phase 7)

| Component | Layer | Purpose |
|-----------|-------|---------|
| `SandboxManager` | Child process (`plugin-host-main`) | One `PluginSandbox` per loaded plugin; routes worker messages; stamps `pluginName` on every `ApiRequestPayload`; owns `QuarantineManager` |
| `PluginSandbox` | Child process | Wraps a single Worker Thread lifecycle (`start` / `stop` / `terminate`) |
| `sandbox-worker.ts` | Worker Thread | SES `lockdown()`, `Compartment` creation, `ModuleGate`, plugin activation |
| `ModuleGate` | Worker Thread | Permission-aware `require()` proxy: blocks network/process modules; gates `fs` / `os` / native addons |
| `PermissionGate` | Renderer (`PluginHostBridge`) | Runtime permission set per plugin (from manifest); `assert()` before gated API paths |
| `CommandDenylist` | Renderer | Hard-denies `git.*`, `engine.*`, `plugins.*`, `dev.*`; gates `std.*`, `bpmn.*`, `dmn.*` by permission |
| `QuarantineManager` | Child process | Tracks per-plugin Worker crashes; persists `quarantine.json`; skips load while quarantined |
| `PluginPermissionDialog` | Renderer | Permission review dialog on enable/reload; skips zero-permission plugins and permanently trusted plugins with unchanged permissions |
| `PluginPermissionStore` | Shared | Local-storage-backed trust records per plugin (`PluginPermissionRecord`: approved permissions + trust flag); detects permission-set changes between versions |

## Bifrost Integration

The plugin subsystem is a **first-class Bifrost service**, available at `bifrost.plugins` (type `PluginService`). The property is non-optional — in non-Electron targets, the `PluginService` wraps a `NullPluginHost` that no-ops all host operations.

### Two-tier architecture

```
┌──────────────────────────────────────────────────────┐
│  Extensions & UI                                     │
│  (subscribe to bifrost.plugins.on(...))               │
├──────────────────────────────────────────────────────┤
│  PluginService (bifrost.plugins)                      │
│  - Public API: toggle, uninstall, trustAndReEnable,   │
│    getPluginList()                                   │
│  - Extends AbstractEmitter (EVENT_PLUGIN_LIST_CHANGED)│
│  - Caches plugin list, logo cache, disabled list     │
│  - Subscribes to PluginHost events, re-emits         │
├──────────────────────────────────────────────────────┤
│  PluginHost (internal, hidden from modules)       │
│  - Extends AbstractEmitter (EVENT_PLUGIN_LIST_CHANGED)│
│  - Manages child process lifecycle                   │
│  - Plugin discovery, load/unload IPC                 │
│  - PluginHostBridge for API execution                │
├──────────────────────────────────────────────────────┤
│  Plugin Host child process (plugin-host.js)          │
│  - SandboxManager → PluginSandbox (per plugin)       │
│  - Worker Thread + SES Compartment (sandbox-worker)  │
│  - QuarantineManager; inline api via createPluginApi  │
└──────────────────────────────────────────────────────┘
```

Internal modules and UI components interact **exclusively** with `PluginService`. The `PluginHost` (Electron renderer-side class that manages the child process) is an internal implementation detail and is never exposed to consumers.

### Three lifecycle phases

1. **Instance creation** — `new PluginService(this, new options.pluginHostConstructor(this))` assigns `bifrost.plugins` in the `Bifrost` constructor. The `PluginService` receives the `PluginHost` (or `NullPluginHost`) and subscribes to its events. The child process is not started yet.
2. **Initialization** — `bifrost.plugins.initialize()` is called during `Bifrost.initialize()`, after all internal modules have loaded. This calls `pluginHost.start()` (which forks `plugin-host.js` and waits for `PH_HOST_READY`), then `pluginHost.discoverAndLoadPlugins(disabledList)`.
3. **Running** — API requests flow through `PluginService` → `PluginHost` → child process. UI consumers subscribe to `bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED, ...)` for list updates.

### DI pattern

The `PluginHost` class is injected via `BifrostOptions.pluginHostConstructor`, following the same pattern as `dialogServiceConstructor`, `searchIndexConstructor`, etc. Default: `NullPluginHost` (for webapp/embed). The `PluginService` always wraps whatever host is constructed.

## Lifecycle

1. **Construction** — `new PluginService(bifrost, new PluginHost(bifrost))` during the `Bifrost` constructor. `PluginService` subscribes to `pluginHost.on(EVENT_PLUGIN_LIST_CHANGED, ...)` to sync its cached list and re-emit.
2. **Initialization** — `bifrost.plugins.initialize()` is called during `Bifrost.initialize()`. This calls `pluginHost.start()`, which forks `out/plugin-host.js` via `child_process.fork()` with `ELECTRON_RUN_AS_NODE=1`, and waits for `PH_HOST_READY`.
3. **Plugin discovery** — `pluginHost.discoverAndLoadPlugins(disabledList)` scans the plugins directory, reads `package.json` metadata (`displayName`, `description`, `version`, `author`, `homepage`, `keywords`, `deprecated`) and resolves the plugin logo (`LOGO.png` or `pkg.logo` fallback). Disabled plugins (listed in `plugins.disabledPlugins` setting) are skipped but tracked with `status: 'disabled'`. The method emits `EVENT_PLUGIN_LIST_CHANGED` after processing all manifests, then defers `onStartup` / `*` plugin activations until the Bifrost `ready` event fires (guaranteeing the UI is fully rendered). Activations run **sequentially** via `activatePluginsSequentially()` so permission dialogs are shown one at a time. `ActivationManager.activatePlugin()` stores the activation promise in `pendingActivations` so concurrent callers (e.g. stub callbacks triggered by the user while activation is in progress) join the existing promise rather than returning early.
4. **Running** — API requests and callback invocations flow directly between the renderer and the Plugin Host child process. UI consumers subscribe to `bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED, ...)`.
5. **Selective unload/reload** — `bifrost.plugins.togglePlugin(name)` is the public API. For disabled plugins, it removes them from `plugins.disabledPlugins` and calls `pluginHost.reloadPlugin(name)`. For errored plugins (not in `disabledPlugins`), it retries via `reloadPlugin` without modifying the disabled list. For running plugins, it adds them to `disabledPlugins` and calls `pluginHost.unloadPlugin(name)`. `reloadPlugin` re-validates the manifest from disk before attempting the IPC reload, preserving error state if validation fails. See _Error recovery on reload_ below.
6. **Full refresh** — `bifrost.plugins.refreshFromHost()` performs a full cycle: dispose (kill child, run bridge cleanup), then start (fork new child), then re-discover (re-scan filesystem). Only plugins currently on disk are loaded. Used as a fallback for bulk operations (e.g. manual "Refresh" button in the Plugins pane).
7. **Graceful shutdown** — On quit, the renderer sends `host.dispose`. The host calls `SandboxManager.deactivateAll()` (stop each Worker, run `deactivate()` in compartments), rejects pending requests, and exits.
8. **Force kill** — On terminate, the renderer sends `SIGKILL`.

### Event flow

The event system uses a two-tier `AbstractEmitter` pattern (same pattern as `SettingsMediator`):

```
PluginHost.emit(EVENT_PLUGIN_LIST_CHANGED)
  → PluginService handler: sync this.plugins = pluginHost.getPluginList()
    → PluginService.emit(EVENT_PLUGIN_LIST_CHANGED)
      → UI consumers (PluginsPaneRenderer, PluginReadmeRenderer, AboutPage, etc.)
```

`PluginHost.getPluginList()` returns a shallow copy (`[...this.pluginList]`). `PluginService.getPluginList()` returns the cached reference. Consumers always subscribe to `bifrost.plugins.on(...)` (the `PluginService`), never to the `PluginHost` directly.

The `suppressHostSync` flag in `PluginService` prevents intermediate state flashes during multi-step operations like uninstall (where the host emits after unload but before the plugin is removed from disk).

### Resource cleanup

When the Plugin Host is disposed or refreshed, the `PluginHostBridge` cleans up all renderer-side resources:

- **Commands** — `CommandManager.unregister(commandId)` removes commands registered by plugins.
- **Settings subscriptions** — Properly disposed via the bridge's callback map.
- **Diagnostics** — `bifrost.diagnostics.clearDiagnostics('plugin.<pluginName>')` removes all diagnostics contributed by the plugin.
- **Dialogs** — If the plugin owns the currently active dialog, it is force-closed via `bifrost.dialog.close()`.
- **Workspace watchers** — Active file watchers (chokidar) and solution-change subscriptions are disposed via the per-plugin callback map. The `activeFileWatchers` map tracks watcher disposables by callback ID.
- **Tree views** — Tree view data and listeners are cleared from bridge maps; panes and pane providers are unregistered.
- **Themes** — All plugin-contributed themes are unregistered from `ThemeManager`, injected `<style>` elements are removed, and the active theme falls back to a default if it was contributed by the disposed plugin.
- **Per-plugin grouping** — Callbacks are tracked in a `Map<pluginName, Map<callbackId, { disposer }>>` structure so cleanup works per-plugin and in bulk.

#### Selective unload/reload cleanup

When a single plugin is unloaded or reloaded (via `bifrost.plugins.togglePlugin(name)`), the cleanup chain is:

1. **PluginService** — Updates the `plugins.disabledPlugins` setting, then delegates to `pluginHost.unloadPlugin(name)` or `pluginHost.reloadPlugin(name)`. On disable, also closes the plugin's README tab and clears its logo cache entry.
2. **PluginHost (renderer)** — `PluginHostBridge.disposePlugin(name)` removes only that plugin's registered callbacks (commands, settings listeners, diagnostics subscriptions, workspace file watchers, solution-change listeners) from the renderer, clears plugin diagnostics, and force-closes any active dialog owned by the plugin. `pluginIframeManager?.disposePlugin(name)` cleans up any webview iframes. Sends IPC to child process.
3. **Plugin Host (child process)** — `SandboxManager.unloadPlugin(name)` stops the plugin's Worker Thread (`PluginSandbox.stop()`), which runs `deactivate()` inside the compartment and disposes the plugin's registered API callbacks. The renderer receives `PH_UNREGISTER_CALLBACK` for each disposed callback. The Worker is terminated so a reload starts a fresh compartment (no shared `require.cache` across plugins).
4. **Renderer permissions** — `PluginHostBridge.permissionGate.unregister(pluginName)` clears the plugin's granted permission set.
5. **Plugin list** — The `PluginHost`'s `pluginList` entry is updated in-place (`status: 'disabled'` for unload, `status: 'loaded'` for reload). `PluginHost` emits `EVENT_PLUGIN_LIST_CHANGED`. `PluginService` syncs and re-emits. UI consumers re-render.

#### Error recovery on reload

`reloadPlugin` handles plugins that previously failed to load (manifest errors, API version mismatch, runtime failure). Instead of blindly attempting an IPC reload, it follows the same validation pipeline as initial discovery:

1. **Re-discover from disk** — `discoverSinglePlugin(pluginPath)` re-reads `package.json`, re-validates the manifest, and refreshes all metadata fields on the `PluginInfo` entry. This picks up user edits to the manifest.
2. **Re-validate** — Manifest errors and API version checks are re-run. If validation fails, the plugin stays in `status: 'error'` with a refreshed `errorMessage` and a toast notification. No IPC is sent to the child process.
3. **Re-register contributions** — If validation passes, manifest contributions (commands, menus, keybindings, settings, panes, icons, bpmnPalette, bpmnContextPad, bpmnModules) are re-registered via the `ContributionRegistrar`.
4. **Load or defer** — Plugins with `activationEvents` go to `status: 'pending'` (lazy). Others attempt an IPC `PH_RELOAD_PLUGIN`. IPC failures are caught and preserve the `error` state.

`togglePlugin` cooperates by routing errored plugins (not in `plugins.disabledPlugins`) to `reloadPlugin` instead of the disable branch. Plugins in `status: 'quarantined'` are not retried via toggle alone — use `bifrost.plugins.trustAndReEnablePlugin(name)` (see _Per-plugin crash recovery and quarantine_).

### Build

The Plugin Host is compiled as a separate Rspack entry in `rspack.config.electron-main.js` (`configPluginHost`). Key difference from the renderer bundle: `target: 'node'` (not `electron-renderer`) to prevent Electron API access.

The renderer's Rspack config (`rspack.config.electron.js`) sets `node: { __dirname: false }` to preserve the runtime `__dirname` (= `studio/out/`), ensuring `path.resolve(__dirname, 'plugin-host.js')` correctly locates the child process bundle.

Output: `out/plugin-host.js` alongside `out/bundle-electron-renderer.js` and `out/bundle-electron-main.js`.

## Message Protocol (PH)

All messages share a common envelope:

```typescript
interface PluginHostMessage {
  protocolVersion: 1;
  type: string;
  requestId?: string;
  payload?: unknown;
}
```

### Message types

| Constant | Direction | Purpose |
|----------|-----------|---------|
| `PH_HOST_READY` | host → renderer | Bootstrap complete |
| `PH_HOST_DISPOSE` | renderer → host | Shut down |
| `PH_LOAD_PLUGIN` | renderer → host | Load a plugin from disk |
| `PH_PLUGIN_LOADED` | host → renderer | Load result (success/error) |
| `PH_UNLOAD_PLUGIN` | renderer → host | Unload a single plugin (deactivate + dispose + cache invalidation) |
| `PH_RELOAD_PLUGIN` | renderer → host | Unload then re-load a single plugin |
| `PH_API_REQUEST` | host → renderer | Plugin calls an API method |
| `PH_API_RESPONSE` | renderer → host | API method result |
| `PH_REGISTER_CALLBACK` | host → renderer | Plugin registers a callback (command, event listener) |
| `PH_UNREGISTER_CALLBACK` | host → renderer | Plugin unregisters a callback |
| `PH_CALLBACK_INVOCATION` | renderer → host | Invoke a registered callback |
| `PH_CALLBACK_RESULT` | host → renderer | Callback return value |
| `PH_EVENT` | renderer → host | Broadcast an event to all plugins |
| `PH_PLUGIN_CRASHED` | host → renderer | Worker Thread exited unexpectedly; includes `quarantined` flag and `crashCount` |
| `PH_TRUST_AND_REENABLE` | renderer → host | Clear quarantine entry for a plugin (`SandboxManager.trustAndReEnable`) |

### Request/response pairing

`PluginHostConnection` wraps the raw `process.send`/`process.on('message')` with promise-based request/response. Each request gets a UUID `requestId`; responses match on this ID. Unmatched responses after 30 seconds are rejected.

## API Surface

Plugins receive a `StudioPluginApi` instance in their `activate()` function:

```typescript
export async function activate(api: StudioPluginApi): Promise<void> {
  // api.commands, api.diagnostics, api.dialogs, api.notifications,
  // api.settings, api.events, api.webviews, api.editors, api.panes,
  // api.statusBar, api.menuBar, api.menus, api.workspace,
  // api.views, api.themes, api.bpmn, api.env
}
```

### Namespaces

| Namespace | Backed by |
|-----------|-----------|
| `commands` | `bifrost.commands` (CommandMediator / CommandManager) |
| `diagnostics` | `bifrost.diagnostics` (DiagnosticsMediator / DiagnosticsManager) via `PluginHostBridge` |
| `dialogs` | `bifrost.dialog` (DialogManager) via `PluginHostBridge` |
| `notifications` | `bifrost.notifications` (NotificationManager) |
| `settings` | `bifrost.settings` (SettingsMediator / SettingsManager) |
| `events` | Callback registration |
| `webviews` | `PluginIframeManager` (renderer) via `PluginHostBridge` |
| `editors` | `bifrost.editors` (EditorMediator) via `PluginHostBridge` |
| `panes` | `bifrost.panes` (PaneMediator) via `PluginHostBridge` |
| `statusBar` | `bifrost.statusBar` (StatusBarMediator / StatusBarManager) via `PluginHostBridge` |
| `menuBar` | `bifrost.menuBar` (MenuBarMediator / MenuBarManager) via `PluginHostBridge` |
| `menus` | `bifrost.menus` (MenuMediator) via `PluginHostBridge` |
| `workspace` | `bifrost.files` (FileHandlingService) + `bifrost.solution` (SolutionMediator) via `PluginHostBridge` |
| `views` | `bifrost.panes` (PaneMediator) via `TreeViewPaneProvider` + `PluginHostBridge` |
| `themes` | `bifrost.theme` (ThemeMediator / ThemeManager) via `PluginHostBridge` + CSS injection |
| `env` | Frozen environment object |

#### `commands`

| Method | Signature | Notes |
|--------|-----------|-------|
| `register` | `(id, callback, options?) → Promise<void>` | Registers a command. Auto-prefixed `plugin.<name>.<id>`. `options.visibleInSearch` controls palette visibility; `options.description` sets the palette label. `enabledWhen` not supported (sync/async boundary). |
| `executeCommand` | `(id, args?) → any` | Executes any registered command. Throws on failure. |
| `tryToExecuteCommand` | `(id, args?) → {success, returnValue/error}` | Non-throwing variant. Error is serialized as `{message, stack}`. |
| `isCommandEnabled` | `(id, args?) → boolean` | Checks if a command is enabled. |
| `isRegistered` | `(commandName) → boolean` | Checks if a command exists. |
| `getCommands` | `() → CommandInfo[]` | Returns all commands as `{name, description, visibleInSearch}` (functions stripped). |

#### `notifications`

| Method | Signature | Notes |
|--------|-----------|-------|
| `open` | `({type, content, origin?, actions?, sticky?}) → notificationId` | Opens a notification. `origin` defaults to the plugin name. `actions` adds clickable buttons. `sticky` keeps the notification visible until dismissed. |
| `close` | `(notificationId) → void` | Closes an open notification. |
| `update` | `(notificationId, {content}) → void` | Updates notification content. |
| `onResponse` | `(notificationId, callback) → void` | Subscribe to action button clicks on a notification (via `PH_REGISTER_CALLBACK`). Callback receives `{ action, label }`. |

#### `settings`

| Method | Signature | Notes |
|--------|-----------|-------|
| `register` | `(descriptors) → void` | Registers settings with SettingDescriptor schemas. |
| `has` | `(key) → boolean` | Checks if a setting is registered. |
| `get` | `(key) → any` | Reads the current value (falls back to default). |
| `getSchema` | `(key) → SettingDescriptor?` | Returns the schema for one key. |
| `getSchemas` | `() → Record<string, SettingDescriptor>` | All schemas (Map converted to object for serialization). |
| `getDefault` | `(key) → any` | Returns the registered default value. |
| `getDefaults` | `() → Record<string, any>` | All registered defaults. |
| `set` | `(key, value) → void` | Sets a setting value (validated against descriptor). |
| `add` | `(key, value) → void` | Pushes to array or shallow-merges into object. |
| `removeValue` | `(key, value) → void` | Removes from array or deletes object property. |
| `onDidChange` | `(key, callback) → void` | Fires callback when a setting changes. |

**Not exposed to plugins**: `merge()` (bulk-replaces all settings) and `resetToDefault()` (resets all settings) are omitted to prevent plugins from disrupting user configuration.

#### `webviews`

| Method | Signature | Notes |
|--------|-----------|-------|
| `createPanel` | `(options: {title, entryPoint, localResourceRoots?}) → iframeId` | Stub — returns a deterministic `iframeId` but does not yet mount a UI panel. Editor documents (Batch 3.3) and panes (Batch 3.4) are the implemented surfaces. |
| `postMessage` | `(iframeId, data) → void` | Sends a message from the plugin (child process) to the specified iframe. Routed through the bridge → `PluginIframeManager.postMessageToIframe()` → `contentWindow.postMessage()`. |
| `onMessage` | `(iframeId, callback) → disposer` | Registers a listener for messages coming from the iframe. Uses the `PH_REGISTER_CALLBACK` mechanism. The bridge sets a `messageHandler` on `PluginIframeManager`, which invokes `PH_CALLBACK_INVOCATION` back to the child process. Returns a disposer function. |
| `dispose` | `(iframeId) → void` | Cleans up the iframe entry in `PluginIframeManager`. |

**Message flow (plugin → iframe)**:

```
Plugin code (child process)
  → api.webviews.postMessage(iframeId, data)
  → PH_API_REQUEST { namespace: 'webviews', method: 'postMessage' }
  → (Node IPC: child → renderer)
  → PluginHostBridge.handleWebviewsApi → pluginIframeManager.postMessageToIframe
  → iframeRef.contentWindow.postMessage({ channel: 'studio-bridge', direction: 'to-guest', payload })
  → bridge-script.ts message listener → plugin's onMessage callback in the iframe
```

**Message flow (iframe → plugin)**:

```
Plugin iframe code: acquireStudioApi().postMessage(data)
  → window.parent.postMessage({ channel: 'studio-bridge', direction: 'to-host',
      payload: { type: 'plugin-message', data } })
  → PluginIframe: 'message' event [validates origin] → pluginIframeManager.handleIframeMessage
  → PluginIframeHostMessage { type: 'plugin-message', data } → entry.messageHandler(message.data)
  → PH_CALLBACK_INVOCATION { callbackId, args: [data] }
  → (Node IPC: renderer → child)
  → plugin-host-main.ts: getGlobalCallback(callbackId)(data)
  → plugin's onMessage callback fires
```

#### `editors`

| Method | Signature | Notes |
|--------|-----------|-------|
| `registerWebviewDocumentType` | `(options) → void` | Registers an iframe-backed editor document type. Options include `id`, `displayName`, `icon`, `uriPattern` (serialized regex), `webviewOptions` (`entryPoint`, optional `localResourceRoots`), and optional `onDidOpen` callback. The document type is namespaced as `plugin.<pluginName>.<id>`. |
| `openDocument` | `(uri) → void` | Opens a document by URI. Delegates to `bifrost.editors.focusOrOpenEditorDocument()`. |

**Document type registration flow (plugin → renderer)**:

```
Plugin code (child process)
  → api.editors.registerWebviewDocumentType(options)
  → PH_API_REQUEST { namespace: 'editors', method: 'registerWebviewDocumentType' }
  → PluginHostBridge.handleEditorsApi
  → createIframeDocumentRendererConstructor(context) → rendererConstructor
  → bifrost.editors.registerDocumentType('plugin.<name>.<id>', { uriMatch, rendererConstructor, ... })
```

When a matching document is opened, `EditorWrapper` resolves the renderer constructor and mounts `IframeDocumentRenderer`, which renders a `PluginIframe` with `iframeId = 'editor:<uri>'`.

**`onDidOpen` callback**: When provided, the callback is registered via `PH_REGISTER_CALLBACK` and stored by the bridge. `IframeDocumentRenderer` fires the notification on mount via a `useEffect`, which triggers `PH_CALLBACK_INVOCATION` back to the child process with `(iframeId, uri)`. This lets plugins wire up per-document `onMessage` handlers.

**Cleanup on plugin unload**: The disposer calls `bifrost.editors.unregisterDocumentType(id)`, which force-closes all open tabs of that type and removes all sub-manager entries (renderer, model, inspector, merge resolver).

#### `panes`

| Method | Signature | Notes |
|--------|-----------|-------|
| `registerWebviewPane` | `(options) → void` | Registers an iframe-backed pane. Options: `id`, `title`, `area` (`'left'`/`'right'`/`'bottom'`), optional `groupId`, `icon`, `webviewOptions` (`entryPoint`, optional `localResourceRoots`). Pane ID namespaced as `plugin.<pluginName>.<id>`. |
| `setVisible` | `(paneId, visible) → void` | Show or hide a pane. This is the sole runtime visibility control — newly registered panes default to visible. State persists until changed by another `setVisible` call or until the plugin is disabled. |

**Pane registration flow (plugin → renderer)**:

```
Plugin code (child process)
  → api.panes.registerWebviewPane(options)
  → PH_API_REQUEST { namespace: 'panes', method: 'registerWebviewPane' }
  → PluginHostBridge.handlePanesApi
  → createIframePaneProvider(context) → PaneProviderModule
  → bifrost.panes.getPaneViaPaneProvider(paneId, providerId, module)
  → bifrost.panes.registerPaneGroup(area, groupId, [paneObject])
    or bifrost.panes.appendToPaneGroup(area, groupId, [paneObject])
```

The pane renders a `PluginIframe` with `iframeId = 'pane:<paneId>'`. Messaging works through the same `api.webviews.onMessage()` / `api.webviews.postMessage()` pipeline as editor documents.

**Pane visibility**: `setVisible` is the sole runtime control for plugin pane visibility. The bridge maintains a `paneVisibility: Map<string, boolean>` keyed by fully namespaced pane ID. When `setVisible` is called, the state is stored and `requestPaneLayoutUpdate()` triggers a re-render. The `IframePaneProvider.shouldBeDisplayed` reads this map and defaults to `true` (visible) when no entry exists.

Plugins typically subscribe to events (e.g. `editorFocusChanged`, `settings.onDidChange`) and call `setVisible` in response, giving them full programmatic control over when their panes appear.

**Manifest `visibleWhen`** is a separate, declarative mechanism used **only** by `PlaceholderPaneProvider` as a lazy-load activation trigger. Once the plugin activates and the placeholder is replaced by the real `IframePaneProvider`, `visibleWhen` is no longer evaluated — `setVisible` takes over.

**Cleanup on plugin unload**: The disposer calls `bifrost.panes.unregisterPane(paneId)` and `bifrost.panes.unregisterPaneProvider(providerId)`. All visibility state for the plugin is also cleared from `paneVisibility`.

#### `statusBar`

| Method | Signature | Notes |
|--------|-----------|-------|
| `registerStatusBarItem` | `(area, id, items, priority?) → void` | Register items in `'left'`, `'center'`, or `'right'` area. Items are `StatusBarItem[]` POJOs. Optional `priority` controls ordering within the area. |
| `updateStatusBarItem` | `(id, items) → void` | Replace items for a previously registered status bar item. |
| `unregisterStatusBarItem` | `(id) → void` | Remove a registered status bar item. |
| `showProgress` | `(label) → PluginProgressHandle` | Show a progress indicator. Returns a proxy handle with `update(label)` and `done()`. |
| `isVisible` | `() → boolean` | Returns status bar visibility state. |

**Design principle**: Mirrors `StatusBarMediator` method names and data structures. Closures are replaced with serializable `StatusBarItem[]` POJOs. The bridge translates these into `StatusBarManager` factory function registrations.

**Cleanup on plugin unload**: All registered items are unregistered. Active progress handles are completed via `handle.done()`.

#### `menuBar`

| Method | Signature | Notes |
|--------|-----------|-------|
| `registerMenuBarItem` | `(area, items) → void` | Register items in `'left'`, `'center'`, or `'right'` area. |
| `registerMenuBarItemModifier` | `(config) → void` | Insert items relative to an existing item (`insertAfter` / `insertBefore`). |
| `isVisible` | `() → boolean` | Returns menu bar visibility state. |

**Design principle**: Mirrors `MenuBarMediator` except `show`, `hide`, `toggleVisibility`, and `updateMenuBarItems` which are Studio-internal layout concerns and not exposed to plugins.

**Modifier flow**: The bridge translates declarative `MenuBarItemModifierConfig` into `insertAfterMenuBarItem()` / `insertBeforeMenuBarItem()` modifier functions from `MenuBarModifierFunctions`.

**Manifest contribution**: Plugins can declare `contributes.paneToggles` in the manifest for lazy-loaded pane toggle buttons. The `ContributionRegistrar` processes these at discovery time using the same modifier functions.

**Cleanup on plugin unload**: All registered items and modifiers are disposed via the disposer tracking in `PluginHostBridge`.

#### `menus`

| Method | Signature | Notes |
|--------|-----------|-------|
| `registerMenuModifier` | `(menuId, config) → void` | Inject items into an existing menu or submenu. |

**Config**: `MenuModifierConfig` with `items: MenuItem[]` and optional `position: MenuModifierPosition`. Position types: `'append'` (default), `'prepend'`, `'appendToSubmenu'` (requires `submenuId`), `'prependToSubmenu'` (requires `submenuId`), `'insertAfter'` (requires `id`), `'insertBefore'` (requires `id`).

**Design principle**: Mirrors `MenuMediator.registerMenuModifier()`. The bridge translates declarative configs into modifier functions that the `MenuMediator` invokes when rendering menus.

**Cleanup on plugin unload**: Modifier registrations are disposed.

#### `diagnostics`

| Method | Signature | Notes |
|--------|-----------|-------|
| `set` | `(uri, diagnostics) → void` | Set diagnostics for a URI. Owner auto-namespaced to `plugin.<pluginName>`. |
| `clear` | `() → void` | Clear all diagnostics contributed by this plugin. |
| `get` | `(uri?) → Record<string, PluginDiagnostic[]>` | Get diagnostics, optionally filtered by URI. |
| `getCount` | `() → { errors, warnings, infos }` | Get aggregate diagnostic counts. |
| `onDidChange` | `(callback) → void` | Subscribe to diagnostic change events (via `PH_REGISTER_CALLBACK`). |

**Design principle**: Mirrors `DiagnosticsMediator`. The `owner` field is auto-set to `plugin.<pluginName>` by the bridge — plugins cannot interfere with diagnostics from other plugins. `PluginDiagnostic` is `{ severity: 'error' | 'warning' | 'info', message: string }`.

**Cleanup on plugin unload**: `bifrost.diagnostics.clearDiagnostics('plugin.<pluginName>')` removes all diagnostics contributed by the plugin. `onDidChange` subscriptions are disposed via the per-plugin callback map.

#### `dialogs`

| Method | Signature | Notes |
|--------|-----------|-------|
| `open` | `(options) → PluginDialogResult` | Show a custom modal dialog with form content and action buttons. |
| `prompt` | `(title, placeholder?) → string \| null` | Show a simple text prompt. Returns entered text or `null` on cancel. |
| `showOpenFile` | `(options?) → string[] \| null` | Show a native file open dialog (Electron-only). |
| `showOpenDirectory` | `() → string[] \| null` | Show a native directory picker (Electron-only). |
| `showSaveFile` | `(options?) → string \| null` | Show a native save file dialog (Electron-only). |

**Design principle**: Mirrors `DialogManager`. All dialog content types (`text_input`, `select`, `checkbox`, `text`, `section`, `divider`, `markdown`, `markdown_container`, `json`, `diff`, `response_link`, `path_list`, `path_picker`) are supported since they are all serializable. Validation callbacks are not supported in v1 — plugins validate on the returned `formData`.

**Active dialog tracking**: The bridge tracks `activeDialogOwner: string | null` so that plugin-initiated dialogs are force-closed on plugin disable.

**Cleanup on plugin unload**: If the plugin being disposed owns the currently active dialog, `bifrost.dialog.close()` is called to force-close it.

#### `workspace`

| Method | Signature | Notes |
|--------|-----------|-------|
| `readFile` | `(uri) → string` | Reads a text file (UTF-8). Scope check enforced. |
| `readBinaryFile` | `(uri) → Uint8Array` | Reads a binary file. Base64-encoded over IPC. |
| `writeFile` | `(uri, content) → void` | Writes a text file. Scope check enforced. |
| `writeBinaryFile` | `(uri, content: Uint8Array) → void` | Writes a binary file. Base64-encoded over IPC. |
| `listDirectory` | `(uri) → FileListEntry[]` | Lists entries as `{ name, uri, type }`. |
| `stat` | `(uri) → FileStat` | Returns `{ isDirectory, isFile, exists }`. |
| `createDirectory` | `(uri) → void` | Creates a directory (recursive). |
| `deleteFile` | `(uri) → void` | Deletes a file or directory. |
| `onDidChangeFile` | `(uri, callback) → { dispose }` | Watches a file or directory with 100ms debounce. Callback receives `{ type: 'created' \| 'changed' \| 'deleted', uri }`. |
| `onDidChangeSolution` | `(callback) → { dispose }` | Fires when projects are added/removed/changed. Bridges `EVENT_SOLUTION_CHANGED`. |
| `getProjectFolders` | `() → ProjectFolder[]` | Returns `{ uri, name }` for each project in the solution. |

**Design principle**: Mirrors a scoped subset of `FileHandlingService` (`bifrost.files`). Plugins use `file://` URIs. The bridge converts to local paths via `getLocalFilenameForUri()` as needed.

**Scoping model**: Every file operation validates the target URI is within:
1. Any project folder from `bifrost.solution.getSolution()?.projects[].baseUri`, or
2. The plugin's own storage directory (`env.storagePath`, derived from the storage base path + plugin name).

Access outside these scopes is rejected with an error. This is the official file I/O surface; Phase 7 additionally gates raw `require('fs')` in the Worker via `ModuleGate` — plugins should prefer `api.workspace` for portable file access.

**Binary transport**: `readBinaryFile` / `writeBinaryFile` encode `Uint8Array` as base64 strings for IPC transfer. The bridge decodes before calling `bifrost.files.save()`.

**File watchers**: `onDidChangeFile` creates a chokidar watcher via `bifrost.files.watchDirectory()`. Raw chokidar events (`add`, `change`, `unlink`, `addDir`, `unlinkDir`) are mapped to `created` / `changed` / `deleted`. Events are coalesced with a 100ms debounce before forwarding to the plugin callback via `PH_CALLBACK_INVOCATION`.

**Cleanup on plugin unload**: All active file watchers for the plugin are disposed via the per-plugin callback map. `onDidChangeSolution` subscriptions are disposed the same way.

#### `editors` — Dirty State & Save

In addition to the document type registration methods, the `editors` namespace provides:

| Method | Signature | Notes |
|--------|-----------|-------|
| `setDirty` | `(uri, isDirty) → void` | Set `hasUnsavedChanges` on a model-less document. Emits `EVENT_EDITOR_DOCUMENT_DATA_UPDATED`. |
| `onSaveRequest` | `(uri, callback) → { dispose }` | Register a save delegate for Ctrl+S and close-save flows. |

**Save delegate architecture**: `EditorMediator` maintains a `saveDelegates: Map<string, () => Promise<void>>` registry parallel to the model-based save flow. When `doSaveEditorDocument()` encounters a model-less document, it checks for a save delegate. The close-save dialog also routes through `saveChangesBeforeClosingDelegateDocument()` for model-less dirty documents.

**Cleanup on plugin unload**: Save delegates are unregistered. The `unregisterDocumentType` disposer now triggers the close-save dialog (changed from `skipAskUnsavedChanges: true` to `false`).

#### `events` / `env`

| Method | Signature | Notes |
|--------|-----------|-------|
| `events.on` | `(eventName, callback) → void` | Subscribe to Studio events. |
| `events.off` | `(eventName, callback) → void` | Unsubscribe. |
| `env` | readonly `{pluginPath, pluginName, storagePath, apiVersion}` | Frozen environment. |

**Supported event names**:

| Event | Payload | Source |
|-------|---------|--------|
| `editorFocusChanged` | `{ uri: string \| null, documentType: string \| null }` | `EVENT_EDITOR_AREA_FOCUS_UPDATED` via `EditorMediator` |

The bridge registers event subscriptions through `PH_REGISTER_CALLBACK` with `namespace: 'events'`. When the renderer-side event fires, it forwards the payload to the child process via `PH_CALLBACK_INVOCATION`. Event subscriptions are cleaned up via `disposePlugin` alongside all other callbacks.

#### `views` — Tree View API

| Method | Signature | Notes |
|--------|-----------|-------|
| `registerTreeView` | `(options: TreeViewOptions) → void` | Register a tree view pane hosted by the SDK `Tree` component. |
| `updateTreeData` | `(viewId, items: PluginTreeItem[]) → void` | Push new tree data — replaces previous items and triggers re-render. |

**Architecture**: The bridge stores `PluginTreeItem[]` data in a `treeViewData` map keyed by namespaced view ID. A `TreeViewPaneProvider` hosts the SDK `Tree` component, receiving data via a getter function and subscribing to change notifications. When `updateTreeData` is called, all registered listeners for that view ID are notified, causing the React component to re-render with the new data.

**Item mapping**: `PluginTreeItem` is mapped to the SDK `TreeItem` at render time. `children` → `entries`, `command` → `metadata.command` (resolved and executed via `bifrost.commands` on click), `contextMenuId` → `menuId`, `badges` → `TreeBadge[]`. The `id` field maps to `pathId` for stable reconciliation.

**Click handling**: When a user clicks a tree item with a `command` field, the bridge executes `plugin.<pluginName>.<command>` via `bifrost.commands.executeCommand`, passing the item's `metadata` as the first argument.

**Cleanup on plugin unload**: `bifrost.panes.unregisterPane()` and `unregisterPaneProvider()` are called. The tree data and listeners are cleared from the bridge's maps.

#### `themes` — Theme Contributions

| Method | Signature | Notes |
|--------|-----------|-------|
| `register` | `(definition: PluginThemeDefinition) → void` | Register a custom theme with CSS token overrides. |
| `unregister` | `(themeId) → void` | Remove a previously registered theme. |
| `getActiveTheme` | `() → string` | Get the currently active theme ID. |

**Architecture**: Plugin themes are registered via `bifrost.theme.registerTheme()` (metadata) + a dynamically injected `<style>` element containing CSS custom property overrides scoped to `.bifrost.bifrost-theme--<themeId>`. This integrates seamlessly with the existing class-swap theme mechanism. Theme IDs are auto-namespaced to `plugin.<pluginName>.<id>`.

**Two registration paths**:
1. **Manifest** (`contributes.themes`) — processed by `ContributionRegistrar` at discovery time, before plugin activation. Suitable for small themes with few tokens.
2. **Runtime API** (`api.themes.register()`) — called from `activate()`. Suitable for themes with many tokens or dynamic computation.

**Token normalization**: Token keys may omit the leading `--` prefix — it is auto-prepended if missing (e.g. `theme-background` → `--theme-background`).

**Type-aware fallback**: When a plugin theme is removed while active, the Studio falls back to the matching default theme: **Bifrost Night** (`dark`) or **Bifrost Day** (`light`).

**Cleanup on plugin unload**: All themes registered by the plugin (both manifest and runtime) are unregistered. Injected `<style>` elements are removed. If the active theme was contributed by the disposed plugin, the type-aware fallback activates.

#### `bpmn` — BPMN Editor API

| Method | Signature | Notes |
|--------|-----------|-------|
| `setOverlays` | `(uri, overlays[]) → void` | Imperative overlay placement — replaces all overlays for this plugin on the given URI |
| `clearOverlays` | `(uri, filter?) → void` | Remove overlays for this plugin on the given URI (optionally filtered by elementId) |
| `getElements` | `(uri) → BpmnElementSnapshot[]` | All elements on the current diagram plane |
| `getElement` | `(uri, elementId) → BpmnElementDetailSnapshot \| null` | Detail snapshot with properties, incoming, outgoing |
| `getXml` | `(uri) → string` | Current BPMN XML content |
| `onElementSelected` | `(uri, callback) → Disposable` | Subscribe to selection changes |
| `onElementHover` | `(uri, callback) → Disposable` | Subscribe to hover events |
| `onElementDoubleClick` | `(uri, callback) → Disposable` | Subscribe to double-click events |
| `onElementContextMenu` | `(uri, callback) → Disposable` | Subscribe to context menu events |
| `onOverlayContextChanged` | `(uri, callback) → Disposable` | Subscribe to overlay context changes (data-updated, selection-changed, document-opened) |
| `registerOverlayFactory` | `(factory, options?) → Disposable` | Register a factory callback for auto-rendered overlays (see below) |
| `requestOverlayRefresh` | `() → void` | Force re-evaluation of all overlay factories (use when plugin state affecting overlays has changed) |
| `getFocusedDocumentUri` | `() → string \| null` | URI of the currently focused BPMN editor document (convenience for context-free commands) |

**Overlay Factory (auto-render model)**:

`registerOverlayFactory` registers a callback that the Studio invokes on every BPMN overlay refresh cycle (document open, data change, root change, settings change). The factory receives an `OverlayFactoryContext` containing the current element list, document URI, and the overlay chain from previous factories. It returns a `BpmnOverlayDescriptor[]` representing the final overlay set for the next factory in the chain.

Key design decisions:
- **One factory per plugin** — re-registration replaces the previous factory (logs a console warning).
- **Priority-ordered chain** — factories are called in ascending priority order (lowest first, highest last). Default priority: 100. Higher priority = called later = more power to override.
- **Element-scoped, not file-scoped** — factories receive elements, not URIs. A factory works on any BPMN file.
- **Override chain semantics** — each factory receives `currentOverlays` (output of previous factory) and `originalDefaultOverlays` (Studio's built-in overlays, immutable). A factory can add, remove, or replace overlays.
- **Performance guards** — per-factory 500ms timeout, input fingerprint caching, sequential processing.
- **Error isolation** — one factory throwing doesn't break the chain; its input is passed unchanged to the next factory.

Files:
- `studio/src/bifrost/electron-renderer/plugin-host/PluginOverlayStore.ts` — factory registry, invocation, caching
- `studio/src/bifrost/electron-renderer/plugin-host/BpmnApiBridge.ts` — callback registration, IPC bridge
- `studio/src/modules/bpmn-editor/BpmnDocumentModel.ts` — `refreshOverlays()` integration point
- `studio-sdk/src/plugin-api/BpmnApi.ts` — SDK type definitions

**Modeling sub-namespace** (requires `bpmn.modelling`):

| Method | Signature | Notes |
|--------|-----------|-------|
| `modeling.updateProperties` | `(uri, elementId, properties) → void` | Update element properties (undoable) |
| `modeling.removeElement` | `(uri, elementId) → void` | Remove element (undoable) |
| `modeling.appendElement` | `(uri, sourceId, descriptor) → { elementId }` | Append connected element (undoable) |
| `modeling.createConnection` | `(uri, sourceId, targetId, type?) → { connectionId }` | Create sequence flow (undoable) |
| `modeling.moveElement` | `(uri, elementId, delta) → void` | Move element by delta (undoable) |

**Palette/Context Pad contributions** (requires `bpmn.modelling`):

| Method | Signature | Notes |
|--------|-----------|-------|
| `registerPaletteEntry` | `(entry) → void` | Runtime palette entry registration |
| `unregisterPaletteEntry` | `(id) → void` | Remove a palette entry |
| `registerContextPadEntry` | `(entry) → void` | Runtime context pad entry registration |
| `unregisterContextPadEntry` | `(id) → void` | Remove a context pad entry |
| `updateContextPadEntry` | `(id, update) → void` | Update elementIds/elementTypes dynamically |

Manifest equivalents: `contributes.bpmnPalette` and `contributes.bpmnContextPad` in `package.json`.

**Renderer module messaging** (requires `bpmn.renderer`):

| Method | Signature | Notes |
|--------|-----------|-------|
| `postToRendererModule` | `(data) → void` | Send message to renderer-injected module |
| `onRendererModuleMessage` | `(callback) → Disposable` | Subscribe to messages from renderer module |

Manifest: `contributes.bpmnModules` declares JS bundles injected into the renderer.

Files:
- `studio/src/modules/bpmn-core/plugin-modules/PluginChannel.ts` — per-plugin bidirectional message channel
- `studio/src/modules/bpmn-core/plugin-modules/PluginModuleLoader.ts` — loads plugin renderer modules
- `studio/src/modules/bpmn-core/plugin-contributions/PluginBpmnContributionStore.ts` — palette/context pad registry
- `studio/src/modules/bpmn-core/plugin-contributions/PluginPaletteProvider.ts` — diagram-js palette multiplexer
- `studio/src/modules/bpmn-core/plugin-contributions/PluginContextPadProvider.ts` — diagram-js context pad multiplexer

See [plugin-bpmn-enrichment.md](plugin-bpmn-enrichment.md) for the full architecture.

### Command namespacing

Commands registered by plugins are automatically prefixed with `plugin.<pluginName>.` to prevent collisions with module commands.

**Namespace convention (Phase 7)**:

- Plugin registers `greet` → public ID becomes `plugin.happy-plugin.greet`
- Plugin executes `greet` via `api.commands` → resolved to `plugin.happy-plugin.greet`
- Plugin executes `std.notifications.show` → passes through unchanged (known command group); access is enforced by `CommandDenylist` + `PermissionGate`

### Command access control (`CommandDenylist`)

`PluginHostBridge` calls `checkCommandAccess()` before `executeCommand` / `tryToExecuteCommand` from plugin API requests. Rules:

| Rule | Commands |
|------|----------|
| **Hard-denied** (no permission can grant) | `git.*`, `engine.*`, `plugins.*`, `dev.*`, plus `std.solution.*`, `std.window.*`, `std.internal.*`, `std.test.*` |
| **Permission-gated** | `std.*` → `commands.std`; `bpmn.*` (except modeler register) → `commands.bpmn`; `dmn.*` → `commands.dmn`; `bpmn.modeler.registerModule` / `dmn.modeler.registerModule` → `bpmn.renderer` (legacy alias: `renderer-modules`); `api.bpmn.modeling.*` → `bpmn.modelling`; `api.bpmn.postToRendererModule` / `api.bpmn.onRendererModuleMessage` → `bpmn.renderer` |
| **Always allowed** | `plugin.<pluginName>.*` (own commands) |

Failures throw `CommandBlockedError` or `PermissionDeniedError`, serialized back to the worker as API errors.

### Callback dispatch

Each Worker Thread maintains its own callback registry. When a `PH_CALLBACK_INVOCATION` arrives at `plugin-host-main.ts`, `SandboxManager.routeCallback()` forwards it to the owning plugin's Worker (tracked via `callbackRouter`). The worker resolves the callback and invokes it inside the compartment.

## Renderer Bridge

`PluginHostBridge` runs in the renderer process and executes API requests against the real `Bifrost` instance. It is created internally by `PluginHost` — no separate initialization needed.

### IPC caller attestation

`ApiRequestPayload` includes an optional `pluginName` field. Plugin code inside a Worker cannot set this field in a way the renderer trusts: `SandboxManager.handleWorkerMessage()` **overwrites** `pluginName` on every `PH_API_REQUEST` at the Worker message boundary before forwarding to the renderer. `PluginHostBridge` uses the attested name for permission checks, settings write scoping, and workspace path validation.

### Permission gate (`PermissionGate`)

When a plugin loads, `PluginHost` registers its manifest `permissions` array on `bridge.permissionGate`. Handlers call `permissionGate.assert(pluginName, permission, context)` before gated operations (filesystem API, command groups, etc.). On unload, `permissionGate.unregister(pluginName)` runs.

Seven explicit permissions (declared in `bifrostStudio.permissions` in `package.json`):

| Permission | Grants |
|------------|--------|
| `filesystem` | `workspace.*` API; `require('fs')` inside the Worker (via `ModuleGate`) |
| `commands.std` | Execute `std.*` commands (subject to hard-deny subpatterns) |
| `commands.bpmn` | Execute `bpmn.*` commands |
| `commands.dmn` | Execute `dmn.*` commands |
| `bpmn` | Read BPMN elements, subscribe to events, place overlays |
| `bpmn.modelling` | All of `bpmn` + model modification + palette/context pad contributions |
| `bpmn.renderer` | All of `bpmn.modelling` + inject diagram-js modules into renderer |
| `native` | Load `.node` native addons via `require()` |
| `system-info` | `require('os')` (safe subset only, via `ModuleGate`) |

`PluginPermissionDialog` (`showPermissionReviewDialog`) is invoked on all plugin activation paths (eager startup, lazy activation, reload/re-enable, quarantine recovery). The dialog is **skipped** when: (a) the plugin requests zero permissions, (b) the global kill switch `plugins.permissions.showDialogOnEnable` is `false`, or (c) the `PluginPermissionStore` has a trusted record whose permission set matches the current manifest exactly. The dialog includes a "Trust this plugin permanently" checkbox; on acceptance, `PluginPermissionStore` persists the approved permission set and trust flag in local storage (`bifrost.getLocalStorage('PluginPermissions')`). If a trusted plugin's permissions change between versions, the dialog re-appears showing added/removed permissions. `trustAndReEnablePlugin` clears the trust record before reloading so the user always re-confirms after quarantine.

### Settings isolation (Phase 7)

- **Write**: Plugins may only write `plugin.<name>.*` keys (`PermissionGate` / bridge validation)
- **Read**: Unrestricted (user preferences, not secrets)
- **Register**: Descriptor keys must start with `plugin.<name>.`

- **API requests**: Dispatched to namespace-specific handlers (commands, diagnostics, dialogs, notifications, settings, webviews, editors, panes, statusBar, menuBar, menus, workspace, views, themes, bpmn). The `bpmn` namespace is handled by `BpmnApiBridge` and enforces tiered permissions (`bpmn` → `bpmn.modelling` → `bpmn.renderer`).
- **Command registration**: Handled via `PH_REGISTER_CALLBACK` with `namespace: 'commands'` and `method: 'register'`. The bridge creates a proxy handler in `bifrost.commands` that forwards invocations to the plugin Worker via `PH_CALLBACK_INVOCATION`. Manifest stub commands are unregistered and replaced when the real handler registers.
- **Settings change listeners**: Subscribes to `EVENT_SETTINGS_CHANGED` with key filtering, invokes callbacks via the connection.
- **Webview messaging**: `postMessage` forwards data to `PluginIframeManager.postMessageToIframe()`. `onMessage` sets a `messageHandler` on the iframe entry which routes incoming iframe messages back to the child process via `PH_CALLBACK_INVOCATION`. `createPanel` returns a deterministic `iframeId`.
- **Editor document registration**: `registerWebviewDocumentType` creates a `IframeDocumentRenderer` constructor pre-bound with the plugin context and registers it via `bifrost.editors.registerDocumentType()`. `openDocument` delegates to `bifrost.editors.focusOrOpenEditorDocument()`. `onDidOpen` callbacks are stored in a map and fired when the renderer mounts.
- **Status bar ID namespacing**: Registration IDs are prefixed with `plugin.<pluginName>.` at the bridge level to prevent cross-plugin collisions within `StatusBarManager`.
- **Menu update triggers**: After registering or disposing menu modifiers, the bridge calls `updateMenus()` / `updateMenuBarItems()` / `updateStatusBarItems()` to ensure the UI reflects changes immediately.

## Plugin Loading

### Discovery

Plugins are discovered in the configured plugins directory:
1. `BFR_PLUGINS_DIR` environment variable (if set)
2. Fallback: `~/.evil/<channel>/plugins/` (via `getBifrostHomeDir()`)

Each subdirectory with a `package.json` is treated as a plugin candidate. On child-process startup, `SandboxManager.initialize()` loads persisted quarantine state from `quarantine.json` under the plugin storage base path. Quarantined plugins are skipped during `loadPlugin` until the user calls `trustAndReEnablePlugin`.

### Worker load pipeline

When the renderer sends `PH_LOAD_PLUGIN` / `PH_RELOAD_PLUGIN`:

1. Renderer validates manifest and (on enable) may show `PluginPermissionDialog`; permissions are registered on `PermissionGate`.
2. `plugin-host-main` delegates to `SandboxManager.loadPlugin({ pluginName, pluginPath, permissions })`.
3. `PluginSandbox` spawns a Worker Thread running `sandbox-worker.ts` with `workerData` (paths + permission list).
4. Worker runs SES `lockdown()`, builds `ModuleGate`-wrapped `require`, creates a `Compartment` with a frozen `process` subset and no `fetch` / `XMLHttpRequest` / `WebSocket`.
5. Worker `require(mainPath)` and calls `activate(api)` (or `default.activate(api)`); the inline `createPluginApi()` (in `sandbox-worker.ts`) proxies API calls as `PH_API_REQUEST` messages via `sendApiRequest()`.
6. On success, renderer sets `PluginInfo.status` to `'loaded'` (or `'pending'` for lazy activation).

Unload/reload terminates the Worker; there is no shared activation state between plugins.

### Metadata enrichment

During discovery, the following additional metadata is extracted from each plugin's `package.json` and stored in `PluginInfo`:

| Field | Source | Fallback |
|-------|--------|----------|
| `logoPath` | `<pluginDir>/LOGO.png` | `pkg.logo` (resolved relative to plugin dir, must be `.png`) |
| `homepage` | `pkg.homepage` | URL from `pkg.author` (object `.url` or parsed from string `(url)` syntax) |
| `keywords` | `pkg.keywords` (must be `string[]`) | `undefined` |
| `deprecated` | `pkg.deprecated` | `undefined` (`false` and empty strings are normalized to `undefined`) |

The `author` field supports both npm formats: string (`"Name <email> (url)"`) and object (`{ name, email, url }`). A `parseAuthorString` helper extracts the name and URL from the string format.

### Storage

Plugin storage uses OS-specific cache directories:

| OS | Base path |
|----|-----------|
| Linux | `~/.cache/evil-studio-<channel>/plugin-storage/<pluginName>/` |
| macOS | `~/Library/Caches/evil-studio-<channel>/plugin-storage/<pluginName>/` |
| Windows | `%LOCALAPPDATA%\evil-studio-<channel>\Cache\plugin-storage\<pluginName>\` |

Override with `EVIL_PLUGIN_STORAGE_PATH` environment variable.

## Crash Recovery

Crash handling operates at two levels: the **Plugin Host child process** (entire host died) and **individual plugin Worker Threads** (one plugin misbehaved).

### Child process crash

If the Plugin Host child process exits unexpectedly:

1. Increment crash counter within a 60-second sliding window.
2. Notify the user via `bifrost.notifications`.
3. If fewer than 3 crashes: restart with exponential backoff (1s, 2s, 4s) and **re-discover** plugins from disk (respecting current `disabledPlugins` setting and persisted quarantine list). This handles plugins deleted mid-session.
4. If 3+ crashes: disable plugins permanently until the Studio is restarted.

### Per-plugin Worker crash and quarantine

When a plugin's Worker Thread exits unexpectedly, `SandboxManager` removes the sandbox, increments crash counts, and sends `PH_PLUGIN_CRASHED` to the renderer with `{ pluginName, exitCode, quarantined, crashCount }`.

`QuarantineManager` tracks crashes per plugin in a sliding window (configurable via settings — default **3 crashes in 60 seconds**). When the threshold is exceeded:

- The plugin is persisted to `quarantine.json` under plugin storage
- `PluginHost` sets `PluginInfo.status` to **`'quarantined'`** with an `errorMessage`
- `SandboxManager.loadPlugin` skips the plugin on subsequent discovery until quarantine is cleared
- The user sees an error notification

**Recovery**: `bifrost.plugins.trustAndReEnablePlugin(name)` (renderer `PluginHost.trustAndReEnablePlugin`):

1. Sends `PH_TRUST_AND_REENABLE` → `SandboxManager.trustAndReEnable` → `QuarantineManager.trustAndReEnable` (clears persisted quarantine)
2. Sets `PluginInfo.status` to `'pending'` and clears `errorMessage`
3. Calls `reloadPlugin(name)` to spawn a fresh Worker

The Plugins pane exposes **Trust & Re-enable** on quarantined cards (`PluginCard` → `onTrustAndReEnable`).

Below the quarantine threshold, a crash emits a warning notification but does not change status to `'quarantined'`; the plugin may be reloaded manually.

### Logging

`PluginHostLogger` captures all stdout/stderr from the child process into a 10,000-line ring buffer, available for diagnostic display.

## Cross-Window Plugin State Synchronization

Each Studio window runs its own Plugin Host child process and `PluginService` instance. When a plugin is installed, uninstalled, enabled, disabled, or manually refreshed in one window, the change must propagate to all other open windows.

### IPC relay flow

1. **Sender**: `PluginService.notifyPluginStateChanged(action, pluginName)` sends `IPC_MESSAGE_PLUGIN_STATE_CHANGED` via `ipcRenderer.send()` to the main process.
2. **Main process**: `entrypoint-electron-main.ts` listens for this channel and calls `BifrostAppManager.relayToOtherWindows()`, which iterates all `BifrostWindow` instances and sends the message to every `webContents` except the sender (identified by `webContents.id`).
3. **Receivers**: Each window's `PluginService.listenForCrossWindowChanges()` listens for incoming `IPC_MESSAGE_PLUGIN_STATE_CHANGED` and triggers `debouncedResync()`.

### Debounced resync

Rapid successive changes (e.g., bulk enable/disable) are coalesced with a 500ms debounce. The resync:
1. Clears the logo cache (in case plugin icons changed).
2. Calls `pluginHost.refresh()` to re-discover and reload from disk.
3. Calls `closeOrphanedReadmeTabs()` to close any readme tabs for removed/disabled plugins.
4. Emits `EVENT_PLUGIN_LIST_CHANGED` so the Plugins pane re-renders.

### State change triggers

| Action | Called from | Notification emitted |
|--------|-----------|---------------------|
| Enable/Disable | `PluginService.togglePlugin()` | `enable` / `disable` |
| Uninstall | `PluginService.uninstallPlugin()` | `uninstall` |
| Disable (error quarantine) | `PluginService.disablePlugin()` | `disable` |
| Trust & re-enable | `PluginService.trustAndReEnablePlugin()` | (reload in this window only) |
| Refresh | `PluginService.refreshFromHost()` | `refresh` |

### Files

- `studio/src/bifrost/contracts/IpcEvents.ts` — `IPC_MESSAGE_PLUGIN_STATE_CHANGED`
- `studio/src/bifrost/electron-main/entrypoint-electron-main.ts` — relay handler
- `studio/src/bifrost/electron-main/BifrostAppManager.ts` — `relayToOtherWindows()`
- `studio/src/bifrost/electron-main/BifrostWindow.ts` — `getWebContentsId()`
- `studio/src/bifrost/common/plugin-host/PluginService.ts` — `notifyPluginStateChanged()`, `listenForCrossWindowChanges()`, `debouncedResync()`

## Plugin Iframe Infrastructure

Plugins can render custom UI inside isolated `<iframe>` containers served by a custom Electron protocol. This infrastructure (Phase 3, Batch 3.1) provides the rendering surface for iframe-backed editor documents and panes.

### Custom Protocol — `evil-webview://`

Registered in `entrypoint-electron-main.ts` via `protocol.registerSchemesAsPrivileged` (before `app.ready`) and `protocol.handle` (inside `app.ready`). The scheme name follows the release channel pattern: `evil-webview` (stable) or `evil-webview-<channel>`.

Each plugin gets a unique origin: `evil-webview://<pluginName>/`. The hostname encodes the plugin name; the pathname is resolved relative to the plugin's install directory (`getPluginsDir()/<pluginName>/`).

**Special path**: `/studio-bridge.js` is served from the app bundle directory (`out/studio-bridge.js`) — not from the plugin's folder.

**Plugin name validation**: The hostname (plugin name) is validated against an allowlist pattern (`/^[@a-z0-9][@a-z0-9._-]*$/`) to reject `.`, `..`, path separators, and other escape sequences before any filesystem access.

**Path validation**: `path.resolve()` + `path.relative()` boundary check prevents path traversal attacks. The resolved path is converted to a relative path from the plugin root; if the relative path starts with `..` or is absolute, the request is rejected with 403.

**Security headers**: Every response carries a `Content-Security-Policy` header (`default-src 'none'`, plugin-scoped `script-src`/`style-src`/`img-src`/`font-src`/`connect-src`). All resource directives are scoped to the plugin's own origin (`evil-webview://<plugin>`), preventing access to external networks or other plugins. `X-Frame-Options` is intentionally omitted because the parent (renderer at `evil-studio://`) and the iframe (`evil-webview://<plugin>`) are cross-origin by design, and clickjacking protection is not applicable for a desktop application.

### PluginIframeManager

Singleton service (`studio/src/components/webview/PluginIframeManager.ts`) tracking all active plugin iframes. Owned by `PluginHost`, not directly accessible from `bifrost.plugins`. Provides:

- `register(iframeId, pluginName, panelRef)` / `unregister(iframeId)` — lifecycle management
- `handleIframeMessage(iframeId, data)` — routes incoming postMessages from iframes
- `postMessageToIframe(iframeId, data)` — sends messages to a specific iframe
- `setMessageHandler(iframeId, handler)` — sets per-iframe callback (used by PluginHostBridge)
- `setState(iframeId, state)` / `getState(iframeId)` — renderer-side state persistence
- `broadcastThemeTokens(tokens, themeType)` — broadcasts theme CSS variables to all iframes
- `disposePlugin(pluginName)` — cleans up all iframes for a plugin (on unload/disable)

### PluginIframe Component

React component (`studio/src/components/webview/PluginIframe.tsx`) wrapping a sandboxed `<iframe>`. Attributes:

- `src`: `evil-webview://<pluginName>/<entryPoint>`
- `sandbox`: `"allow-scripts allow-same-origin"` (no navigation, popups, modals, or forms)

Validates `event.origin` on every incoming `message` event. Registers/unregisters with `PluginIframeManager` on mount/unmount. Renders a "Plugin UI crashed. Click to reload." fallback on error.

### Bridge Script

`studio/src/components/webview/bridge-script.ts` — compiled as `studio-bridge.js` with `target: 'web'` (separate Rspack entry in `rspack.config.electron-main.js`). Runs in the iframe's main world with no Node.js access. Exposes:

```
window.acquireStudioApi() → { postMessage, onMessage, setState, getState, getThemeType }
```

Handles incoming `restore-state` and `theme` messages from the host renderer.

### Protocol Plumbing

The `webviewProtocol` scheme name flows from the Electron main process to the renderer:

1. `entrypoint-electron-main.ts` computes `webviewProtocolName` and includes it in `BifrostAppManager` window args
2. `BifrostWindow` serializes it into the URL `windowOptions` query param
3. `entrypoint-electron-renderer.tsx` reads it and passes it to `BifrostOptions.webviewProtocol`
4. `Bifrost` stores it in `Environment.webviewProtocol`
5. `PluginHost` reads it from `this.bifrost.env.webviewProtocol`

## Security Model

### Process and IPC boundary

- **No DOM access** — Plugin Host is a plain Node.js process, not a browser context.
- **No `window` global** — Eliminates the class of bugs from the legacy bridge.
- **No Electron APIs** — `target: 'node'` in Rspack config; `ELECTRON_RUN_AS_NODE=1` at fork time.
- **No shared memory** — All data flows through serializable IPC messages.
- **IPC caller attestation** — `SandboxManager` stamps `pluginName` on API requests at the Worker boundary; plugins cannot impersonate another plugin on the bridge.
- **Command namespacing** — Prevents plugins from shadowing module commands.
- **`CommandDenylist`** — Hard-blocks infrastructure command groups; permission-gates module command namespaces.

### JavaScript sandbox (Phase 7, per plugin)

- **Worker Thread isolation** — One Worker per plugin; crash or infinite loop in one plugin does not tear down the whole host (subject to quarantine policy).
- **SES `lockdown()`** — Freezes intrinsics to mitigate prototype pollution.
- **`Compartment`** — Restricted global: no `eval`, no `Function()`, no `SharedArrayBuffer`.
- **`ModuleGate`** — Replaces raw `require()`; blocks `child_process`, `net`, `http`, etc.; gates `fs`, `os`, native modules by manifest permission.
- **Frozen `process` subset** — Only `platform`, `arch`, `version`, `versions` exposed inside the compartment.
- **No network globals** — `fetch`, `XMLHttpRequest`, `WebSocket` are `undefined` in the sandbox global.
- **Manifest permissions** — Undeclared capabilities denied at runtime via `PermissionGate` on the renderer.

### Webview / iframe boundary

- **Per-plugin iframe origin isolation** — Each plugin's iframe runs at `evil-webview://<name>/`, preventing cross-plugin DOM/storage access and parent DOM access.
- **Iframe sandbox** — `allow-scripts allow-same-origin` only; top navigation, popups, modals, and forms are blocked.
- **CSP response headers** — External script loading and network exfiltration blocked via `Content-Security-Policy`.
- **Path traversal protection** — Protocol handler validates all resolved paths against the plugin's root directory.
- **`ScopedPluginName`** — Maps npm scoped names (`@scope/name`) to safe hostname segments for `evil-webview://` origins.

## Plugins Module (Management UI)

The `plugins` internal module (`studio/src/modules/plugins/`) provides the user-facing management interface for installed plugins. It interacts exclusively with `bifrost.plugins` (`PluginService`) — never with `PluginHost` directly.

### Pane

The Plugins pane appears in the left sidebar after Git. It shows a card for each discovered plugin displaying logo (if available), name, version, description, and author. Visual indicators warn about deprecated plugins (yellow `ph-warning` icon) and missing author information (orange `ph-warning` icon). An empty state is shown when no plugins are installed.

The pane subscribes to `bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED, ...)` to re-render when the plugin list changes (enable/disable/uninstall/refresh/quarantine).

`PluginInfo.status` includes `'loaded' | 'pending' | 'disabled' | 'error' | 'quarantined'` (see `studio-sdk/src/contracts/PluginTypes.ts`). Quarantined plugins show a **Quarantined** badge and a **Trust & Re-enable** action that calls `bifrost.plugins.trustAndReEnablePlugin(name)`.

Clicking a plugin card opens its README as an editor tab (`about:plugin-readme/<pluginName>`). The README detail view shows a header with the plugin logo, name, version, description, deprecation status, and a metadata sidebar (author, website link, keyword tags), followed by the rendered README content.

The pane header includes a **Refresh** button (`PaneHeaderIcon` wired to `plugins.refreshPluginList`) that triggers a full Plugin Host restart via `bifrost.plugins.refreshFromHost()`.

### Wrench context menu

Each plugin card has a wrench icon button (top-right corner of the header row). Clicking it opens a context menu with the following actions:

| Entry | Behavior |
|-------|----------|
| **Enable / Disable** | Calls `bifrost.plugins.togglePlugin(name)`. For disabled or errored plugins, this calls `reloadPlugin()` which re-validates the manifest from disk and either recovers or preserves the error state. For running plugins, it disables via `unloadPlugin()`. Updates `plugins.disabledPlugins` setting accordingly. Disabling also closes the plugin's README tab if open. Does not clear quarantine — use **Trust & Re-enable** when `status === 'quarantined'`. |
| **Settings** | Opens the Settings GUI (`about:settings`). If the plugin registered settings whose `category` (explicit or inferred from the first key segment) matches the plugin's `displayName`, auto-scrolls to that category via `std.settings.openUserSettingsAtCategory`. Otherwise opens the GUI without scrolling. |
| **Uninstall** | Calls `bifrost.plugins.uninstallPlugin(info)`. Opens a confirmation dialog. On confirmation, the enabled plugin is unloaded via the host, the README tab is closed, the plugin directory is moved to trash via `IPC_INVOKE_UNINSTALL_PLUGIN` (main process `shell.trashItem`), and the plugin is removed from `disabledPlugins` and the in-memory list. Uses `suppressHostSync` to prevent intermediate UI flashes. |

The menu closes on outside click or after any action is selected. All menu button clicks call `stopPropagation()` to prevent the card's click handler (open README) from firing.

### Refresh behavior

**Full refresh** (`bifrost.plugins.refreshFromHost()`, triggered by the pane's Refresh button or initial load):

1. **Logo cache clearing** — `clearLogoCache()` invalidates the module-level `Map` in `usePluginLogo`, forcing all logo images to be re-read from disk on next render.
2. **Plugin list update** — `pluginHost.refresh()` restarts the child process and re-discovers plugins. `PluginHost` emits `EVENT_PLUGIN_LIST_CHANGED`, `PluginService` syncs and re-emits.
3. **Orphaned README tab cleanup** — Any open `about:plugin-readme/<name>` editor documents whose plugin is no longer in the discovered list are closed automatically.

**Selective operations** (toggle enable/disable, uninstall):

- **Toggle** calls `bifrost.plugins.togglePlugin(name)`, which delegates to `pluginHost.unloadPlugin()` or `pluginHost.reloadPlugin()` to affect only the target plugin. Errored plugins are retried via `reloadPlugin()` (which re-validates the manifest from disk). Other plugins retain their registered commands, settings listeners, and state. The logo cache entry for the toggled plugin is cleared via `clearLogoCacheEntry()`.
- **Uninstall** calls `bifrost.plugins.uninstallPlugin(info)`. Uses `suppressHostSync` to suppress intermediate host events during the multi-step operation (unload + trash + list update), then emits a single `EVENT_PLUGIN_LIST_CHANGED` after the operation completes.

### Plugin Host Console Pane

The Plugin Host Console pane surfaces `stdout`/`stderr` output from the Plugin Host child process. It is registered in the `bottom` area under the `console` group.

**Data flow**: `PluginHost` writes to `PluginHostLogger` (10k-line ring buffer) → `IPluginHost.onLog()` fires → `PluginService` emits `EVENT_PLUGIN_HOST_LOG` → `PluginHostConsolePaneRenderer` appends the line to its React state.

**API on `PluginService`**:

| Method | Returns | Description |
|--------|---------|-------------|
| `getPluginHostLog()` | `string[]` | Current buffer contents (snapshot) |
| `onPluginHostLog(handler)` | `AbstractSubscription` | Subscribe to new log lines |
| `clearPluginHostLog()` | `void` | Clear the buffer |

**Timestamps**: `PluginHostLogger.append()` prefixes every line with `[HH:MM:SS.mmm]` at capture time. All lines in the buffer and emitted via `onLog` include this timestamp.

**Pane features**: Auto-scrolls to bottom (with automatic pin-to-bottom toggle based on scroll position), multi-select plugin name dropdown filter (populated from `bifrost.plugins.getPluginList()`, filters lines containing selected plugin names), text filter in the tab header, clear button, stderr lines highlighted in red.

### Commands

| Command | Description |
|---------|-------------|
| `plugins.focusPluginsPane` | Opens the Plugins pane |
| `plugins.showConsole` | Opens the Plugin Host Console pane |
| `plugins.refreshPluginList` | Full Plugin Host restart + re-discovery |
| `plugins.openPluginFolder` | Opens the plugins directory in the system file manager |

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `plugins.disabledPlugins` | `string[]` | `[]` | Plugin names that are disabled and not loaded on startup |
| `plugins.permissions.showDialogOnEnable` | `boolean` | `true` | Global kill switch for `PluginPermissionDialog` (when `false`, all plugins are silently allowed) |
| `plugins.quarantine.enabled` | `boolean` | `true` | Enable automatic quarantine after repeated Worker crashes |
| `plugins.quarantine.maxCrashes` | `number` | `3` | Crashes within the window before quarantine |
| `plugins.quarantine.windowMs` | `number` | `60000` | Sliding window for crash counting (ms) |

## File Map

| File | Process | Role |
|------|---------|------|
| `studio/rspack.config.electron-main.js` | Build | `configPluginHost` entry |
| `studio/rspack.config.electron.js` | Build | `configElectronRenderer` with `node.__dirname: false` |
| `studio/src/bifrost/Bifrost.ts` | Renderer | `plugins: PluginService` property, `plugins.initialize()` in Bifrost.initialize() |
| `studio/src/bifrost/contracts/BifrostTypes.ts` | Shared | `pluginHostConstructor` option (produces `IPluginHost`, wrapped by `PluginService`) |
| `studio/src/bifrost/contracts/PluginHostTypes.ts` | Shared | `IPluginHost` (incl. `trustAndReEnablePlugin`), `PluginInfo.status` (`quarantined`, etc.), protocol payloads |
| `studio/src/bifrost/common/plugin-host/PluginService.ts` | Renderer | Public facade (`bifrost.plugins`): toggle, uninstall, `trustAndReEnablePlugin`, refresh, `AbstractEmitter`, logo cache, `suppressHostSync` |
| `studio/src/bifrost/common/plugin-host/NullPluginHost.ts` | Shared | No-op `IPluginHost` implementation for non-Electron targets |
| `studio/src/bifrost/common/CommandManager.ts` | Renderer | `unregister()` method for plugin command cleanup |
| `studio/src/bifrost/electron-renderer/plugin-host/PluginHost.ts` | Renderer | Implements `IPluginHost`: child process lifecycle, discovery, `refresh()`, host + per-plugin crash handling, `trustAndReEnablePlugin`, permission registration, owns `PluginIframeManager` |
| `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` | Renderer | Per-plugin callback tracking, `PermissionGate`, `CommandDenylist` enforcement, `PluginIframeManager` |
| `studio/src/bifrost/electron-renderer/plugin-host/PluginHostLogger.ts` | Renderer | Stdout/stderr ring buffer |
| `studio/src/components/webview/PluginIframe.tsx` | Renderer | React component wrapping sandboxed `<iframe>` with origin validation and crash recovery |
| `studio/src/components/webview/PluginIframeManager.ts` | Renderer | Service tracking active plugin iframes, state persistence, theme broadcasting |
| `studio/src/components/webview/bridge-script.ts` | Iframe (web) | Bridge script exposing `acquireStudioApi()` inside plugin iframes |
| `studio/src/components/webview/types.ts` | Shared | Type definitions for iframe postMessage protocol |
| `studio/src/bifrost/contracts/PluginHostConnection.ts` | Shared | Promise-based request/response wrapper |
| `studio/src/bifrost/contracts/PluginHostProtocol.ts` | Shared | Message type definitions and constants |
| `studio/src/bifrost/contracts/IpcEvents.ts` | Shared | `IPC_INVOKE_UNINSTALL_PLUGIN`, `IPC_MESSAGE_PLUGIN_STATE_CHANGED` constants |
| `studio/src/bifrost/common/plugin-host/plugin-host-main.ts` | Host | Child process entry point; owns `SandboxManager`, IPC dispatch |
| `studio/src/bifrost/common/plugin-host/sandbox/SandboxManager.ts` | Host | Per-plugin Worker orchestration, API attestation, quarantine integration |
| `studio/src/bifrost/common/plugin-host/sandbox/PluginSandbox.ts` | Host | Single Worker Thread wrapper (`start` / `stop` / `terminate`) |
| `studio/src/bifrost/common/plugin-host/sandbox/sandbox-worker.ts` | Worker | SES lockdown, Compartment, `ModuleGate`, `activate()`. Builds the plugin-facing API inline via `createPluginApi()` (namespaces: `commands`, `bpmn`, `editors`, `workspace`, `settings`, `notifications`, `dialogs`, `panes`, `statusBar`, `menuBar`, `menus`, `views`, `themes`, `webviews`, `events`, `diagnostics`, `env`), proxying calls as `PH_API_REQUEST` via `sendApiRequest()`. Message handler registered **before** `activate()` so API responses can be processed during activation. |
| `studio/src/bifrost/common/plugin-host/sandbox/ModuleGate.ts` | Worker | Permission-gated `require()` factory |
| `studio/src/bifrost/common/plugin-host/sandbox/QuarantineManager.ts` | Host | Crash counting, `quarantine.json` persistence, `trustAndReEnable` |
| `studio/src/bifrost/common/plugin-host/sandbox/PluginHealthReport.ts` | Host | Health metric types for sandbox state |
| `studio/src/bifrost/common/plugin-host/permissions/PermissionTypes.ts` | Shared | `PluginPermission` union, `ALL_PERMISSIONS`, `PERMISSION_HIERARCHY` |
| `studio/src/bifrost/common/plugin-host/permissions/PermissionGate.ts` | Shared | Runtime permission sets (used in renderer bridge); hierarchy enforcement |
| `studio/src/bifrost/common/plugin-host/permissions/CommandDenylist.ts` | Shared | Command hard-deny and permission-gated groups |
| `studio/src/bifrost/common/plugin-host/permissions/PermissionDisplay.ts` | Shared | Human-readable permission labels, descriptions, risk levels for dialog |
| `studio/src/modules/bpmn-core/plugin-modules/PluginChannel.ts` | Renderer | Per-plugin bidirectional message channel for renderer modules |
| `studio/src/modules/bpmn-core/plugin-modules/PluginModuleLoader.ts` | Renderer | Loads plugin-provided diagram-js module bundles into the renderer |
| `studio/src/bifrost/common/plugin-host/permissions/ScopedPluginName.ts` | Shared | Scoped npm name normalization (`@scope/name` → `scope--name`); used at discovery time and for webview hostname mapping |
| `studio/src/bifrost/electron-renderer/plugin-host/PluginPermissionDialog.ts` | Renderer | Permission review dialog on enable/reload |
| `studio/src/bifrost/common/plugin-host/PluginPermissionStore.ts` | Shared | Local-storage-backed permission trust records (per plugin) |
| `studio/src/bifrost/common/plugin-host/callbackRegistry.ts` | Worker | Per-worker O(1) callback lookup inside `sandbox-worker.ts` |
| `studio/src/bifrost/electron-renderer/plugin-host/IframeDocumentRenderer.tsx` | Renderer | Factory creating iframe-backed editor document renderers (`createIframeDocumentRendererConstructor`) |
| `studio/src/bifrost/electron-renderer/plugin-host/IframePaneProvider.tsx` | Renderer | Factory creating iframe-backed pane providers (`createIframePaneProvider`) |
| `studio/src/bifrost/electron-renderer/plugin-host/TreeViewPaneProvider.tsx` | Renderer | Factory creating tree-view pane providers (`createTreeViewPaneProvider`) hosting the SDK `Tree` component |
| `studio/src/bifrost/electron-renderer/plugin-host/ActivationManager.ts` | Renderer | Event-driven lazy activation: subscribes to activation events, defers `PH_LOAD_PLUGIN` until trigger fires. Stores a `pendingActivations` promise so concurrent callers (e.g. stub callbacks) join an in-flight activation instead of returning early |
| `studio/src/bifrost/electron-renderer/plugin-host/manifest/ContributionRegistrar.ts` | Renderer | Processes `bifrostStudio.contributes` at discovery time: registers stub commands, icons, keybindings, menus, settings, pane placeholders, service task types, pane toggles, themes, bpmnPalette, bpmnContextPad, bpmnModules |
| `studio/src/bifrost/electron-renderer/plugin-host/manifest/PlaceholderPaneProvider.tsx` | Renderer | Pane UI showing "Activating plugin…" while the plugin is pending activation |
| `studio/src/bifrost/common/plugin-host/manifest/ManifestTypes.ts` | Shared | TypeScript interfaces for the `bifrostStudio` manifest section |
| `studio/src/bifrost/common/plugin-host/manifest/ManifestReader.ts` | Shared | Parser + validator for `bifrostStudio` in `package.json` |
| `studio/src/bifrost/common/plugin-host/manifest/ManifestSchema.json` | Reference | JSON Schema (draft-07) for documentation and external tooling |
| `studio/src/bifrost/common/plugin-host/manifest/ApiVersionCheck.ts` | Shared | Semver compatibility check between plugin and Studio API versions |
| `studio/src/bifrost/contracts/PluginApiVersion.ts` | Shared | `STUDIO_PLUGIN_API_VERSION` constant |
| `studio-sdk/src/webview/studio-webview-theme.css` | Reference | Documentation-only CSS listing available `--theme-*` tokens |
| `studio/src/modules/plugins/index.ts` | Renderer | Plugins module entry, registers pane/commands/settings/document type |
| `studio/src/modules/plugins/PluginsPaneRenderer.tsx` | Renderer | Pane UI with refresh header icon, subscribes to `bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED)` |
| `studio/src/modules/plugins/PluginHostConsolePaneRenderer.tsx` | Renderer | Plugin Host Console pane: shows real-time stdout/stderr from the Plugin Host child process via `PluginService.onPluginHostLog()` |
| `studio/src/modules/plugins/PluginCard.tsx` | Renderer | Plugin card with logo, status badges (`quarantined`, etc.), Trust & Re-enable, wrench menu |
| `studio/src/modules/plugins/PluginInfoPropertyPane.tsx` | Renderer | Property pane detail for selected plugin (health / metadata) |
| `studio/src/modules/plugins/PluginReadmeRenderer.tsx` | Renderer | README detail view with logo, deprecation, metadata sidebar |
| `studio/src/modules/plugins/usePluginLogo.ts` | Renderer | Shared React hook: async logo loading with module-level cache |
| `studio/src/modules/plugins/plugins.scss` | Renderer | Pane, card, and README viewer styles |
| `studio-sdk/src/plugin-api/` | SDK | Type-only interfaces for the Plugin API (`StudioPluginApi`, sub-APIs, manifest types, webview types) — developer-facing contracts |
| `studio-sdk/src/plugin-api/DiagnosticsApi.ts` | SDK | `DiagnosticsApi` interface |
| `studio-sdk/src/plugin-api/DialogsApi.ts` | SDK | `DialogsApi` interface |
| `studio-sdk/src/plugin-api/StatusBarApi.ts` | SDK | `StatusBarApi` interface |
| `studio-sdk/src/plugin-api/MenuBarApi.ts` | SDK | `MenuBarApi` interface |
| `studio-sdk/src/plugin-api/MenusApi.ts` | SDK | `MenusApi` interface |
| `studio-sdk/src/contracts/StatusBarTypes.ts` | SDK | `StatusBarItem` types for plugin API |
| `studio-sdk/src/contracts/MenuBarTypes.ts` | SDK | `MenuBarItem` types for plugin API |
| `tools/create-evil-plugin/` | Tooling | Scaffold generator CLI for creating new plugin projects |
| `docs/plugin-development-guide.md` | Docs | Comprehensive guide for plugin developers |
