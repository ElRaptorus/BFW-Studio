# Plugin Host

## Overview

The Plugin Host is a process-isolated runtime for external plugins. Each renderer window owns its own Plugin Host instance, forking a dedicated child process. Inside that child process, **each plugin runs in its own Worker Thread** inside a **SES Compartment** (Secure EcmaScript). This three-layer model (renderer → child process → worker + compartment) aligns with VSCode/Cursor's Extension Host architecture while adding per-plugin JavaScript isolation.

| Layer | Target | Role |
|-------|--------|------|
| **Renderer** (`electron-renderer`) | Electron renderer | Bifrost instance, UI, `PluginService` facade, `PluginHost` lifecycle, `PluginHostBridge` (API execution), `PermissionGate`, `CommandDenylist` |
| **Plugin Host child process** (`plugin-host`) | Plain Node.js (`ELECTRON_RUN_AS_NODE`) | `SandboxManager` orchestration, IPC to renderer, `QuarantineManager` persistence |
| **Worker Thread** (`sandbox-worker.ts`, one per plugin) | `worker_threads` | SES `lockdown()`, `Compartment`, `ModuleGate`-gated `require()`, plugin `activate()` / `deactivate()` |
| **SES Compartment** | In-worker | Restricted global scope: no `eval`, no `Function()`, no network globals |

Plugins never execute in the renderer process. They communicate with Bifrost through a typed message protocol. Plugins have **no access** to the DOM, Electron APIs, or shared memory with the renderer — all interaction flows through serializable IPC messages. Caller identity on API requests is **attested** by `SandboxManager` (see _IPC caller attestation_ below); plugin code cannot forge `pluginName`.

**Host vs plugin types:** Internal Studio modules type `import type { Bifrost } from '#bifrost/Bifrost'`. Plugin authors type `StudioPluginApi` from `@evil/bifrost_fw_sdk`. The SDK is the plugin toolkit (API contract, POJO contracts, `ThemeToken` + documentation CSS, content controls). It is not a chrome kit — tab strips, pane shells, Tree, and host CodeMirror wrappers stay in the host. Plugins fill a hole in host chrome via `registerWebviewPane`, `registerWebviewDocumentType`, and `views.registerTreeView`.

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

### Sandbox orchestration

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
3. **Re-register contributions** — If validation passes, manifest contributions (commands, menus, keybindings, settings, panes, icons, bpmnPalette, bpmnContextPad, bpmnModules, dmnPalette, dmnContextPad, dmnModules) are re-registered via the `ContributionRegistrar`.
4. **Load or defer** — Plugins with `activationEvents`, or with a non-empty `contributes.editorDocumentTypes` (an implicit lazy trigger — see `hasLazyActivationTrigger` in `PluginHost.ts`), go to `status: 'pending'` (lazy). Others attempt an IPC `PH_RELOAD_PLUGIN`. IPC failures are caught and preserve the `error` state.

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
  // api.views, api.themes, api.bpmn, api.dmn, api.env
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

Method signatures live on `StudioPluginApi` in `@evil/bifrost_fw_sdk`. How-to examples: [plugin-development-guide.md](../plugin-development-guide.md). iframe protocol: [webviews.md](webviews.md). BPMN/DMN enrichment: [plugin-bpmn-enrichment.md](plugin-bpmn-enrichment.md) / [plugin-dmn-enrichment.md](plugin-dmn-enrichment.md).

Host-only facts:

- **Commands** — IDs are auto-prefixed `plugin.<name>.`. `enabledWhen` is not supported (sync/async boundary). Execute is gated by `CommandDenylist` (below).
- **Settings** — plugins may read any key; writes/register only `plugin.<name>.*`. `merge()` / `resetToDefault()` are not exposed.
- **Webviews** — `createPanel` is a stub. Implemented surfaces are editor documents and panes. Register `onMessage` before the iframe `load`.
- **Editors** — `registerWebviewDocumentType` uses `registerOrReplaceDocumentType` so it can overwrite a manifest placeholder. `onDidOpen` is a `PH_REGISTER_CALLBACK`. Unload unregisters the type and force-closes those tabs.
- **Dirty / save** — model-less documents use `EditorMediator.registerSaveDelegate(uri, callback)`. `setDirty` throws if the document is not open.
- **Workspace** — official file I/O; `ModuleGate` also gates raw `fs`. Prefer `api.workspace`.
- **Themes** — only `--theme-*` custom properties; injected as `<style>` on `.bifrost.bifrost-theme--<id>`.
- **Views** — push-only `PluginTreeItem[]`.
- **`bpmn` / `dmn`** — permission-gated; see the enrichment docs. `dmn` is DRD-only.

#### Static editor document type contributions (`contributes.editorDocumentTypes`)

`registerWebviewDocumentType` only runs inside `activate()`, so a type that only this plugin provides could never be opened first (unregistered URIs throw before `onDocumentType` can fire). The manifest contribution registers a **placeholder** at discovery (File Explorer `includedFilePatterns` apply immediately). Opening a matching file activates the plugin; `activate()` must call `registerWebviewDocumentType` with the same `id`, which replaces the placeholder and reopens the tab.

If the placeholder is still in `ContributionRegistrar.placeholderEditorDocumentTypeIds` after activation settles, the tab shows a terminal state (`activating` / `denied` / `failed` / `mismatch`) instead of hanging. Disabling a plugin unregisters the real type; the placeholder is **not** restored until re-enable. A non-empty `editorDocumentTypes` array is itself a lazy-activation trigger (`hasLazyActivationTrigger`).

See [plugin-manifest.md](plugin-manifest.md) and [common-pitfalls.md](common-pitfalls.md).

### Command namespacing

Commands registered by plugins are automatically prefixed with `plugin.<pluginName>.` to prevent collisions with module commands.

**Namespace convention**:

- Plugin registers `greet` → public ID becomes `plugin.happy-plugin.greet`
- Plugin executes `greet` via `api.commands` → resolved to `plugin.happy-plugin.greet`
- Plugin executes `std.notifications.show` → passes through unchanged (known command group); access is enforced by `CommandDenylist` + `PermissionGate`

### Command access control (`CommandDenylist`)

`PluginHostBridge` calls `checkCommandAccess()` before `executeCommand` / `tryToExecuteCommand` from plugin API requests. Rules:

| Rule | Commands |
|------|----------|
| **Hard-denied** (no permission can grant) | `git.*`, `engine.*`, `plugins.*`, `dev.*`, plus `std.solution.*`, `std.window.*`, `std.internal.*`, `std.test.*` |
| **Permission-gated** | `std.*` → `commands.std`; `bpmn.*` (except modeler register) → `commands.bpmn`; `dmn.*` (except modeler register) → `commands.dmn`; `bpmn.modeler.registerModule` / `dmn.modeler.registerModule` → `bpmn.renderer` (legacy alias: `renderer-modules`); `api.bpmn.modeling.*` → `bpmn.modelling`; `api.bpmn.postToRendererModule` / `api.bpmn.onRendererModuleMessage` → `bpmn.renderer`; `api.dmn.modeling.*` → `dmn.modelling`; `api.dmn.postToRendererModule` / `api.dmn.onRendererModuleMessage` → `dmn.renderer` |
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
| `dmn` | Read DMN DRD elements, subscribe to events, place overlays |
| `dmn.modelling` | All of `dmn` + model modification + DRD palette/context pad contributions |
| `dmn.renderer` | All of `dmn.modelling` + inject diagram-js modules into the DRD renderer |
| `native` | Load `.node` native addons via `require()` |
| `system-info` | `require('os')` (safe subset only, via `ModuleGate`) |

`PluginPermissionDialog` (`showPermissionReviewDialog`) is invoked on all plugin activation paths (eager startup, lazy activation, reload/re-enable, quarantine recovery). The dialog is **skipped** when: (a) the plugin requests zero permissions, (b) the global kill switch `plugins.permissions.showDialogOnEnable` is `false`, or (c) the `PluginPermissionStore` has a trusted record whose permission set matches the current manifest exactly. The dialog includes a "Trust this plugin permanently" checkbox; on acceptance, `PluginPermissionStore` persists the approved permission set and trust flag in local storage (`bifrost.getLocalStorage('PluginPermissions')`). If a trusted plugin's permissions change between versions, the dialog re-appears showing added/removed permissions. `trustAndReEnablePlugin` clears the trust record before reloading so the user always re-confirms after quarantine.

### Settings isolation

- **Write**: Plugins may only write `plugin.<name>.*` keys (`PermissionGate` / bridge validation)
- **Read**: Unrestricted (user preferences, not secrets)
- **Register**: Descriptor keys must start with `plugin.<name>.`

- **API requests**: Dispatched to namespace-specific handlers (commands, diagnostics, dialogs, notifications, settings, webviews, editors, panes, statusBar, menuBar, menus, workspace, views, themes, bpmn, dmn). The `bpmn` namespace is handled by `BpmnApiBridge` and enforces tiered permissions (`bpmn` → `bpmn.modelling` → `bpmn.renderer`). The `dmn` namespace is handled by `DmnApiBridge` and enforces the parallel tiered permissions (`dmn` → `dmn.modelling` → `dmn.renderer`), with every modeling/renderer operation additionally gated on the DRD view being active.
- **Command registration**: Handled via `PH_REGISTER_CALLBACK` with `namespace: 'commands'` and `method: 'register'`. The bridge creates a proxy handler in `bifrost.commands` that forwards invocations to the plugin Worker via `PH_CALLBACK_INVOCATION`. Manifest stub commands are unregistered and replaced when the real handler registers.
- **Settings change listeners**: Subscribes to `EVENT_SETTINGS_CHANGED` with key filtering, invokes callbacks via the connection.
- **Webview messaging**: `postMessage` forwards data to `PluginIframeManager.postMessageToIframe()`. `onMessage` sets a `messageHandler` on the iframe entry which routes incoming iframe messages back to the child process via `PH_CALLBACK_INVOCATION`. `createPanel` returns a deterministic `iframeId`.
- **Editor document registration**: `registerWebviewDocumentType` creates a `IframeDocumentRenderer` constructor pre-bound with the plugin context and registers it via `bifrost.editors.registerDocumentType()`. If `includedFilePatterns` is given, it also calls `bifrost.solution.registerDefaultIncludedFiles()`; both the document type and the include patterns are reverted together by the same `doctype:<documentTypeId>` disposer on plugin disable/reload/uninstall. `openDocument` delegates to `bifrost.editors.focusOrOpenEditorDocument()`. `onDidOpen` callbacks are stored in a map and fired when the renderer mounts.
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

### TypeScript test fixtures

`studio/test/fixtures/plugins/` is the integration-test plugin directory (`BFR_PLUGINS_DIR`). Most fixtures are plain `index.js`. Two fixtures ship TypeScript source only (`dist/` is gitignored via `**/dist`):

| Fixture | Backend | Webview |
|---------|---------|---------|
| `text-file-editors` | `src/index.ts` → `dist/index.js` | CodeMirror markdown/JSON (`webview/build.mjs`) |
| `webview-showcase` | `src/index.ts` → `dist/index.js` | React editor + sidebar (`webview/build.mjs`) |

The sandbox loads `package.json` `"main"` (`dist/index.js`), not `src/`. Without a compile step, `text-file-editors` cannot replace its `contributes.editorDocumentTypes` placeholder, and `webview-showcase` never registers `plugin.webview-showcase.getState`. `npm run build:plugin-fixtures` (from `studio/`) compiles both; `npm run test:integration:plugins` and `npm run test:integration:all` run it first.

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

Plugins render UI in sandboxed `<iframe>` elements served by `evil-webview://<pluginName>/`. `PluginHost` owns `PluginIframeManager`; `PluginIframe` validates `event.origin`. The iframe bridge is `acquireStudioApi()` (`postMessage` / `onMessage` / theme). Protocol registration, CSP, path traversal checks, and the three surfaces (editor / pane / stub panel) are documented in [webviews.md](webviews.md) — do not duplicate that protocol here.

`webviewProtocol` is computed in the Electron main process, passed through window args into `Bifrost.env.webviewProtocol`, and read by `PluginHost`.

## Security Model

### Process and IPC boundary

- **No DOM access** — Plugin Host is a plain Node.js process, not a browser context.
- **No `window` global** — Eliminates the class of bugs from the legacy bridge.
- **No Electron APIs** — `target: 'node'` in Rspack config; `ELECTRON_RUN_AS_NODE=1` at fork time.
- **No shared memory** — All data flows through serializable IPC messages.
- **IPC caller attestation** — `SandboxManager` stamps `pluginName` on API requests at the Worker boundary; plugins cannot impersonate another plugin on the bridge.
- **Command namespacing** — Prevents plugins from shadowing module commands.
- **`CommandDenylist`** — Hard-blocks infrastructure command groups; permission-gates module command namespaces.

### JavaScript sandbox (per plugin)

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

`PluginInfo.status` includes `'loaded' | 'pending' | 'disabled' | 'error' | 'quarantined'` (see `studio/src/bifrost/contracts/PluginHostTypes.ts`). Quarantined plugins show a **Quarantined** badge and a **Trust & Re-enable** action that calls `bifrost.plugins.trustAndReEnablePlugin(name)`.

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
| `studio/src/bifrost/electron-renderer/plugin-host/TreeViewPaneProvider.tsx` | Renderer | Factory creating tree-view pane providers (`createTreeViewPaneProvider`) hosting the Studio `Tree` component |
| `studio/src/bifrost/electron-renderer/plugin-host/ActivationManager.ts` | Renderer | Event-driven lazy activation: subscribes to activation events, defers `PH_LOAD_PLUGIN` until trigger fires. Stores a `pendingActivations` promise so concurrent callers (e.g. stub callbacks) join an in-flight activation instead of returning early |
| `studio/src/bifrost/electron-renderer/plugin-host/manifest/ContributionRegistrar.ts` | Renderer | Processes `bifrostStudio.contributes` at discovery time: registers stub commands, icons, keybindings, menus, settings, pane placeholders, editor document type placeholders, service task types, pane toggles, themes, bpmnPalette, bpmnContextPad, bpmnModules, dmnPalette, dmnContextPad, dmnModules |
| `studio/src/bifrost/electron-renderer/plugin-host/manifest/PlaceholderPaneProvider.tsx` | Renderer | Pane UI showing "Activating plugin…" while the plugin is pending activation |
| `studio/src/bifrost/electron-renderer/plugin-host/manifest/PlaceholderEditorDocumentRenderer.tsx` | Renderer | Editor tab UI shown for a `contributes.editorDocumentTypes` placeholder: triggers activation on mount, force-reopens the tab once replaced by the real registration, or renders a terminal "denied"/"failed"/"mismatch" error state |
| `studio/src/bifrost/common/plugin-host/manifest/ManifestTypes.ts` | Shared | TypeScript interfaces for the `bifrostStudio` manifest section |
| `studio/src/bifrost/common/plugin-host/manifest/ManifestReader.ts` | Shared | Parser + validator for `bifrostStudio` in `package.json` |
| `studio/src/bifrost/common/plugin-host/manifest/ManifestSchema.json` | Reference | JSON Schema (draft-07) for documentation and external tooling |
| `studio/src/bifrost/common/plugin-host/manifest/ApiVersionCheck.ts` | Shared | Semver compatibility check between plugin and Studio API versions |
| `studio/src/bifrost/contracts/PluginApiVersion.ts` | Shared | `STUDIO_PLUGIN_API_VERSION` constant |
| `studio-sdk/src/webview/studio-webview-theme.css` | Reference | Documentation-only CSS listing available `--theme-*` tokens |
| `studio/test/fixtures/plugins/` | Tests | Integration-test plugin directory (`BFR_PLUGINS_DIR`); 39 discoverable packages |
| `studio/test/fixtures/plugins/build-ts-fixtures.mjs` | Tests | Compiles `text-file-editors` and `webview-showcase` (`tsc` + webview esbuild); invoked by `npm run build:plugin-fixtures` |
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
