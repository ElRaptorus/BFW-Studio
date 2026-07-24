# Bifrost Forge World — Extension Mechanism Roadmap

> **Status**: ACTIVE — Phase 9 complete, Phase 10 next
> **Created**: 2026-05-12
> **Last updated**: 2026-07-24

---

## Vision

Bifrost Forge World's Plugin mechanism must provide **maximum stability and isolation** for third-party Plugins while offering **full feature richness and modability**. Internal ("packaged") Plugins remain trusted, first-class citizens compiled into the bundle. External Plugins — referred to as **Plugins** in all user-facing surfaces — run in isolated processes, communicate through a stable versioned API, declare their contributions through a manifest, and render custom UI in sandboxed webviews.

> **Naming convention**: The term "Plugin" is used for all user-installed external extensions — in UI labels, command names, documentation, **and** in code (class names, type names, file names, interfaces). This mirrors the Daemon Engine's naming and provides a strict linguistic separation between pre-modules (internal, compiled into the bundle, using "Extension" terminology like `ModuleManager`) and user-managed plugins (external, loaded from disk at runtime, using "Plugin" terminology like `PluginHost`, `PluginService`, `StudioPluginApi`). The codebase enforces this split: if a class serves the plugin infrastructure, it uses "Plugin" in its name.

The roadmap is organized into **phases** (numbered 0 through 11), each broken into **small iterative batches**. Every batch is a self-contained deliverable that can be reviewed, tested, and merged independently.

---

## Table of Contents

- [Phase 0 (**DONE**) — Cleanup & Consolidation](#phase-0--cleanup--consolidation)
- [Phase 1 (**DONE**) — Plugin Host Infrastructure](#phase-1--plugin-host-infrastructure)
- [Phase 2 (**DONE**) — Plugin Management UI](#phase-2--plugin-management-ui)
- [Phase 3 (**DONE**) — Webview UI for Plugins](#phase-3--webview-ui-for-plugins)
- [Phase 4 (**DONE**) — Declarative Contribution Model](#phase-4--declarative-contribution-model)
- [Phase 5 (**DONE**) — Developer Experience & Tooling](#phase-5--developer-experience--tooling)
- [Phase 6 (**DONE**) — Advanced Plugin Capabilities](#phase-6--advanced-plugin-capabilities)
- [Phase 7 (**DONE**) — Per-Plugin Sandboxing](#phase-7--per-plugin-sandboxing)
- [Phase 8 (**DONE**) — Editor Document Enrichment (BPMN)](#phase-8--editor-document-enrichment)
- [Phase 9 (**DONE**) — DMN Editor Enrichment](#phase-9--dmn-editor-enrichment)
- [Phase 10 — SDK Audit & Refactoring](#phase-10--sdk-audit--refactoring)
- [Phase 11 — Marketplace](#phase-11--marketplace)
- [Appendix A — Architecture Principles](#appendix-a--architecture-principles)
- [Appendix B — Glossary](#appendix-b--glossary)
- [Appendix C — Current State Reference](#appendix-c--current-state-reference)

---

## [DONE] Phase 0 — Cleanup & Consolidation

**Goal**: Remove the broken external extension path and the window bridge hack. Establish a clean baseline where only internal (packaged) extensions load, and the SDK no longer relies on global `window` properties.

### [DONE] Batch 0.1 — Deactivate external extension loading

**What changes**:
- Remove or guard the external-extension loading calls in `studio/src/bifrost/electron-renderer/entrypoint-electron-renderer.tsx` (lines 184–197).
- Remove the `--extensions-dir` and `--plugin-development-dir` startup argument handling.
- Remove `ModuleMediator.requireAllExtensionsInDirectory()` and `requireExtensionInDirectory()`.
- Remove `ModuleManager.loadExtensionFromUri()` and `loadExtensionFromObject()`.
- Remove the `CodeLoader.loadUri()` eval-based loader and `CodeLoaderElectron` (`vm.runInNewContext`).
- Remove the `ExtensionType.DynamicByUri` and `DynamicByObject` enum members.
- Keep `ModuleManager.loadPackagedModule()` and the `require()` path intact — this is the internal extension code path and must be preserved exactly as-is.

**What stays**:
- `ModuleManager.loadPackagedModule()` — bundled `require()` path
- `ModuleMediator.requirePackagedModule()` — orchestration for internal extensions
- `createAndInitializeBifrost.ts` — sequential load of modules
- `ModuleManager.getLoadedModules()` / `getModuleExports()` — runtime introspection

**Files affected**:
- `studio/src/bifrost/electron-renderer/entrypoint-electron-renderer.tsx`
- `studio/src/bifrost/common/ModuleManager.ts`
- `studio/src/bifrost/browser/ModuleMediator.ts`
- `studio/src/bifrost/common/CodeLoader.ts`
- `studio/src/bifrost/electron-renderer/CodeLoaderElectron.ts` (delete)
- `studio/src/bifrost/Bifrost.ts` (remove `codeLoaderConstructor` wiring if no longer needed)

**Verification**: Build succeeds. Studio starts. All internal extensions load as before. No `~/.evil/studio/plugins/` directory is scanned.

---

### [DONE] Batch 0.2 — Remove the window bridge from the Studio

**What changes**:
- Remove `window.__react__`, `window.__react_dnd__`, `window.__react_select__`, `window.__internal_markdownEditor__` assignments from `studio/src/bifrost/browser/BootstrapInitializer.ts`.
- Keep the Monaco Environment setup (`self.MonacoEnvironment`), the `loader.config({ monaco })`, the Bootstrap tooltip delegation, and the `window.__internal_monaco__` assignment (used internally for Monaco configuration, not as an SDK bridge).
- Keep the unhandled rejection filter for Monaco's `"Canceled"`.

**What stays in `BootstrapInitializer.ts`**:
- `MonacoEnvironment` worker configuration
- `loader.config({ monaco })`
- `window.__internal_monaco__` (internal Monaco integration, not SDK-facing)
- Bootstrap tooltip observer
- Monaco `"Canceled"` rejection filter

**Verification**: Build succeeds. All internal extensions still work (they import React, react-select, etc. directly from the bundle — they never used the bridge).

---

### [DONE] Batch 0.3 — Clean up the SDK window bridge consumer

**What changes**:
- Remove `studio-sdk/src/components/internal/getModuleFromStudio.ts` entirely.
- Audit all SDK components that call `getModuleFromStudio(...)` and replace with direct imports:
  - `getModuleFromStudio('react')` → `import { useState, useEffect, ... } from 'react'`
  - `getModuleFromStudio('react-select')` → `import Select from 'react-select'`
  - `getModuleFromStudio('react-dnd')` → `import { useDrag, useDrop } from 'react-dnd'`
  - `getModuleFromStudio('markdownEditor')` → `import * as markdownEditor from '@mdxeditor/editor'`
- Remove the `studioWindowProxy` test stub (no longer needed once direct imports are used).
- Verify that the SDK's `peerDependencies` in `package.json` still correctly list `react`, `react-select`, `react-dnd`, `@mdxeditor/editor`.

**Impact assessment**: Since all SDK components are compiled into the Studio bundle (they are peer-dependency-linked, not runtime-loaded), replacing `getModuleFromStudio` with direct imports changes nothing at runtime — the bundler resolves the same singleton modules. The bridge only existed for the (now removed) external extension path.

**Files affected**:
- `studio-sdk/src/components/internal/getModuleFromStudio.ts` (delete)
- Every SDK component file that imports from `getModuleFromStudio` (search and replace)

**Verification**: SDK build succeeds. Studio build succeeds. No `getModuleFromStudio` references remain. All SDK-backed UI (panes, dialogs, tree, table) renders correctly.

---

### [DONE] Batch 0.4 — Documentation update

**What changes**:
- Update `docs/architecture/extensions.md`: Remove "External (user-developed) extensions" section. Mark the external extension mechanism as removed. Document why (roadmap to proper isolation).
- Update `docs/systeme.md`: Remove the dynamic extension `onLoad` example from `~/.evil/studio/plugins/`.
- Add entry to `docs/decisions.md`: "Remove legacy external extension mechanism in preparation for isolated plugin host."
- Update `docs/architecture/common-pitfalls.md` if any entries reference external extension patterns.

**Verification**: Documentation accurately reflects the new state.

---

## [DONE] Phase 1 — Plugin Host Infrastructure

**Goal**: Build the foundational process-isolation layer that plugins will run in. Plugins execute in a separate Node.js child process (the "Plugin Host"), communicating with the renderer through a typed message protocol. This is the most architecturally significant phase.

> **Architecture update (2026-05-13)**: The descriptions below reflect the original plan where the Plugin Host was managed by the Electron main process with a `PluginHostRelay`. During implementation, the architecture was migrated: the Plugin Host is now forked **directly from the renderer** (`electron-renderer/plugin-host/PluginHost.ts`), the `PluginHostRelay` was deleted, and the main process is not involved in plugin communication. See `docs/decisions.md` → "Plugin Host: migrate from main process to renderer" for full rationale.
>
> **Architecture update (2026-05-18)**: `PluginService` is now the sole public API at `bifrost.plugins` (type `PluginService`). The `PluginHost` (Electron-side child process manager) is completely hidden behind `PluginService`. Both extend `AbstractEmitter` using a two-tier event pattern: `PluginHost` emits → `PluginService` syncs and re-emits → consumers update. Extensions interact exclusively with `bifrost.plugins.togglePlugin()`, `bifrost.plugins.uninstallPlugin()`, `bifrost.plugins.refreshFromHost()`, and `bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED, ...)`. The actual file layout is:
>
> | Location | Role |
> |----------|------|
> | `studio/src/bifrost/electron-renderer/plugin-host/` | Renderer-side lifecycle (`PluginHost`), bridge (`PluginHostBridge`), logger (`PluginHostLogger`) — **internal, not exposed** |
> | `studio/src/bifrost/common/plugin-host/` | `PluginService` (public facade at `bifrost.plugins`), `NullPluginHost` (non-Electron fallback), child process bundle: `plugin-host-main.ts`, `sandbox/` (Worker Thread + SES sandbox, inline `createPluginApi()`), `callbackRegistry` |
> | `studio/src/bifrost/contracts/` | Shared protocol: `PluginHostProtocol.ts`, `PluginHostConnection.ts`, `PluginHostTypes.ts` |

### [DONE] Batch 1.1 — Plugin Host process lifecycle

**What it introduces**:
- A new `PluginHost` class in `studio/src/bifrost/electron-main/plugin-host/PluginHost.ts`.
- The Plugin Host is a Node.js child process, spawned by the Electron main process via `child_process.fork()`.
- Lifecycle management: spawn on app ready, graceful shutdown on app quit, restart on crash (with backoff).
- The Plugin Host process runs a minimal bootstrap script (`plugin-host-main.ts`) that:
  - Sets up the IPC message channel (Node.js `process.send` / `process.on('message')`)
  - Initializes the Plugin Host API surface
  - Awaits plugin load instructions from the main process

**Architecture alignment**:
- Follows the established Electron architecture: main process manages windows and system resources, renderer process handles UI.
- The Plugin Host is a **third process type**, managed by main, communicating with renderer through main as a relay.
- Adheres to Bifrost Forge World's philosophy: "Let Data Be Data" — all IPC messages are plain serializable data objects, no executable code or function references.

**Files to create**:
- `studio/src/bifrost/electron-main/plugin-host/PluginHost.ts` — lifecycle manager
- `studio/src/bifrost/electron-main/plugin-host/plugin-host-main.ts` — child process entry point
- `studio/src/bifrost/electron-main/plugin-host/PluginHostProtocol.ts` — message type definitions

**Verification**: Plugin Host process spawns on startup, stays alive, gracefully shuts down on quit. Console logs confirm lifecycle events. No plugins loaded yet.

---

### [DONE] Batch 1.2 — Plugin Host Protocol (PH) — message layer

**What it introduces**:
- A typed, bidirectional message protocol between the Plugin Host and the main process.
- Message categories:
  - **`host.loadPlugin`** — main → host: load a plugin by path
  - **`host.pluginLoaded`** — host → main: confirm plugin loaded (or report error)
  - **`host.apiRequest`** — host → main: plugin calls a Studio API (e.g., register command, open notification)
  - **`host.apiResponse`** — main → host: response to an API request
  - **`host.event`** — main → host: broadcast a Studio event to plugins
  - **`host.dispose`** — main → host: shut down gracefully
- Each message has a `type`, a `requestId` (for request/response pairing), and a typed `payload`.
- The protocol is **versioned** from day one (`protocolVersion: 1` in every message).

**Design principles**:
- Messages are JSON-serializable. No functions, no class instances, no circular references.
- The protocol is the **only** communication channel between plugins and the Studio. There is no `window`, no DOM access, no shared memory.
- Request/response pairs use promises with timeouts to prevent hung plugins from blocking the Studio.

**Files to create/modify**:
- `studio/src/bifrost/electron-main/plugin-host/PluginHostProtocol.ts` — expand with full message type definitions
- `studio/src/bifrost/electron-main/plugin-host/PluginHostConnection.ts` — promise-based request/response wrapper

**Verification**: Unit tests for message serialization, request/response pairing, and timeout handling.

---

### [DONE] Batch 1.3 — Plugin Host API surface (core subset)

**What it introduces**:
- The `StudioPluginApi` object available to plugins inside the Plugin Host. This is the **only** API plugins can use — there is no `Bifrost` instance, no direct imports.
- Initial API surface (mirrors the most essential parts of the `Studio` type):
  - `commands.register(id, callback, options?)` / `commands.executeCommand(id, args)`
  - `notifications.open(options)` / `notifications.close(id)`
  - `settings.get(key)` / `settings.onDidChange(key, callback)`
  - `events.on(eventName, callback)` / `events.off(eventName, callback)`
  - `env.pluginPath` / `env.storagePath`
- Every API call is internally serialized into a PH message, sent to main, relayed to the renderer's `Bifrost` instance, and the result is returned.
- Plugins never directly access the renderer or main process — they only see `StudioPluginApi`.

**Key design decision**:
- The API is deliberately **small** at first. It grows incrementally as real plugins need more capabilities.
- The API is **versioned** via `studio.apiVersion` — plugins declare the minimum version they need in their manifest.

**Files to create**:
- `studio/src/bifrost/electron-main/plugin-host/api/StudioPluginApi.ts` — the plugin-facing API class
- `studio/src/bifrost/electron-main/plugin-host/api/CommandsApi.ts`
- `studio/src/bifrost/electron-main/plugin-host/api/NotificationsApi.ts`
- `studio/src/bifrost/electron-main/plugin-host/api/SettingsApi.ts`
- `studio/src/bifrost/electron-main/plugin-host/api/EventsApi.ts`

**Verification**: A test plugin running in the Plugin Host can register a command, execute it, open a notification, and read a setting.

---

### [DONE] Batch 1.4 — Main process API relay

**What it introduces**:
- The main process acts as a **relay** between the Plugin Host and the renderer.
- A new `PluginHostRelay` in the main process:
  - Receives `host.apiRequest` messages from the Plugin Host
  - Translates them into IPC calls to the renderer (`ipcMain` → `webContents.send`)
  - Receives responses from the renderer and forwards them back to the Plugin Host
- For multi-window scenarios: API requests that target a specific window (e.g., "show notification in the focused window") are routed to the correct `BrowserWindow`.
- For global operations (e.g., "register a command"): the relay broadcasts to all windows.

**Architecture alignment**:
- This follows the existing pattern where `entrypoint-electron-main.ts` already relays between windows (e.g., settings sync, menu updates).
- The relay does not interpret or modify messages — it is a pass-through with routing logic.

**Files to create/modify**:
- `studio/src/bifrost/electron-main/plugin-host/PluginHostRelay.ts`
- `studio/src/bifrost/electron-main/entrypoint-electron-main.ts` — wire up the relay

**Verification**: End-to-end: Plugin Host → main relay → renderer → response → main relay → Plugin Host. Measured round-trip latency for typical API calls.

---

### [DONE] Batch 1.5 — Renderer-side Plugin Host bridge

**What it introduces**:
- A `PluginHostBridge` service in the renderer that:
  - Listens for relayed API requests from the main process
  - Executes them against the real `Bifrost` instance
  - Sends results back through the relay
- Integrates with the existing `Bifrost` mediator pattern: the bridge calls `bifrost.commands.register()`, `bifrost.notifications.open()`, etc. on behalf of plugins.
- Plugin commands are namespaced: `plugin.<pluginName>.<commandId>` to prevent collisions with internal commands.

**Files to create/modify**:
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts`
- `studio/src/bifrost/electron-renderer/entrypoint-electron-renderer.tsx` — initialize the bridge

**Verification**: Full round-trip works. A command registered by a plugin appears in the command palette and can be executed.

---

### [DONE] Batch 1.6 — Plugin loading in the Plugin Host

**What it introduces**:
- The Plugin Host can now load plugins from disk.
- Plugin discovery: scan `~/.evil/studio/plugins/` (re-enabled, but now loading into the Plugin Host, not the renderer).
- Each plugin directory must contain a `package.json` with `name`, `version`, `main`, and the new `bifrostStudio` manifest section (see Phase 4).
- The entry script is loaded via Node.js `require()` inside the Plugin Host process.
- The plugin's `activate(api: StudioPluginApi)` function is called with the API object.
- Plugin errors are caught and reported to the renderer as notifications.

**Key difference from the old mechanism**:
- Old: `eval()`/`vm.runInNewContext()` in the renderer, with access to the DOM and the full `Bifrost` instance.
- New: `require()` in an isolated child process, with access only to `StudioPluginApi` — no DOM, no `window`, no `Bifrost`.

**Files to create/modify**:
- `studio/src/bifrost/electron-main/plugin-host/PluginLoader.ts`
- `studio/src/bifrost/electron-main/plugin-host/plugin-host-main.ts` — integrate the loader

**Verification**: Place a test plugin in `~/.evil/studio/plugins/test-plugin/` with a `package.json` and an `index.js` that registers a command. Start the Studio. The command appears and works.

---

### [DONE] Batch 1.7 — Plugin Host crash recovery & logging

**What it introduces**:
- If the Plugin Host crashes, the main process:
  - Logs the crash with a stack trace
  - Shows a notification to the user: "A plugin crashed. Restarting plugins..."
  - Restarts the Plugin Host with exponential backoff (max 3 retries within 60 seconds)
  - Re-loads all plugins that were active before the crash
- Plugin Host stdout/stderr is captured and forwarded to the Studio's developer console.
- A new `std.pluginHost.showLog` command opens a dedicated pane showing Plugin Host output.

**Files to create/modify**:
- `studio/src/bifrost/electron-main/plugin-host/PluginHost.ts` — crash handling, restart logic
- `studio/src/bifrost/electron-main/plugin-host/PluginHostLogger.ts`

**Verification**: Kill the Plugin Host process. Studio shows notification, restarts the host, re-loads plugins. After 3 crashes in 60 seconds, stops retrying and shows a permanent error.

---

### [DONE] Batch 1.8 — Documentation: Plugin Host architecture

**What changes**:
- New architecture doc: `docs/architecture/plugin-host.md`
- Covers: process model, message protocol, API surface, relay architecture, lifecycle, crash recovery
- Update `docs/architecture/index.md` to include the new doc
- Update `docs/architecture/extensions.md` to reference the Plugin Host for plugins

---

## [DONE] Phase 2 — Plugin Management UI

**Goal**: Give users a dedicated, always-available interface for viewing and managing their installed plugins, long before the full Marketplace (Phase 11) ships. Without this, users who install plugins via the filesystem have no Studio-native way to see what is loaded, toggle plugins on or off, or remove them.

> **Naming**: This phase establishes the "Plugin" term across the full stack — UI labels, commands, settings keys, and internal code. All classes and file names introduced here use "Plugin".

### [DONE] Batch 2.1 — Plugins pane (left menu bar entry + list view) ✅

**What it introduces**:
- A new **"Plugins"** pane toggle in the left menu bar, placed after the existing entries (Explorer, Search, Git, Engines).
- Uses a "puzzle-piece" icon (or similar plug/module icon consistent with the Studio's icon language).
- Clicking the entry opens the **Plugins pane** in the left sidebar area.
- The pane reads the Studio's plugin directory (`~/.evil/<channel>/plugins/`) and lists every installed plugin as a card, showing:
  - **Hero icon**: Read from the plugin's `package.json` → `bifrostStudio.icon` field, falling back to a generic puzzle-piece icon.
  - **Name**: From `package.json` → `displayName` (or `name` if no display name).
  - **Description**: From `package.json` → `description`.
  - **Version**: From `package.json` → `version`.
  - **Author**: From `package.json` → `author` (if present).
- The list is sorted alphabetically by display name.
- An empty state is shown when no plugins are installed: "No plugins installed. Place plugin folders in `~/.evil/studio/plugins/` to get started."

**Files to create/modify**:
- `studio/src/modules/plugins/index.ts` — new internal extension registration
- `studio/src/modules/plugins/PluginsPaneRenderer.tsx` — the pane component (subscribes to `bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED)`)
- `studio/src/modules/plugins/PluginCard.tsx` — individual plugin card component
- `studio/src/bifrost/common/plugin-host/PluginService.ts` — public facade at `bifrost.plugins`: toggle, uninstall, refresh, change events, logo cache management
- `studio/src/modules/plugins/plugins.scss` — pane styles
- Icon registration for the left menu bar entry

**Verification**: The Plugins pane toggle appears in the left menu bar. Installed plugins are listed with name, description, version, and icon.

---

### [DONE] Batch 2.2 — Enable/disable toggle ✅

**What it introduces**:
- Each plugin card gets an **enable/disable toggle** control.
- Enabled/disabled state is stored in the Studio's internal settings under `plugins.disabledPlugins` (an array of plugin names that are disabled).
- On Studio startup, the Plugin Host skips loading any plugin whose name is in `plugins.disabledPlugins`.
- Toggling a plugin shows a notification: "Plugin '<name>' disabled. Restart the Studio to apply." (or, if the Plugin Host supports hot-unloading in a future batch, unloads immediately).
- Disabled plugins are visually dimmed in the list (reduced opacity, muted colors).

**Settings registered**:
- `plugins.disabledPlugins`: `string[]` — list of disabled plugin names. Default: `[]`.

**Files to create/modify**:
- `studio/src/modules/plugins/PluginCard.tsx` — add toggle control (delegates to `bifrost.plugins.togglePlugin()`)
- `studio/src/bifrost/common/plugin-host/PluginService.ts` — read/write `plugins.disabledPlugins` setting, selective toggle via `pluginHost.unloadPlugin()`/`reloadPlugin()`
- `studio/src/modules/plugins/initializers/initializeSettings.ts` — register the setting descriptor
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHost.ts` — filter disabled plugins before sending `PH_LOAD_PLUGIN`

**Verification**: Disabling a plugin persists across restarts. The disabled plugin is not loaded by the Plugin Host on the next launch.

---

### [DONE] Batch 2.3 — Uninstall control ✅

**What it introduces**:
- Each plugin card gets an **"Uninstall"** button (trash icon or text button).
- Clicking it shows a confirmation dialog: "Uninstall plugin '<name>'? This will permanently delete the plugin folder."
- On confirmation:
  - The plugin directory is deleted from `~/.evil/<channel>/plugins/<pluginName>/`.
  - The plugin is removed from `plugins.disabledPlugins` if present.
  - The Plugins pane refreshes to remove the entry.
  - A notification confirms: "Plugin '<name>' uninstalled."
- If the plugin is currently loaded in the Plugin Host, the user is informed that a restart is needed for the change to take full effect.

**Files to create/modify**:
- `studio/src/modules/plugins/PluginCard.tsx` — add uninstall button (delegates to `bifrost.plugins.uninstallPlugin()`)
- `studio/src/bifrost/common/plugin-host/PluginService.ts` — uninstall via `pluginHost.unloadPlugin()` + IPC trash + list update, `suppressHostSync` for multi-step operations
- IPC handler in main process for filesystem deletion (plugins directory lives outside the renderer's reach)

**Verification**: Uninstalling a plugin removes its directory and refreshes the list. The plugin is no longer loaded on the next restart.

---

### [DEFERRED] Batch 2.4 — Install from folder

> **Deferred until Phase 11 (Marketplace)**. Installing plugins from arbitrary folders is premature before the packaging format (Batch 11.2) and permission system (Batch 11.5) are in place. Until then, developers install plugins by placing folders directly in `~/.evil/<channel>/plugins/`.

**What it introduces**:
- An "Install from folder..." button at the top of the Plugins pane.
- Opens a native directory picker dialog.
- Validates the selected folder (must contain a `package.json` with a `name` field).
- Copies (not moves) the folder into `~/.evil/<channel>/plugins/<pluginName>/`.
- Refreshes the Plugins pane to show the newly installed plugin.
- Shows a notification: "Plugin '<name>' installed. Restart the Studio to activate."

**Files to create/modify**:
- `studio/src/modules/plugins/PluginsPaneRenderer.tsx` — add install button
- `studio/src/modules/plugins/PluginService.ts` — copy folder, validate manifest
- IPC handler in main process for filesystem copy

**Verification**: A valid plugin folder can be installed via the UI. Invalid folders are rejected with an error message.

---

## [DONE] Phase 3 — Webview UI for Plugins

**Goal**: Allow plugins to render custom UI without requiring React or any specific framework. Plugins provide HTML/JS/CSS that runs in isolated `<webview>` or `<iframe>` containers, communicating with the Plugin Host through a message-passing API.

### [DONE] Batch 3.1 — Webview container infrastructure

**What it introduces**:
- A `PluginIframe` component in `studio/src/components/webview/PluginIframe.tsx`.
- Renders a sandboxed `<iframe>` served via the custom `evil-webview://` Electron protocol with:
  - `sandbox="allow-scripts allow-same-origin"` — no navigation, popups, modals, or forms
  - Per-response `Content-Security-Policy` headers scoped to the plugin's own origin
  - Per-plugin origin isolation (`evil-webview://<pluginName>/`)
- The iframe loads a plugin-provided HTML file via the custom protocol.
- A `PluginIframeManager` service tracks active iframes, routes messages, manages state persistence, and broadcasts theme tokens.

**Architecture alignment**:
- Webviews follow the Editor Document pattern: each webview is backed by a document type, has a URI, and can be opened/closed/focused through the editor system.
- The webview container is framework-agnostic: plugins can use React, Vue, Svelte, plain HTML, or anything that runs in a browser.
- The Plugin Host is forked from the **renderer** process (not the main process). Webview messaging therefore stays within the renderer: Webview → (`window.postMessage`) → Renderer → `PluginHostBridge` → Plugin Host child process. The Electron main process is not involved.
- `PluginService` is the sole public API at `bifrost.plugins`. The `PluginHost` (and its `PluginIframeManager`) is internal. Webview components interact with `bifrost.plugins.getPluginList()` for plugin metadata lookup, while `PluginHostBridge` handles the low-level message routing internally.

**Files created**:
- `studio/src/components/webview/PluginIframe.tsx` — React `<iframe>` component with origin validation and crash recovery
- `studio/src/components/webview/PluginIframeManager.ts` — singleton registry for tracking, messaging, state, and themes
- `studio/src/components/webview/bridge-script.ts` — bridge script exposing `acquireStudioApi()` inside iframes
- `studio/src/components/webview/types.ts` — shared message envelope types

**Verification**: A hardcoded test iframe renders inside an editor tab with correct isolation.

---

### [DONE] Batch 3.2 — Webview ↔ Plugin Host messaging

**What it introduces**:
- A `postMessage` / `onMessage` API available inside iframes via the bridge script.
- Message flow: iframe → (`window.parent.postMessage`) → Renderer (`PluginIframeManager`) → `PluginHostBridge` → Plugin Host child process → Plugin code.
- And the reverse: Plugin code → Plugin Host child → `PluginHostBridge` (renderer) → `PluginIframeManager` → iframe.
- The Electron main process is **not** in the message path — the Plugin Host child is forked directly from the renderer.
- The API inside the webview:

```javascript
// Available in the iframe via the bridge script
const studio = acquireStudioApi();
studio.postMessage({ type: 'myEvent', data: { ... } });
studio.onMessage((message) => { ... });

// State persistence across iframe reloads
studio.setState({ key: 'value' });
studio.getState(); // returns the last set state
```

**Files created/modified**:
- `studio/src/components/webview/bridge-script.ts` — exposes `acquireStudioApi()` inside iframes
- `studio/src/bifrost/common/plugin-host/api/WebviewApi.ts` — Plugin Host child process side (plugin-facing API)
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` — extend with `webviews` namespace handling

**Verification**: A plugin opens an iframe, sends a message, the iframe receives it and responds. State persists across iframe reloads.

---

### [DONE] Batch 3.3 — Webview as Editor Document type

**What it introduces**:
- Plugins can register webview-backed editor document types through the API:

```javascript
api.editors.registerWebviewDocumentType({
  id: 'myPlugin.preview',
  displayName: 'Preview',
  uriPattern: /^ext:\/\/myPlugin\/preview/,
  webviewOptions: {
    localResourceRoots: [api.env.pluginPath],
    entryPoint: 'webview/index.html',
  },
});
```

- The document type integrates with the existing `EditorDocumentTypeManager` — webview documents appear in tabs, support focus/blur, participate in session restore.
- The webview's HTML file is resolved relative to the plugin's directory.

**Architecture**:
- The plugin code in the Plugin Host child calls `api.editors.registerWebviewDocumentType(...)`. This sends a `PH_API_REQUEST` to the renderer.
- The `PluginHostBridge` in the renderer handles the request by creating an `IframeDocumentRenderer` constructor via `createIframeDocumentRendererConstructor(context)` and registering it with `bifrost.editors.registerDocumentType()`.
- Opening a matching URI creates a `PluginIframe` in an editor tab with `iframeId = 'editor:<uri>'`.

**Files created/modified**:
- `studio/src/bifrost/electron-renderer/plugin-host/IframeDocumentRenderer.tsx` — factory creating iframe-backed editor document renderers
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` — extend with `editors` namespace handling
- Integration with `EditorDocumentTypeManager`

**Verification**: A plugin registers an iframe-backed document type. Opening a URI matching the pattern shows the iframe in an editor tab.

---

### [DONE] Batch 3.4 — Webview as Pane

**What it introduces**:
- Plugins can register webview-backed panes (sidebar, property panel):

```javascript
api.panes.registerWebviewPane({
  id: 'myPlugin.sidebar',
  title: 'My Sidebar',
  area: 'left',
  icon: 'ph-puzzle-piece',
  webviewOptions: {
    entryPoint: 'webview/sidebar.html',
  },
  visibleWhen: { documentType: 'bpmn' }, // optional predicate
});
```

- Iframe panes integrate with `PaneManager` and appear in the appropriate pane area.
- They support the same `postMessage` / `onMessage` API as editor iframes.

**Architecture**:
- The plugin code in the Plugin Host child calls `api.panes.registerWebviewPane(...)`. This sends a `PH_API_REQUEST` to the renderer.
- The `PluginHostBridge` handles the request by creating an `IframePaneProvider` via `createIframePaneProvider(context)` and registering it with `bifrost.panes`.
- The `postMessage` / `onMessage` channel works identically to editor iframes — messages flow directly between the renderer and the Plugin Host child process.

**Files created/modified**:
- `studio/src/bifrost/electron-renderer/plugin-host/IframePaneProvider.tsx` — factory creating iframe-backed pane providers
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` — extend with `panes` namespace handling
- Integration with `PaneManager`

**Verification**: A plugin registers an iframe pane. It appears in the sidebar with correct visibility predicates.

---

### [DONE] Batch 3.5 — Theming bridge for webviews

**What it introduces**:
- The Studio's CSS theme tokens are injected into plugin iframes as CSS custom properties.
- When the theme changes, iframes receive an updated set of tokens.
- A lightweight CSS file (`studio-webview-theme.css`) is provided to plugin developers as part of the SDK, containing the token definitions and basic reset styles.
- Plugins can use these tokens or ignore them entirely.

**Implementation**:
- The bridge script injects a `<style>` element with the current theme tokens into the iframe's document.
- On `EVENT_THEME_CHANGED` events, `PluginIframeManager` broadcasts updated tokens to each active iframe via `broadcastThemeTokens()`.
- The theme tokens are extracted from the renderer's own CSS custom properties via `PluginHost.extractThemeTokens()` — no separate theme file is needed at runtime.

**Files created/modified**:
- `studio/src/components/webview/bridge-script.ts` — theme token injection and `theme` message handler
- `studio/src/components/webview/PluginIframeManager.ts` — broadcast theme changes to active iframes
- `studio-sdk/src/webview/studio-webview-theme.css` — reference CSS file for plugin developers (documents available tokens)

**Verification**: An iframe using `var(--theme-editor-bg)` adapts when switching between light and dark themes.

---

### [DONE] Batch 3.6 — Documentation: Webview system

**What changes**:
- New architecture doc: `docs/architecture/webviews.md`
- Plugin developer guide section: how to create a webview, available APIs, theming, state management
- Update `docs/architecture/plugin-host.md` to reference webview messaging

---

### [DONE] Batch 3.7 — Selective plugin reload

**Goal**: Replace the current "full restart on every toggle/refresh" behaviour with targeted load/unload operations so that enabling, disabling, installing, or uninstalling a single plugin does not restart the entire Plugin Host child process and reload every other plugin.

**What it introduces**:
- New protocol messages `PH_UNLOAD_PLUGIN` (renderer → child) and `PH_RELOAD_PLUGIN` (renderer → child).
- `PluginLoader.unloadPlugin(name)` in the Plugin Host child — calls the plugin's `deactivate()`, removes it from the loaded list, and notifies the renderer.
- Per-plugin bridge cleanup in `PluginHostBridge` (renderer side) — already partially in place: callbacks are grouped by plugin name.
- `PluginService.togglePlugin` and `uninstallPlugin` target only the affected plugin instead of calling `bifrost.plugins.refresh()`.
- Full `refresh()` remains available as a manual "Refresh All" action.

**Why this matters**: With a growing plugin ecosystem, reloading 30+ plugins every time a single one is toggled is unacceptable from both a UX and performance standpoint.

**Files to create/modify**:
- `studio/src/bifrost/contracts/PluginHostProtocol.ts` — add `PH_UNLOAD_PLUGIN` and `PH_RELOAD_PLUGIN` message types
- `studio/src/bifrost/common/plugin-host/PluginLoader.ts` — implement `unloadPlugin(name)` with `deactivate()` call
- `studio/src/bifrost/common/plugin-host/plugin-host-main.ts` — handle `PH_UNLOAD_PLUGIN` / `PH_RELOAD_PLUGIN` messages
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHost.ts` — new `unloadPlugin(name)` / `reloadPlugin(name)` methods (internal, called by `PluginService`)
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` — per-plugin callback cleanup on unload
- `studio/src/bifrost/common/plugin-host/PluginService.ts` — `togglePlugin()` calls targeted unload/reload instead of full refresh

**Verification**: Toggling a single plugin reloads only that plugin; other plugins retain their state and registered commands.

---

### [DONE] Batch 3.8 — Plugin README detail view

**Goal**: Allow plugin developers to ship a `README.md` alongside their plugin. The Plugins Pane shows a rendered read-only view of this README when the user clicks on a plugin card, similar to how VSCode/Cursor, Zed, and other editors display extension details.

**What it introduces**:
- Clicking a plugin card opens a detail panel (split pane or overlay) that renders the plugin's `README.md` as HTML.
- Markdown rendering via the existing MDX editor infrastructure or a lightweight library like `marked`.
- If no `README.md` is present, a placeholder message is shown ("This plugin does not provide documentation.").
- The `PluginInfo` type in `studio/src/bifrost/contracts/PluginHostTypes.ts` gains an optional `readmePath` field, populated during discovery in the Plugin Host child process.
- The renderer reads the file content on demand (not eagerly during startup). Since the renderer has `nodeIntegration: true`, it can read the file directly from disk using the path provided in `PluginInfo`.

**Why this matters**: A plugin's README is its primary documentation surface. Without it, users must leave the Studio to understand what a plugin does, how to configure it, or what commands it provides.

**Files to create/modify**:
- `studio/src/bifrost/contracts/PluginHostTypes.ts` — add optional `readmePath: string` to `PluginInfo`
- `studio/src/bifrost/common/plugin-host/PluginLoader.ts` — populate `readmePath` during plugin discovery
- `studio/src/modules/plugins/PluginDetailView.tsx` — new component rendering the README
- `studio/src/modules/plugins/PluginCard.tsx` — add click handler to open the detail view
- `studio/src/modules/plugins/plugins.scss` — detail view styles

**Verification**: A plugin with a `README.md` shows rendered Markdown when its card is clicked. A plugin without one shows the placeholder. Links and images render correctly.

> **Follow-up TODO — Enhanced README Viewer**: The current README renderer uses `marked` + `DOMPurify` for basic Markdown-to-HTML rendering. Editors like VS Code and Cursor provide a far richer detail view with feature highlights, badge rendering, screenshot galleries, and rich navigation. Once the plugin system is feature-complete, investigate alternatives (e.g., a dedicated `PluginDetailPage` with structured metadata sections, or adopting a more capable Markdown renderer with syntax highlighting, image zoom, and anchor navigation) to bring the README viewing experience closer to parity with established editors. This is a UX polish item, not a blocker for Phase 3.

---

## Phase 4 — Declarative Contribution Model (**DONE**)

**Goal**: Plugins declare their static contributions (commands, menus, settings, icons, keybindings, panes) in their `package.json` manifest. This enables lazy activation, pre-validation, and contribution discovery without loading plugin code.

### Batch 4.1 — Manifest schema definition

**What it introduces**:
- The `bifrostStudio` section in `package.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "bifrostStudio": {
    "apiVersion": "1.0",
    "displayName": "My Plugin",
    "description": "Does amazing things",
    "icon": "icon.png",
    "activationEvents": [
      "onCommand:myPlugin.doThing",
      "onDocumentType:bpmn",
      "onStartup"
    ],
    "contributes": {
      "commands": [
        { "id": "myPlugin.doThing", "title": "Do The Thing", "icon": "ph-magic-wand" }
      ],
      "menus": {
        "std/application/main": [
          { "command": "myPlugin.doThing", "group": "tools" }
        ]
      },
      "settings": [
        { "key": "myPlugin.autoRun", "type": "boolean", "default": true, "description": "Run automatically" }
      ],
      "keybindings": [
        { "command": "myPlugin.doThing", "key": "Ctrl+Shift+M" }
      ],
      "icons": {
        "myPlugin/logo": "assets/logo.svg"
      }
    }
  }
}
```

- A JSON Schema file for the `bifrostStudio` manifest section, used for validation.
- A `ManifestReader` that parses and validates the manifest at discovery time, without loading plugin code.

**Files to create**:
- `studio/src/bifrost/common/plugin-host/manifest/ManifestSchema.json`
- `studio/src/bifrost/common/plugin-host/manifest/ManifestReader.ts`
- `studio/src/bifrost/common/plugin-host/manifest/ManifestTypes.ts`

**Verification**: ManifestReader correctly parses valid manifests and rejects invalid ones with clear error messages.

---

### Batch 4.2 — Contribution registration from manifest (commands, icons, keybindings)

**What it introduces**:
- At discovery time (before any plugin code runs), the Studio reads all plugin manifests and registers their static contributions:
  - **Commands**: Registered as "pending" — the command callback is a stub that triggers lazy activation of the plugin. Once activated, the real callback replaces the stub.
  - **Icons**: Registered via `bifrost.icons.registerIcons()`.
  - **Keybindings**: Registered via `bifrost.keybindings.register()`.
- This means commands appear in the command palette, icons are available, and keybindings work — even before the plugin's JavaScript has loaded.

**Files to create/modify**:
- `studio/src/bifrost/electron-renderer/plugin-host/manifest/ContributionRegistrar.ts`
- Integration with `CommandMediator`, `IconMediator`, `KeybindingsMediator` (all renderer-side)

**Verification**: A plugin with manifest-declared commands shows those commands in the command palette before the plugin is activated.

---

### Batch 4.3 — Contribution registration from manifest (menus, settings, panes)

**What it introduces**:
- Manifest-declared menu contributions are registered as menu modifiers.
- Manifest-declared settings are registered with their defaults via `bifrost.settings.registerSettings()`.
- Manifest-declared pane shells (title, icon, area, visibility predicate) are registered as placeholders -- the actual pane component is a webview loaded on demand.

**Files to create/modify**:
- `studio/src/bifrost/electron-renderer/plugin-host/manifest/ContributionRegistrar.ts` — extend
- Integration with `MenuMediator`, `SettingsMediator`, `PaneMediator` (all renderer-side)

**Verification**: Menu items from plugin manifests appear in the correct menus. Settings appear in the settings editor with correct defaults.

---

### Batch 4.3b — Contribution registration: custom Service Task types

**What it introduces**:
- Plugins can declare custom Service Task implementation types in their manifest:

```json
"contributes": {
  "serviceTaskTypes": [
    { "implementation": "myPlugin.emailSender", "label": "Email Sender" },
    { "implementation": "myPlugin.slackNotifier", "label": "Slack Notifier" }
  ]
}
```

- At discovery time, the `ContributionRegistrar` reads `serviceTaskTypes` entries and registers them in an internal collection managed by the BPMN editor module.
- The existing `bpmn.serviceTasks.getCustomTypes` command returns this collection. The Service Task property pane already consumes it — registered types appear in the "Type" dropdown alongside the built-in "HTTP Service Task" option.
- No plugin code needs to run for the types to appear. This is a purely declarative, synchronous contribution — no async pane visibility complexity.
- When a user selects a plugin-provided type, the `implementation` string is stored on the BPMN element, exactly like the built-in types. The Engine routes execution based on this string.

**Cleanup on plugin deactivation/uninstall**:
- The `ContributionRegistrar` tracks which plugin registered each Service Task type.
- When a plugin is deactivated, uninstalled, or unloaded (Batch 3.7), its registered types are removed from the internal collection.
- If any BPMN element currently uses a removed type, its implementation string remains in the XML (no data loss). The Service Task pane falls back to showing the freetext "Implementation Type" field with the now-unrecognized value, allowing the user to see and edit it.

**Future enhancement (Phase 6/7)**:
- Once async-compatible pane visibility (Batch 6.8) and webview panes (Batch 3.4) are mature, plugins can additionally register a dedicated configuration pane that appears when their custom Service Task type is selected — providing a full type-specific editing experience beyond the default property pane.

**Files to create/modify**:
- `studio/src/bifrost/electron-renderer/plugin-host/manifest/ContributionRegistrar.ts` — extend with `serviceTaskTypes` handling
- `studio/src/bifrost/common/plugin-host/manifest/ManifestTypes.ts` — add `ServiceTaskTypeContribution` type
- `studio/src/modules/bpmn-editor/ServiceTaskTypeRegistry.ts` — internal collection for registered types (backing the existing `bpmn.serviceTasks.getCustomTypes` command)

**Verification**: A plugin declares `serviceTaskTypes` in its manifest. The types appear in the Service Task "Type" dropdown without the plugin's code being loaded. Uninstalling the plugin removes the types from the dropdown. Elements that used a removed type retain their `implementation` value in the XML.

---

### Batch 4.4 — Activation events & lazy loading

**What it introduces**:
- Plugins are **not** loaded until one of their declared `activationEvents` fires:
  - `onCommand:<commandId>` — when a command declared by the plugin is executed
  - `onDocumentType:<typeId>` — when an editor document of that type is opened (e.g. `bpmn`, `json`)
  - `onUri:<scheme>` — when a URI matching the scheme is opened
  - `onStartup` — immediately after all manifests are processed (for plugins that must always run)
  - `onSetting:<key>` — when a specific setting changes
- The `ActivationManager` listens for these events and triggers plugin loading in the Plugin Host when matched.
- Once a plugin is activated, all its "pending" command stubs are replaced with the real callbacks.

**Files to create**:
- `studio/src/bifrost/electron-renderer/plugin-host/ActivationManager.ts`

**Verification**: A plugin with `activationEvents: ["onCommand:myPlugin.doThing"]` is not loaded until the command is invoked. After invocation, the command executes normally.

---

### Batch 4.5 — API versioning contract

**What it introduces**:
- The Studio exposes an `apiVersion` (semver, e.g. `"1.0.0"`) that plugins can target.
- Plugins declare `bifrostStudio.apiVersion` in their manifest (minimum compatible version).
- At discovery time, the Studio checks compatibility:
  - If the plugin's required version is newer than the Studio's API version → the plugin is not loaded, and the user is notified.
  - If compatible → the plugin loads normally.
- The API version is independent of the Studio's application version.
- API additions increment the minor version. Breaking changes increment the major version.

**Files to create/modify**:
- `studio/src/bifrost/common/plugin-host/manifest/ApiVersionCheck.ts`
- Version constant in a shared location (e.g. `studio/src/bifrost/contracts/PluginApiVersion.ts`)

**Verification**: A plugin targeting `apiVersion: "2.0"` is rejected with a clear error when the Studio's API version is `"1.0"`.

---

### Batch 4.6 — Documentation: Manifest & contributions

**What changes**:
- New architecture doc: `docs/architecture/plugin-manifest.md`
- Covers: manifest schema, all `contributes` fields, activation events, API versioning, examples
- Plugin developer guide: how to write a manifest, what each field does

---

## [DONE] Phase 5 — Developer Experience & Tooling

**Goal**: Make it easy and enjoyable to develop Bifrost Forge World plugins. Provide scaffolding, debugging, and development tools.

### Batch 5.1 — Plugin Host Console pane

**What it introduces**:
- A dedicated "Plugin Host Console" pane in the bottom area (`console` group) that surfaces `stdout`/`stderr` output from the Plugin Host child process in real-time.
- New `PluginService` API: `getPluginHostLog()`, `onPluginHostLog()`, `clearPluginHostLog()`.
- Timestamped log lines (`[HH:MM:SS.mmm]` prefix at capture time).
- Multi-select plugin name dropdown filter (populated from loaded plugin list), text filter, clear button, auto-scroll with pin-to-bottom, stderr lines highlighted in red.
- Toggled via the `plugins.showConsole` command.

**Deferred from original plan**: The `--plugin-development-dir` CLI flag and auto-reload watcher (`DevPluginWatcher` / chokidar) were dropped. The existing `BFR_PLUGINS_DIR` environment variable and per-plugin enable/disable (`plugins.disabledPlugins`) provide equivalent flexibility. Manual reload via `reloadPlugin()` is sufficient for v1. See `docs/decisions.md` (2026-06-01) for rationale.

**Files created/modified**:
- `studio/src/modules/plugins/PluginHostConsolePaneRenderer.tsx` (new)
- `studio/src/bifrost/common/plugin-host/PluginService.ts` (modified — logger API)
- `studio/src/bifrost/contracts/PluginHostTypes.ts` (modified — `IPluginHost` logger methods)
- `studio/src/bifrost/common/plugin-host/NullPluginHost.ts` (modified — no-op logger)
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHost.ts` (modified — delegates to `PluginHostLogger`)
- `studio/src/modules/plugins/initializers/initializePanes.ts` (modified — registers console pane)
- `studio/src/modules/plugins/initializers/initializeCommands.ts` (modified — `plugins.showConsole`)
- `studio-sdk/types/common/PluginService.ts` (modified — type declarations)

**Verification**: Plugin Host `stdout`/`stderr` appears in the console pane in real-time. `console.log()` from a plugin shows up. Text filter works. Clear button empties the buffer.

---

### Batch 5.2 — Plugin scaffold generator (CLI)

**What it introduces**:
- A CLI tool (`node tools/create-evil-plugin/src/cli.js my-plugin`) that generates a new plugin project with:
  - `package.json` with the `bifrostStudio` manifest section
  - TypeScript configuration
  - A basic `src/index.ts` with `activate()` and `deactivate()`
  - Optional webview template (HTML + CSS + React, via `--webview` flag)
  - Build script (esbuild, targeting Node.js for the Plugin Host)
- The generated project uses `@evil/bifrost_fw_sdk` as a `devDependency` (`^1.0.0`, ready for npm publishing).

**Files created**:
- `tools/create-evil-plugin/` — package with `src/cli.js`, `src/prompts.js`, `src/generator.js`
- `tools/create-evil-plugin/templates/base/` — minimal plugin template (package.json, tsconfig.json, src/index.ts)
- `tools/create-evil-plugin/templates/webview/` — webview additions (package.json, build.mjs, React app)
- `studio/test/integration/scaffold/scaffold-generator.test.ts` — integration tests (9 tests: file generation, manifest, buildability, interpolation, collision detection)

**Verification**: Running the generator produces a working plugin that builds successfully. Integration tests verify both minimal and webview variants.

---

### Batch 5.3 — Initial plugin API types in the SDK

**What it introduces**:
- Type-only interfaces in `studio-sdk/src/plugin-api/` mirroring the runtime API: `StudioPluginApi`, `CommandsApi`, `NotificationsApi`, `SettingsApi`, `EventsApi`, `WebviewApi`, `EditorsApi`, `PanesApi`, plus supporting option types.
- Manifest types in `studio-sdk/src/plugin-api/manifest/`: `BifrostStudioManifest`, `ManifestContributions`, contribution sub-types, `ActivationEvent` union, `KeybindingWhenCondition`.
- Webview API types in `studio-sdk/src/plugin-api/webview/`: `StudioWebviewApi`, `WebviewMessageEvent<T>`, and `window.acquireStudioApi()` global augmentation.
- All types exported from the SDK barrel (`studio-sdk/src/index.ts`).

**Note**: This adds the minimum plugin-facing types needed for a good developer experience. The comprehensive SDK audit and refactoring (Phase 10) will clean up internal-only types and validate WebView component compatibility later.

**Verification**: A freshly generated plugin project (from Batch 5.2) gets full autocompletion for all plugin APIs using only `@evil/bifrost_fw_sdk` as a `devDependency`. Both SDK and Studio build cleanly.

---

### Batch 5.4 — Documentation: Plugin development guide

**What it introduces**:
- New doc: `docs/plugin-development-guide.md`
- Covers: getting started, project structure, plugin lifecycle, manifest reference, API reference (all sub-APIs), webview development, development workflow (BFR_PLUGINS_DIR, console pane, DevTools), build & package, SDK type exports appendix.
- Architecture updates: `docs/architecture/plugin-host.md` (console pane section, file map), `docs/decisions.md` (3 Phase 5 entries), `docs/architecture/index.md` (updated topic description).

**Verification**: Guide covers all plugin APIs with examples. Architecture docs are consistent with the implementation.

---

## [DONE] Phase 6 — Advanced Plugin Capabilities

**Goal**: Extend the Plugin Host API with capabilities that enable richer plugins.

**Round 1 [DONE]**: Status Bar API (6.6), MenuBar + Menus API (6.7), Dirty State & Save Lifecycle (6.4), Cross-window Plugin State Synchronization, Documentation (6.11 partial). See `docs/decisions.md` for design decisions.

**Round 2 [DONE]**: Diagnostics (6.2), Notifications & Dialog API completions, File system access (6.1), Pane visibility (6.8), Tree views (6.5), Plugin theme contributions (6.3 — pivoted from Monaco decorations), Documentation (6.11 remainder). Standalone panels (6.9) dropped — panes + editor documents cover all use cases. Monaco decoration API dropped — Monaco being phased out in favor of CodeMirror.

### Batch 6.1 — File system access (scoped) [DONE]

**What it introduces**:
- Plugins can read and write files (text and binary) through a scoped file system API:

```javascript
api.workspace.readFile(uri);            // text (UTF-8)
api.workspace.readBinaryFile(uri);       // binary (Uint8Array, base64 over IPC)
api.workspace.writeFile(uri, content);
api.workspace.writeBinaryFile(uri, data);
api.workspace.listDirectory(uri);
api.workspace.stat(uri);
api.workspace.createDirectory(uri);
api.workspace.deleteFile(uri);
api.workspace.onDidChangeFile(uri, callback);
api.workspace.onDidChangeSolution(callback);
api.workspace.getProjectFolders();
```

- Access is scoped: plugins can only access files within the current solution's project folders and their own plugin storage directory (`api.env.storagePath`).
- File change events use a 100ms debounce for coalescing.
- Plugin storage path is accessible via `api.env.storagePath` (not on the workspace API).

---

### Batch 6.2 — Diagnostics API [DONE]

**What it introduces**:
- Plugins can contribute diagnostics (errors, warnings, info) via `api.diagnostics.set(uri, diagnostics)`.
- Diagnostics appear in the status bar problems count and are accessible through `bifrost.diagnostics`.
- This allows plugins to implement linters, validators, or quality checkers for any file type.

---

### Notifications & Dialog API completions [DONE]

**What it introduces**:
- **Notifications**: `api.notifications.open()` extended with `actions` (`PluginNotificationAction[]`) and `sticky` options. New `api.notifications.onResponse(notificationId, callback)` method for handling action button clicks via `PH_REGISTER_CALLBACK`.
- **Dialogs**: New `api.dialogs` namespace mirroring `DialogManager`: `open(options)` (custom form dialogs with content items and actions), `prompt(title, placeholder?)`, `showOpenFile(options?)`, `showOpenDirectory()`, `showSaveFile(options?)`.
- Dialog cleanup on plugin disable: open dialogs are force-closed. Notification response callbacks are unregistered.

---

### ~~Batch 6.3 — Editor decorations API~~ — PIVOTED to Plugin Theme Contributions [DONE]

> **Status**: Pivoted and implemented. The original Monaco editor decoration API was dropped because Monaco is being phased out in favor of CodeMirror. The batch is replaced by **Plugin Theme Contributions**: plugins can declare CSS custom property overrides via `contributes.themes` in the manifest, or register themes at runtime via `api.themes.register()`. Both paths inject `<style>` elements with CSS custom properties scoped to `.bifrost.bifrost-theme--<id>`. Themes appear in the Settings "Theme" dropdown. Type-aware fallback on removal. See `docs/decisions.md` for rationale.

---

### Batch 6.4 — Webview editor dirty state & save lifecycle [DONE]

**What it introduces**:
- Webview-backed editor documents can report "dirty" (unsaved changes) state to the Studio, enabling the standard dirty indicator (dot on the close button, colored tab title) and the save-or-discard dialog on tab close.
- A new bridge API for plugins:

```javascript
api.editors.setDirty(uri, isDirty);
api.editors.onSaveRequest(uri, async () => {
  // Plugin performs its save operation
  await saveMyData();
  api.editors.setDirty(uri, false);
});
```

- `setDirty(uri, true)` sets `hasUnsavedChanges: true` on the `EditorDocument` without requiring an `EditorDocumentModel`. The renderer updates the tab UI accordingly.
- `setDirty(uri, false)` clears the flag (typically called after a successful save).
- `onSaveRequest(uri, callback)` registers a handler that the Studio calls when the user triggers Save (Ctrl+S) or when the save-or-discard dialog's "Save and close" option is chosen.
- **Close-on-disable prompt**: When a plugin is disabled or uninstalled, the `unregisterDocumentType` flow currently force-closes all open tabs with `skipAskUnsavedChanges: true`. With dirty state in place, this is changed to `skipAskUnsavedChanges: false`, so the standard save-or-discard dialog fires for any dirty webview editor documents before they are closed. This prevents accidental data loss.

**Architecture**:
- The `PluginHostBridge` handles `editors.setDirty` by directly updating `editorDocument.hasUnsavedChanges` on the `EditorDocument` managed by `EditorAreaManager`, then emitting `EVENT_EDITOR_DOCUMENT_DATA_UPDATED` to trigger UI updates.
- `editors.onSaveRequest` registers a callback that `EditorMediator.saveChangesBeforeClosingDocument` (or the Ctrl+S handler) invokes via the PH protocol. This replaces the model-based save path for webview documents.
- No `EditorDocumentModel` subclass is needed — the bridge acts as a lightweight model proxy.

**Depends on**: Phase 3 (webview editor document types)

**Files to create/modify**:
- `studio/src/bifrost/common/plugin-host/api/EditorsApi.ts` — add `setDirty`, `onSaveRequest`
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` — handle `editors.setDirty` and `editors.onSaveRequest`; change `unregisterDocumentType` to pass `skipAskUnsavedChanges: false`
- `studio/src/bifrost/browser/EditorMediator.ts` — support save callback dispatch for model-less documents

**Verification**: A webview editor document reports dirty state. The tab shows the dirty indicator. Closing the tab prompts "Save / Don't save / Cancel". Disabling the plugin prompts before closing dirty tabs. A clean (non-dirty) webview tab closes without prompting.

---

### Batch 6.5 — Tree view API [DONE]

**What it introduces**:
- Plugins can register custom tree views in pane areas via a push-based data model:

```javascript
api.views.registerTreeView({
  id: 'myPlugin.fileTree',
  title: 'My Files',
  area: 'left',
  icon: 'ph-tree-structure',
});

api.views.updateTreeData('myPlugin.fileTree', [
  {
    id: 'src', type: 'directory', label: 'src', icon: 'ph-folder', expanded: true,
    children: [
      { id: 'src/index.ts', type: 'file', label: 'index.ts', icon: 'ph-file-ts', command: 'myPlugin.openFile', metadata: { path: 'src/index.ts' } },
    ],
  },
]);
```

- The plugin pushes the full `PluginTreeItem[]` hierarchy; the bridge stores and renders via the SDK `Tree` component in a `TreeViewPaneProvider`.
- Tree items support icons, labels, sublabels, badges, context menus, click commands, and nested children.
- Click commands are auto-namespaced and executed via `bifrost.commands`. Item metadata is passed as the first argument.

---

### Batch 6.6 — Status bar API [DONE]

**What it introduces**:
- Plugins can register, update, and remove status bar items, show progress indicators, and query visibility — mirroring `StatusBarMediator`:

```javascript
api.statusBar.registerStatusBarItem('left', 'myPlugin.status', [
  { type: 'button', id: 'myPlugin.status', content: { type: 'text', label: 'Ready' }, command: 'myPlugin.showStatus' },
], 50);
api.statusBar.updateStatusBarItem('myPlugin.status', [/* updated items */]);
api.statusBar.unregisterStatusBarItem('myPlugin.status');
const progress = await api.statusBar.showProgress('Indexing...');
progress.update('Indexing... 50%');
progress.done();
const visible = await api.statusBar.isVisible();
```

- Registration IDs are auto-namespaced (`plugin.<pluginName>.<id>`) to prevent cross-plugin collisions.
- Progress handles are proxied: the bridge manages real `ProgressHandle` instances; the plugin receives a proxy with `update()` + `done()`.
- All registrations are tracked and cleaned up on plugin disable/uninstall (items unregistered, orphaned progress handles completed).

---

### Batch 6.7 — MenuBar API + Menus API [DONE]

**What it introduces**:
- **`api.menuBar`** — mirrors `MenuBarMediator`: register items directly in menu bar areas, register modifiers with `insertAfter`/`insertBefore` positioning:

```javascript
api.menuBar.registerMenuBarItem('right', [
  { type: 'button', id: 'myPlugin.quickAction', icon: 'ph-lightning', tooltip: 'Quick Action', command: 'myPlugin.quickAction' },
]);
api.menuBar.registerMenuBarItemModifier({
  insertAfter: 'pane/left/plugins',
  items: [{ type: 'pane_content_toggle', id: 'myPlugin.sidebar', icon: 'ph-puzzle-piece', tooltip: 'My Plugin', paneAreaId: 'left', paneId: 'myPlugin.sidebar' }],
});
const visible = await api.menuBar.isVisible();
```

- **`api.menus`** — mirrors `MenuMediator`: inject items into existing menus/submenus with 6 positioning modes (`append`, `prepend`, `appendToSubmenu`, `prependToSubmenu`, `insertAfter`, `insertBefore`):

```javascript
api.menus.registerMenuModifier('std/application/main', {
  items: [{ type: 'command', label: 'My Plugin Sidebar', command: 'myPlugin.toggleSidebar' }],
  position: { type: 'appendToSubmenu', submenuId: 'view' },
});
```

- **Manifest `contributes.paneToggles`** — declarative pane toggle buttons, processed at discovery time:

```json
"contributes": {
  "paneToggles": [
    { "id": "myPlugin.sidebar", "icon": "ph-puzzle-piece", "tooltip": "My Plugin", "paneAreaId": "left", "paneId": "myPlugin.sidebar", "insertAfter": "pane/left/plugins" }
  ]
}
```

- `MenuBarManager.registerMenuBarItem` and `registerMenuBarItemModifier` now return `{ dispose }` objects for proper cleanup.
- All registrations (runtime API + manifest) are tracked per-plugin and cleaned up on disable/uninstall. Menu rebuilds (`updateMenuBarItems()`, `updateMenus()`) are triggered after register and dispose.

**Depends on**: Phase 2 (Plugin Management UI), Phase 3 (Webview panes)

**Files to create/modify**:
- `studio/src/bifrost/common/plugin-host/api/MenuBarApi.ts` — Plugin-facing API (child process side)
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` — handle `menuBar` namespace
- `studio/src/bifrost/contracts/PluginHostProtocol.ts` — new PH message types for menubar operations

**Verification**: A plugin registers a left-area pane and a corresponding pane toggle button. The button appears in the left menu bar and toggles the pane group. Disabling the plugin removes both the pane and the button.

---

### Batch 6.8 — Pane visibility: push-based `setVisible` for plugins [DONE]

**What it implements**:
- `api.panes.setVisible(paneId, visible)` — sole runtime control for plugin pane visibility. Panes are visible by default; call `setVisible(id, false)` to hide.
- The bridge stores visibility in a `paneVisibility: Map<string, boolean>` and patches the pane's `shouldBeDisplayed` accordingly.
- The manifest `visibleWhen` condition serves only as a lazy-load activation trigger for `PlaceholderPaneProvider` — it is **not** evaluated by active `IframePaneProvider` instances.
- `editorFocusChanged` event forwarded to plugins via `api.events.on('editorFocusChanged', ...)`, enabling plugins to call `setVisible` based on the active editor.
- `clearVisibilityOverride` was explicitly removed — `setVisible` is the only API surface.
- All visibility state is cleared on plugin disable.

**Depends on**: Phase 3 (webview panes), Batch 6.7 (left menu bar pane toggles)

---

### ~~Batch 6.9 — Standalone webview panels~~ — DROPPED

> **Status**: Dropped from the v1 roadmap. Plugins can already register panes (left/right/bottom areas) and webview-backed editor document types (tabs in editor area). These two surfaces cover all practical use cases for plugin UI. The `api.webviews.createPanel()` stub remains for forward compatibility but is not implemented in v1. See `docs/decisions.md` for rationale.

---

### ~~Batch 6.10 — Main process contributions (native capabilities)~~ — REMOVED

> **Status**: Removed from the v1 roadmap. See `docs/decisions.md` entry "2026-06-01 — Remove native modules (Batch 6.10) from v1 roadmap" for rationale.
>
> This batch originally proposed allowing plugins to declare `contributes.nativeModules` that run in the Electron main process with full Node.js and system access. The security implications are too severe for v1: a malicious or buggy native module could crash the entire application, access arbitrary files, or exfiltrate data. This capability may be revisited in a future version with a comprehensive sandboxing and permission model.

---

### Batch 6.11 — Documentation: Advanced APIs [DONE]

**What changes**:
- Update `docs/plugin-development-guide.md` with all new API sections.
- Update `docs/architecture/plugin-host.md` with the expanded API surface.

---

## Phase 7 (**DONE**) — Per-Plugin Sandboxing

**Goal**: Isolate each plugin into its own execution boundary so that a misbehaving or malicious plugin cannot interfere with other plugins running in the same Plugin Host. This is a differentiating feature compared to editors like VS Code, where all extensions share a single Node.js process and a crash or resource hog in one extension affects all others.

### Motivation

Phase 1 establishes a **single Plugin Host process** that loads all plugins via `require()`. This is sufficient for trusted early adopters, but becomes a liability as the plugin ecosystem grows:

- **Stability**: A segfault in a native module, an infinite loop, or excessive memory consumption in one plugin takes down every other plugin.
- **Security**: Plugins share the same V8 heap and can, in theory, inspect or tamper with each other's in-memory state.
- **Resource accounting**: There is no way to attribute CPU or memory usage to a specific plugin, making it hard to diagnose performance issues.

Per-plugin sandboxing addresses all three concerns by giving each plugin its own isolated execution context, similar to the quarantine model used by the Daemon Engine.

### Batch 7.1 — Sandbox architecture evaluation

**What it produces**:
- A technical evaluation document comparing sandbox strategies:
  - **Node.js Worker Threads** — lightweight, same V8 isolate restrictions, `SharedArrayBuffer`-based communication. Lower overhead than child processes, but limited isolation (shared process memory).
  - **Per-plugin child processes** — full OS-level isolation, independent memory spaces. Higher overhead, but strongest isolation. Each process communicates via the existing PH protocol.
  - **WASM sandbox** — plugins compiled to WebAssembly run in a sandboxed WASM runtime (e.g., Wasmtime, Wasmer). Strongest isolation, but limits plugins to languages that compile to WASM and restricts Node.js API access.
  - **Hybrid approach** — default to Worker Threads for lightweight plugins; escalate to child processes for plugins that declare `native` permissions or exceed resource thresholds.
- A recommendation with rationale, considering Bifrost Forge World's architecture, performance budget, and developer experience goals.

**Verification**: Decision document reviewed and approved before proceeding.

---

### Batch 7.2 — Sandbox runtime implementation

**What it introduces**:
- An `PluginSandbox` abstraction that wraps the chosen isolation mechanism (Worker Thread, child process, or WASM runtime).
- Each plugin gets its own `PluginSandbox` instance, created by the `PluginLoader`.
- The sandbox exposes the same `StudioPluginApi` interface — plugins do not need to change their code.
- The `globalCallbackRegistry` in `plugin-host-main.ts` continues to serve as the central dispatch map, but callbacks are now routed through per-sandbox message channels.
- Resource limits per sandbox (configurable via settings):
  - Memory ceiling (terminate sandbox if exceeded)
  - CPU time budget (warn or throttle)
  - Startup timeout (fail activation if exceeded)

**Files to create/modify**:
- `studio/src/bifrost/common/plugin-host/sandbox/PluginSandbox.ts` — sandbox abstraction
- `studio/src/bifrost/common/plugin-host/sandbox/SandboxManager.ts` — lifecycle management for all sandboxes
- `studio/src/bifrost/common/plugin-host/PluginLoader.ts` — modified to create sandboxes instead of direct `require()`
- `studio/src/bifrost/common/plugin-host/plugin-host-main.ts` — updated dispatch logic

**Verification**: Each plugin runs in its own sandbox. Killing one sandbox does not affect others.

---

### Batch 7.3 — Plugin quarantine

**What it introduces**:
- Automatic quarantine for plugins that repeatedly crash or exceed resource limits:
  - After N crashes within a configurable time window, the plugin is marked as "quarantined" and will not be loaded on the next Studio start.
  - Quarantine state is persisted in `~/.evil/<channel>/plugin-storage/quarantine.json`.
  - A notification informs the user when a plugin is quarantined, with an option to "Trust & re-enable" or "Uninstall".
- The Plugins pane (Phase 2 / 11.1) shows quarantined plugins with a warning badge.
- A `api.diagnostics`-style health report per plugin: crash count, memory peak, average activation time.

**Files to create/modify**:
- `studio/src/bifrost/common/plugin-host/sandbox/QuarantineManager.ts`
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHost.ts` — crash handling updated to quarantine individual plugins instead of restarting the entire host
- Settings: `plugins.quarantine.maxCrashes` (default: 3), `plugins.quarantine.windowMs` (default: 60000)

**Verification**: A plugin that crashes 3 times in 60 seconds is quarantined. It does not load on restart. The user can re-enable it.

---

### Batch 7.4 — Protocol hardening: scoped names, messaging auth, resource roots, symlinks

**What it introduces**:

1. **Scoped npm plugin names** (`@scope/name`): The `evil-webview://` protocol uses the plugin name as the URL hostname. URL hostnames cannot contain `/`, so scoped npm names like `@myorg/my-plugin` are currently rejected. Organizations publishing plugins under their npm scope will hit this limitation. Two approaches to evaluate:
   - **Flatten**: Map `@scope/name` to a hostname-safe form (e.g., `scope--name` or `scope.name`). The protocol handler and plugin discovery resolve the flattened name back to the directory.
   - **Encode**: URL-encode the scope separator. Less readable but reversible.
   This requires changes to `isValidPluginName()`, the protocol handler's path resolution, `PluginIframeManager` tracking, and potentially plugin install directory naming conventions.

2. **Cross-plugin messaging authorization**: Currently, any plugin in the shared child process can call `api.webviews.postMessage(iframeId, ...)` targeting another plugin's iframe — the `iframeId` is the only guard, and IDs are predictable (`editor:<uri>`, `pane:plugin.<name>.<id>`). While DOM/storage isolation holds (different origins), the messaging API should enforce that plugins can only communicate with their own iframes. Add ownership checks: `PluginHostBridge` validates that the `pluginName` from the API request matches the `pluginName` stored in the `PluginIframeManager` entry for the target `iframeId`.

3. **`localResourceRoots` enforcement**: The `webviewOptions.localResourceRoots` parameter is accepted by `EditorsApi`, `PanesApi`, and `WebviewApi` but **not enforced** — the protocol handler serves all files under the plugin's install directory regardless. This parameter should restrict which subdirectories the iframe can load resources from. The protocol handler must check that the resolved path falls within one of the declared resource roots (or the plugin root if no roots are specified). This prevents a plugin from accidentally exposing sensitive files in its install directory (e.g., `.env`, credential configs) to the iframe context.

4. **Symlink traversal protection**: The protocol handler validates the **logical** path via `path.relative()`, but `net.fetch(file://...)` follows filesystem symlinks. A plugin could ship a symlink `link → /etc` and request `/link/passwd`; the logical path appears to be inside the plugin root, but the OS resolves it outside. Add `fs.realpath()` or `fs.lstat()` to verify the actual target stays within the plugin's install directory.

**Files to create/modify**:
- `studio/src/bifrost/electron-main/entrypoint-electron-main.ts` — `isValidPluginName()` update, path resolution for scoped names, `localResourceRoots` enforcement, symlink check via `fs.realpath()`
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` — ownership check in `handleWebviewsApi` and `registerCallback` for `webviews.onMessage`; pass `localResourceRoots` to the main process (e.g., via IPC on document type / pane registration)
- `studio/src/components/webview/PluginIframeManager.ts` — expose `pluginName` for ownership verification

**Verification**: A plugin with a scoped npm name (e.g., `@evil/example-plugin`) loads correctly in an iframe. Plugin A cannot send messages to Plugin B's iframe. A plugin with `localResourceRoots: ['webview/dist']` cannot load files from `config/secrets.json`. A plugin containing a symlink to `/etc` receives 403 for requests following that symlink.

---

### Batch 7.5 — Documentation: Sandboxing & quarantine

**What changes**:
- Update `docs/architecture/plugin-host.md` with the sandboxing model, resource limits, and quarantine mechanism.
- Update `docs/plugin-development-guide.md` with guidance on sandbox constraints and how to avoid quarantine.
- Add entry to `docs/decisions.md` with the sandboxing strategy decision and rationale.

---

## [DONE] Phase 8 — Editor Document Enrichment

**Goal**: Allow plugins to enrich the Studio's editor documents — most critically the BPMN modeler — with custom overlays, event listeners, palette/context pad entries, and, for advanced use cases, full diagram-js module injection. This phase is what turns plugins from passive sidebar/pane tools into first-class participants in the editing experience.

**Permission model (implemented)**: Tiered permissions replace the previous `renderer-modules` single gate:
- `bpmn` (low risk) — read elements, events, overlays
- `bpmn.modelling` (medium risk) — model modification, palette/context pad
- `bpmn.renderer` (high risk) — renderer module injection

**Dropped from v1**: `setElementColor` / `setElementColors` — custom element coloring is deferred. Renderer modules cover the use case for plugins that truly need it.

**Completed**: 2026-06-24. All batches (8.1–8.4, 8.KS, 8.PG, 8.5) delivered. Detailed plan and checklist: `.cursor/plans/phase_7_editor_enrichment_09c9a866.plan.md`. Architecture reference: `docs/architecture/plugin-bpmn-enrichment.md`.

The BPMN editor is the Studio's core differentiator. Plugins must be able to enhance it meaningfully — from simple annotation overlays (like a linter) to complex interactive features (like a token simulator). This phase addresses the fundamental tension between process isolation (plugins run in the Plugin Host, not the renderer) and deep editor integration (the bpmn-js modeler lives in the renderer DOM).

The approach is **layered**: safe declarative APIs cover the common cases; a privileged renderer injection mechanism covers the rest.

### Batch 8.1 — BPMN overlay & element event API (declarative, safe)

**What it introduces**:
- A new `api.bpmn` namespace in `StudioPluginApi` for interacting with open BPMN documents.
- **Overlays**: Plugins can place declarative overlays on BPMN elements. The Plugin Host sends overlay descriptors to the renderer, which renders them using the diagram-js `overlays` service.

```javascript
api.bpmn.setOverlays(uri, [
  {
    elementId: 'Task_1',
    position: 'top-right',
    type: 'badge',
    content: '3',
    style: 'warning',
  },
  {
    elementId: 'Gateway_1',
    position: 'bottom',
    type: 'tooltip',
    content: 'Missing condition expression',
    style: 'error',
  },
]);

api.bpmn.clearOverlays(uri);
api.bpmn.clearOverlays(uri, { elementId: 'Task_1' });
```

- **Overlay types**: `badge` (small colored label), `tooltip` (hover-triggered text), `icon` (small icon indicator), `html` (rendered from a sanitized HTML string — no scripts, limited tags).
- **Overlay styles**: `info`, `warning`, `error`, `success`, `neutral` — map to theme-aware CSS classes. Plugins can also provide custom CSS class names declared in their webview theme stylesheet.
- **Element coloring**: Plugins can tint elements with semantic colors:

```javascript
api.bpmn.setElementColors(uri, [
  { elementId: 'Task_1', fill: 'var(--evil-warning-bg)', stroke: 'var(--evil-warning-border)' },
]);
```

- **Element events**: Plugins can subscribe to user interactions with BPMN elements:

```javascript
api.bpmn.onElementSelected(uri, (event) => {
  // event: { elementId, elementType, position }
});
api.bpmn.onElementHover(uri, (event) => { ... });
api.bpmn.onElementDoubleClick(uri, (event) => { ... });
api.bpmn.onElementContextMenu(uri, (event) => { ... });
```

- **Element queries**: Plugins can read (but not modify) the BPMN model:

```javascript
const elements = await api.bpmn.getElements(uri);
// Returns: [{ id, type, name, parent, properties }]

const element = await api.bpmn.getElement(uri, 'Task_1');
// Returns: { id, type, name, parent, properties, incoming, outgoing }

const xml = await api.bpmn.getXml(uri);
```

**Architecture**:
- All data flows through the PH protocol as serializable JSON. The plugin never touches the DOM.
- The renderer-side bridge (`PluginHostBridge`) translates overlay descriptors into diagram-js `overlays.add()` calls and element event subscriptions into `eventBus` listeners.
- Overlays are automatically cleared when the BPMN document closes or the plugin is deactivated.
- Element queries are read-only snapshots — they do not expose live references to bpmn-js internal objects.

**Files to create/modify**:
- `studio/src/bifrost/common/plugin-host/api/BpmnApi.ts` — Plugin Host child process side (plugin-facing API)
- `studio/src/bifrost/electron-renderer/plugin-host/BpmnApiBridge.ts` — renderer-side execution against diagram-js
- `studio/src/bifrost/contracts/PluginHostProtocol.ts` — new PH message types for BPMN operations
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` — extend with `bpmn` namespace handling

**Verification**: A test plugin places overlays on BPMN elements. Overlays render correctly, adapt to theme changes, and are cleared on plugin deactivation. Element events fire and reach the plugin.

---

### Batch 8.2 — Declarative palette & context pad contributions

**What it introduces**:
- Plugins can add entries to the **BPMN palette** (left toolbar) and the **context pad** (element-level actions) through their manifest, without injecting any code into the renderer:

```json
"contributes": {
  "bpmnPalette": [
    {
      "id": "myPlugin.runAnalysis",
      "group": "tools",
      "icon": "ph-magnifying-glass",
      "title": "Run Analysis",
      "command": "myPlugin.runAnalysis"
    }
  ],
  "bpmnContextPad": [
    {
      "id": "myPlugin.inspectElement",
      "icon": "ph-info",
      "title": "Inspect with MyPlugin",
      "command": "myPlugin.inspectElement",
      "elementTypes": ["bpmn:Task", "bpmn:SubProcess"]
    }
  ]
}
```

- Palette entries appear in a dedicated "Plugins" group in the BPMN palette, visually separated from the built-in entries.
- Context pad entries appear in a "Plugins" section of the context pad, only for the declared `elementTypes`.
- Clicking an entry executes the declared command with the current element ID and type as arguments.
- Icons use the Studio's existing icon system (Phosphor icons or plugin-provided icons from the manifest).

**Architecture**:
- The `ContributionRegistrar` (Phase 4) reads these manifest entries at discovery time and registers them with a new `PluginPaletteProvider` and `PluginContextPadProvider` — diagram-js modules that the `bpmn-core` extension registers once, acting as a multiplexer for all plugin contributions.
- No plugin code runs in the renderer. The providers simply call `bifrost.commands.executeCommand()` when an entry is clicked.

**Files to create/modify**:
- `studio/src/modules/bpmn-core/modules/PluginPaletteProvider.ts` — diagram-js palette provider for plugin entries
- `studio/src/modules/bpmn-core/modules/PluginContextPadProvider.ts` — diagram-js context pad provider for plugin entries
- `studio/src/bifrost/electron-renderer/plugin-host/manifest/ContributionRegistrar.ts` — extend to handle `bpmnPalette` and `bpmnContextPad`
- `studio/src/bifrost/common/plugin-host/manifest/ManifestTypes.ts` — new contribution types

**Verification**: A test plugin declares palette and context pad entries in its manifest. The entries appear in the BPMN editor, and clicking them executes the corresponding command with the correct element context.

---

### Batch 8.3 — BPMN modeling API (declarative, safe)

**What it introduces**:
- Plugins can programmatically modify the BPMN model through a safe, serializable API:

```javascript
api.bpmn.modeling.updateProperties(uri, 'Task_1', {
  name: 'Updated Task Name',
  'custom:priority': 'high',
});

api.bpmn.modeling.setElementColor(uri, 'Task_1', {
  fill: '#e8f5e9',
  stroke: '#2e7d32',
});

api.bpmn.modeling.appendElement(uri, 'Task_1', {
  type: 'bpmn:ExclusiveGateway',
  name: 'Decision',
});
```

- All modeling operations go through the diagram-js `commandStack`, so they are undoable.
- Operations are validated before execution — invalid element IDs, unsupported property changes, or structurally invalid modifications are rejected with clear error messages.
- The API supports a subset of modeling operations. Complex operations (e.g., rearranging an entire subprocess) are deliberately excluded to prevent plugins from producing corrupt BPMN XML.

**Supported operations**:
- `updateProperties` — change element properties (name, documentation, custom properties)
- `setElementColor` — change element fill/stroke
- `removeElement` — delete an element
- `appendElement` — add a new element connected to an existing one
- `createConnection` — create a sequence flow between two elements
- `moveElement` — change element position

**Architecture**:
- The `BpmnApiBridge` in the renderer translates API calls into diagram-js `modeling` service calls.
- Each operation is wrapped in a try/catch — errors are reported back to the Plugin Host, never crash the renderer.

**Files to create/modify**:
- `studio/src/bifrost/common/plugin-host/api/BpmnApi.ts` — extend with modeling namespace
- `studio/src/bifrost/electron-renderer/plugin-host/BpmnApiBridge.ts` — extend with modeling execution

**Verification**: A test plugin modifies element properties, appends elements, and creates connections. All operations are undoable via Ctrl+Z. Invalid operations produce clear error messages.

---

### Batch 8.4 — Renderer module injection (privileged, opt-in)

**What it introduces**:
- For use cases that exceed the declarative API (e.g., building something as complex as a Token Simulator), plugins can declare **renderer-injected diagram-js modules**:

```json
"contributes": {
  "bpmnModules": [
    {
      "entry": "dist/renderer/my-bpmn-module.js",
      "description": "Custom token animation overlay"
    }
  ]
}
```

- The declared JS bundle is loaded into the **renderer process** and registered via `bpmn.modeler.registerModule`, exactly as internal extensions do.
- The module has full diagram-js access: `eventBus`, `canvas`, `overlays`, `modeling`, `commandStack`, `elementRegistry`, `selection`, and all other diagram-js services.
- The module does **not** have access to `Bifrost`, `StudioPluginApi`, or any Studio internals beyond diagram-js. It receives a narrow communication channel to its Plugin Host counterpart:

```javascript
// Inside the renderer module
function MyRendererModule(eventBus, pluginChannel) {
  pluginChannel.onMessage((msg) => { /* handle messages from Plugin Host */ });
  pluginChannel.postMessage({ type: 'ready' });
}
MyRendererModule.$inject = ['eventBus', 'pluginChannel'];
```

- The `pluginChannel` is a sandboxed message pipe that relays between the renderer module and the plugin code in the Plugin Host, through the existing PH protocol.

**Security model**:
- Renderer module injection is a **privileged capability**.
- The manifest must declare the `renderer` permission.
- The Marketplace (Phase 11) flags plugins with renderer modules prominently.
- Users must explicitly approve the `renderer` permission on install.
- A renderer module crash is caught and reported — the plugin is deactivated, but the BPMN editor recovers.

**Isolation boundaries**:
- The module runs in the renderer's JavaScript context (same V8 isolate as the Studio). This is an intentional trade-off: full diagram-js power requires DOM access.
- The module is loaded in a dedicated scope and cannot access `window.bifrost`, React internals, or other plugins' modules.
- In Phase 7 (Per-Plugin Sandboxing), renderer modules can optionally be loaded inside an `<iframe>` sandbox for stronger isolation, at the cost of diagram-js service proxying overhead.

**Files to create/modify**:
- `studio/src/modules/bpmn-core/modules/PluginModuleLoader.ts` — loads and registers plugin-provided diagram-js modules
- `studio/src/modules/bpmn-core/modules/PluginChannel.ts` — per-plugin message channel injected into the DI container
- `studio/src/bifrost/contracts/PluginHostProtocol.ts` — new PH message types for renderer module communication
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHost.ts` — load renderer bundles from plugin directories

**Verification**: A test plugin injects a diagram-js module that adds a custom overlay via the canvas. The module communicates with its Plugin Host counterpart through `pluginChannel`. Deactivating the plugin removes the module's effects.

---

### Batch 8.5 [CANCELED] — Editor Document type enrichment (generic, beyond BPMN)

**What it introduces**:
- Generalizes the overlay and event APIs from Batch 8.1 to work with **any editor document type**, not just BPMN:

```javascript
// Monaco text editors
api.editors.setDecorations(uri, decorations);   // already in Batch 6.3
api.editors.onCursorChange(uri, callback);

// Any editor document type that opts in
api.editors.setOverlays(uri, overlays);
api.editors.onElementSelected(uri, callback);
```

- Editor document types can opt into plugin enrichment by implementing an `EditorEnrichmentBridge` interface:
  - `applyOverlays(overlays)` — how to render plugin-provided overlays for this document type
  - `subscribeElementEvents(callback)` — how to wire element interaction events
  - `queryElements()` — how to return a serializable snapshot of the document's elements
- The BPMN editor's `BpmnApiBridge` (Batch 8.1) becomes the reference implementation of this interface.
- The DMN editor implements the interface in Phase 9 (`DmnApiBridge`). Future editor document types (e.g., CMMN or custom diagram types) can provide their own bridge implementations without any changes to the plugin API.

**Architecture**:
- The `PluginHostBridge` dispatches enrichment API calls to the correct `EditorEnrichmentBridge` based on the document type of the target URI.
- If no bridge exists for a document type, the API call returns an error: "Document type does not support plugin enrichment."
- This follows the same pattern as the `EditorDocumentInspector` and the pluggable merge resolver — the framework provides the dispatch, individual document types provide the implementation.

**Files to create/modify**:
- `studio/src/bifrost/electron-renderer/plugin-host/EditorEnrichmentBridge.ts` — interface definition
- `studio/src/bifrost/electron-renderer/plugin-host/BpmnApiBridge.ts` — refactored to implement the interface
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` — generic dispatch

**Verification**: The BPMN overlay API works through the generic dispatch. A hypothetical second document type can implement enrichment by providing its own bridge.

---

### Batch 8.6 — Documentation: Editor document enrichment

**What changes**:
- New architecture doc: `docs/architecture/plugin-editor-enrichment.md`
- Covers: declarative overlay API, palette/context pad contributions, modeling API, renderer module injection, security model, `EditorEnrichmentBridge` interface
- Update `docs/plugin-development-guide.md` with a "BPMN Integration" chapter
- Update `docs/architecture/plugin-host.md` with the `api.bpmn` namespace
- Add entry to `docs/decisions.md`: rationale for the layered approach (declarative + privileged injection)

---

## [DONE] Phase 9 — DMN Editor Enrichment

**Goal**: Extend the plugin enrichment capabilities from Phase 8 to the DMN editor. Plugins should be able to enrich the DMN Decision Requirements Diagram (DRD) with custom overlays, event listeners, palette/context pad entries, modeling operations, and renderer module injection — mirroring the BPMN enrichment API. Phase 8's `BpmnApiBridge` establishes the patterns; this phase implements a parallel `DmnApiBridge` (no shared generic bridge — per Phase 8 Decision #2).

**Prerequisite**: Phase 8 (BPMN Editor Enrichment) must be complete.

**Permission model (implemented)**: `dmn` → `dmn.modelling` → `dmn.renderer` (mirrors the BPMN tiered model).

**Scope**: The DMN editor has four views: **DRD** (Decision Requirements Diagram), **Decision Table**, **Literal Expression**, and **Boxed Expression**. Plugin enrichment targets the **DRD view only** — it is the diagrammatic view with positioned elements, a palette, and a context pad. The expression editors (table, literal, boxed) are data-entry views without the spatial element model that overlays and palette entries require.

**Completed**: 2026-07-24. All batches (9.1–9.5 below) delivered. Detailed plan and checklist: `.cursor/plans/phase9_dmn_plugin_api_c4e19a7b.plan.md`. Architecture reference: `docs/architecture/plugin-dmn-enrichment.md` and `docs/architecture/dmn-editor.md`. Note: the pre-Phase-7 internal `api/DmnApi.ts` / `api/StudioPluginApi.ts` class hierarchy referenced in the original batch descriptions below was removed on 2026-07-24 (see `docs/decisions.md`) — the actual plugin-facing API is built inline by `createPluginApi()` in `studio/src/bifrost/common/plugin-host/sandbox/sandbox-worker.ts`, with public types defined in `studio-sdk/src/plugin-api/DmnApi.ts` and `studio-sdk/src/plugin-api/StudioPluginApi.ts`.

### DMN editor infrastructure (current state)

The DMN editor is built on the same patterns as the BPMN editor:

| DMN Component | BPMN Equivalent |
|---------------|-----------------|
| `DmnModelerComponentAdapter` | `BpmnModelerComponentAdapter` |
| `DmnModelerModuleRegistry` + `dmn.modeler.registerModule` | `BpmnModelerModuleRegistry` + `bpmn.modeler.registerModule` |
| `DmnDocumentModel` | `BpmnDocumentModel` |
| `DmnDocumentElementAccess` | `BpmnDocumentElementAccess` |
| `DmnValidationOverlayManager` (DRD overlays) | `BpmnElementOverlayManager` + linter overlays |
| `DmnDocumentRenderer` (view switcher) | `BpmnDocumentRenderer` |

Key differences:
- **Multi-view**: DMN has four view types. The DRD is the only view with diagram-js services (palette, context pad, overlays, element registry).
- **Element types**: DRD elements are `dmn:Decision`, `dmn:InputData`, `dmn:BusinessKnowledgeModel`, `dmn:KnowledgeSource`, `dmn:DecisionService`, and various requirement connections.
- **`additionalModules`**: DMN modules are injected into the DRD viewer only (`drd: { additionalModules }` in the `DmnModeler` constructor), not the expression editors.
- **Existing module registry**: `dmn.modeler.registerModule` exists but is currently unused by any extension.

---

### [DONE] Batch 9.1 — DMN Enrichment Bridge (`DmnEnrichmentBridge`)

**What it introduces**:
- A `DmnApiBridge` class parallel to `BpmnApiBridge` (no shared generic bridge — each diagram type gets its own explicit API per Phase 8 Decision #2).
- The bridge is registered in the `PluginHostBridge` namespace dispatch for the `'dmn'` namespace.
- Plugins use the **`api.dmn`** namespace for DMN-specific operations (overlays, element queries, modeling, renderer modules).

**Overlay support (DRD only)**:
- Same descriptor format as BPMN: `{ elementId, position, type, content, style }`.
- Overlays render on DRD elements via the DRD's diagram-js `overlays` service (accessible through `DmnModelerComponentAdapter`).
- Non-interactive (same as BPMN overlays in v1).
- Overlays are automatically cleared when the view switches away from DRD.

**Element event support (DRD only)**:
- `onElementSelected`, `onElementHover`, `onElementDoubleClick`, `onElementContextMenu` — wired to the DRD's `eventBus`.
- Events only fire when the DRD view is active.

**Element queries**:
- `getElements(uri)` returns all DRD elements as serializable snapshots.
- `getElement(uri, elementId)` returns a detail snapshot including requirements (incoming/outgoing).
- `getXml(uri)` returns the DMN XML.

**View awareness**:
- A new event `onViewChanged(uri, callback)` fires when the user switches DMN views (DRD → decision table → literal expression → boxed expression). Payload: `{ activeView: 'drd' | 'decisionTable' | 'literalExpression' | 'boxedExpression', decisionId?: string }`.
- `getActiveView(uri)` returns the current view type.
- Plugins should subscribe to `onViewChanged` to know when DRD-specific features (overlays, palette) are available.

**Files created/modified** (actual, post-legacy-loader-removal architecture):
- `studio/src/bifrost/electron-renderer/plugin-host/DmnApiBridge.ts` — DMN-specific `EditorEnrichmentBridge` implementation
- `studio-sdk/src/plugin-api/DmnApi.ts` — plugin-facing DMN API type definitions
- `studio-sdk/src/plugin-api/StudioPluginApi.ts` — `readonly dmn: DmnApi`
- `studio/src/bifrost/common/plugin-host/sandbox/sandbox-worker.ts` — inline `createPluginApi()` wires the `dmn` namespace
- `studio/src/bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` — register DMN bridge, add `dmn` namespace dispatch

**Verification**: A test plugin places overlays on DMN DRD elements, subscribes to selection events, and queries the DMN model. Overlays appear only when the DRD view is active.

---

### [DONE] Batch 9.2 — Declarative DRD palette & context pad contributions

**What it introduces**:
- Manifest keys `contributes.dmnPalette` and `contributes.dmnContextPad` — same schema as the BPMN equivalents, but targeting the DRD viewer.
- A `PluginDmnPaletteProvider` and `PluginDmnContextPadProvider` — diagram-js modules registered via `dmn.modeler.registerModule`, acting as multiplexers for plugin contributions. These mirror Phase 8's `PluginPaletteProvider` / `PluginContextPadProvider` for BPMN.
- Runtime API: `api.dmn.registerPaletteEntry()`, `api.dmn.registerContextPadEntry()`.
- Context pad entries can filter on DMN element types (`dmn:Decision`, `dmn:InputData`, etc.).

**Architecture note**: Phase 8 introduces a `PluginBpmnContributionStore` for BPMN. This phase introduces a parallel `PluginDmnContributionStore`. If the two are structurally identical, they can share a generic `PluginDiagramContributionStore<T>` base class.

**Files created/modified** (actual paths):
- `studio/src/modules/dmn-core/dmn-js/Provider/PluginDmnPaletteProvider.ts`
- `studio/src/modules/dmn-core/dmn-js/Provider/PluginDmnContextPadProvider.ts`
- `studio/src/modules/dmn-core/PluginDmnContributionStore.ts`
- `studio/src/modules/dmn-core/index.ts` — register the palette/context pad modules
- `studio/src/modules/dmn-core/DmnModelerComponentAdapter.ts` — wire `setBifrost()` on providers
- `studio/src/bifrost/common/plugin-host/manifest/ManifestTypes.ts` — add `dmnPalette`, `dmnContextPad`
- `studio/src/bifrost/common/plugin-host/manifest/ManifestReader.ts` — validation
- `studio/src/bifrost/electron-renderer/plugin-host/manifest/ContributionRegistrar.ts` — process contributions

**Verification**: A test plugin declares DRD palette and context pad entries. They appear in the DMN editor and execute the declared commands with element context.

---

### [DONE] Batch 9.3 — DMN modeling API

**What it introduces**:
- `api.dmn.modeling.*` — a safe, serializable modeling API for DMN documents:

```javascript
api.dmn.modeling.updateProperties(uri, 'Decision_1', { name: 'Updated Decision' });
api.dmn.modeling.removeElement(uri, 'Decision_1');
api.dmn.modeling.createElement(uri, { type: 'dmn:Decision', name: 'New Decision', position: { x, y } });
api.dmn.modeling.createConnection(uri, sourceId, targetId, { type: 'dmn:InformationRequirement' });
api.dmn.modeling.moveElement(uri, 'Decision_1', { x: 50, y: 0 });
```

- All operations go through the diagram-js `commandStack` on the DRD viewer (undoable via Ctrl+Z).
- Connection types: `dmn:InformationRequirement`, `dmn:KnowledgeRequirement`, `dmn:AuthorityRequirement`.
- Validated before execution — invalid element IDs, unsupported connection types, or structurally invalid modifications are rejected.

**Architecture**: The `DmnApiBridge` resolves the DRD viewer from `DmnModelerComponentAdapter` and calls the diagram-js `modeling` service directly. Only works when the DRD view is active — modeling operations on expression views are not supported via the plugin API.

**Files created/modified** (actual paths):
- `studio-sdk/src/plugin-api/DmnApi.ts` — modeling sub-namespace types
- `studio/src/bifrost/electron-renderer/plugin-host/DmnApiBridge.ts` — modeling execution + validation

**Verification**: A test plugin modifies DMN element properties, creates decisions, connects requirements. Operations are undoable. Invalid operations return clear error messages.

---

### [DONE] Batch 9.4 — DMN renderer module injection

**What it introduces**:
- Plugins can declare `contributes.dmnModules` in the manifest (parallel to `bpmnModules`):

```json
"contributes": {
  "dmnModules": [
    {
      "entry": "dist/renderer/my-dmn-module.js",
      "description": "Custom DRD annotation overlay"
    }
  ]
}
```

- Requires the `renderer` permission (same as BPMN renderer modules).
- The declared JS bundle is loaded into the renderer and registered via `dmn.modeler.registerModule`. The module is injected into the DRD viewer's `additionalModules`.
- The module receives a `pluginChannel` for communication back to the Plugin Host (reuses the same `PluginChannel` infrastructure from Phase 8, Batch 8.4).
- DI-scoping isolation: same constraints as BPMN renderer modules.
- Disabling the plugin force-closes and reopens all DMN editor tabs.

**Reuse from Phase 8**: The `PluginModuleLoader` from Batch 8.4 can be generalized to handle both BPMN and DMN module loading. Alternatively, a `DmnPluginModuleLoader` can parallel the BPMN one if the adapter differences warrant it (DMN modules go into `drd.additionalModules`, not top-level `additionalModules`).

**Files created/modified** (actual paths):
- `studio/src/modules/dmn-core/plugin-modules/PluginDmnModuleLoader.ts`
- `studio/src/modules/dmn-core/DmnModelerModuleRegistry.ts` — extend with per-plugin module tracking (parallel to BPMN registry changes)
- `studio/src/bifrost/common/plugin-host/manifest/ManifestTypes.ts` — add `dmnModules`
- `studio/src/bifrost/common/plugin-host/manifest/ManifestReader.ts` — validation
- `studio/src/bifrost/electron-renderer/plugin-host/manifest/ContributionRegistrar.ts` — load DMN renderer modules

**Verification**: A test plugin injects a diagram-js module into the DRD. The module communicates with its Plugin Host counterpart through `pluginChannel`. Deactivating the plugin removes the module's effects and reopens DMN tabs.

---

### [DONE] Batch 9.5 — Documentation

**What changed** (actual):
- **Created** `docs/architecture/plugin-dmn-enrichment.md` — DMN enrichment architecture reference (parallels `plugin-bpmn-enrichment.md`); documents `DmnApiBridge`, DRD-only scope, deferred-overlay re-application, and the view awareness API.
- **Updated** `docs/plugin-development-guide.md` — new chapter "DMN Integration" covering overlays, palette, modeling, renderer modules, and multi-view awareness.
- **Updated** `docs/architecture/plugin-host.md` — added the `api.dmn` namespace to the API surface table; documented `dmnModules` in the manifest section.
- **Created** `docs/architecture/dmn-editor.md` — architecture reference for the DMN editor (adapter, module registry, document model, element access, validation overlay manager, property panes).
- **Added entry** to `docs/decisions.md` — rationale for DRD-only enrichment scope.

---

## Phase 10 — SDK Audit & Refactoring

**Goal**: Repurpose the Studio SDK (`bifrost-fw-sdk/`) from an internal extension toolkit into the **plugin developer's toolkit**. Internal modules don't need the SDK — they're compiled into the Studio bundle and import directly from Bifrost source. External plugin developers, however, need reusable UI components (for WebViews), `StudioPluginApi` type definitions, manifest types, and design tokens. The SDK should serve this audience exclusively.

**Why now**: By this point, all plugin capabilities (Phases 5–9) are implemented and stable. The full scope of what plugins can declare, access, and render is known. This is the right time to perform a thorough SDK audit: internalize types that only the Studio uses, ensure all plugin-facing types are complete and accurate, validate that reusable components work in WebViews, and clean up legacy artifacts. Performing this audit earlier would risk removing types prematurely — components like BPMN types, which appear internal at first glance, may prove essential for plugin developers as the API surface grows.

### Batch 10.1 — SDK inventory & gap analysis

**What it produces**:
- A comprehensive inventory of every type, interface, contract, React component, and utility in `studio-sdk/`.
- For each item, a classification:
  - **Keep (plugin-facing)** — useful for plugin developers: reusable UI components (Monaco, Tree, Table, MDX editor), design tokens, theme utilities. These stay in the SDK.
  - **Internalize** — only used by internal extensions or Bifrost itself (PaneProvider, menu renderers, internal contracts like `EditorEvents`, `SearchEvents`). These move out of the SDK into the Studio source tree (`studio/src/`).
  - **Drop** — dead code, bridge artifacts, or types that served the old external extension mechanism and are no longer needed by anyone.
  - **Add** — types and utilities the SDK should gain for plugin developers: `StudioPluginApi` types, manifest types, webview API types (`acquireStudioApi`), event type definitions.
- A prioritized list of changes, organized into subsequent batches.

**Key areas to investigate**:
- The `Studio` type — the main SDK surface. Internal extensions don't need it (they use `Bifrost` directly). Plugin developers need `StudioPluginApi`, not `Studio`. Should `Studio` be internalized entirely, or does a slimmed-down version serve plugin WebViews?
- Shared React components (Tree, Table, Tabs, Monaco wrappers, MDX editor) — plugin developers can reuse these in their WebViews. But do they work in an isolated WebView context (no Bifrost context providers, no internal mediators)?
- Internal contracts (`EditorEvents`, `SearchEvents`, `SettingsEvents`, etc.) — these are Bifrost implementation details. Should move to Studio source.
- The `@evil/bifrost_fw_sdk` package scope and naming — should it be renamed to something like `@evil/bifrost-fw-plugin-sdk` to clearly communicate its audience?

**Verification**: A decision document listing every SDK item with its classification and rationale. Reviewed and approved before proceeding.

---

### Batch 10.2 — Internalize Studio-only types and contracts

**What changes**:
- Move all items classified as "Internalize" from `studio-sdk/` into the Studio source tree (e.g., `studio/src/bifrost/contracts/` or co-located with their consumers).
- Update all internal extension imports to point to the new locations.
- Remove dead code classified as "Drop."

**Verification**: SDK builds. Studio builds. No runtime regressions. Internal extensions compile without SDK imports for internalized types.

---

### Batch 10.3 — Add plugin API types to the SDK

**What changes**:
- Add `StudioPluginApi` type definitions and all sub-API types (commands, notifications, settings, events, env).
- Add manifest types (`BifrostManifest`, contribution types, activation event types).
- Add webview API types (`acquireStudioApi`, `postMessage`, `onMessage`, `setState`, `getState`).
- Ensure these types are exported from the SDK's public entry point.

**Verification**: A plugin project with `@evil/bifrost_fw_sdk` as a `devDependency` gets full autocompletion for all plugin APIs.

---

### Batch 10.4 — Validate reusable components for WebView compatibility

**What changes**:
- Audit which React components (Tree, Table, Monaco wrappers, etc.) work in an isolated WebView context — i.e., without Bifrost context providers, `useBifrost()` hooks, or internal mediator subscriptions.
- For components that depend on Bifrost internals, either:
  - Refactor them to accept data via props (making them context-independent), or
  - Provide WebView-compatible wrappers that communicate through the webview message API.
- Document which components are WebView-safe and which are internal-only.

**Verification**: A test WebView can render the SDK's Tree and Table components with mock data, without importing any Bifrost internals.

---

### Batch 10.5 — Documentation: SDK refactoring

**What changes**:
- Update `docs/architecture/extensions.md` to reflect the SDK's new purpose.
- Add entry to `docs/decisions.md`: rationale for repurposing the SDK as the plugin developer toolkit and internalizing extension-only types.
- Update the SDK's `README.md` and `package.json` description to clearly state its audience: "The Bifrost Forge World SDK for plugin developers. Provides type definitions, reusable UI components, and design tokens for building Bifrost Forge World plugins."

---

## Phase 11 — Marketplace

**Goal**: Provide a way for users to discover, install, update, and remove plugins. This is the most complex phase due to legal, logistical, and infrastructure requirements.

### Batch 11.1 — Extend Plugins pane for Marketplace integration

**What it introduces**:
- Phase 2 already provides the core Plugins pane with list, enable/disable, uninstall, and install-from-folder. This batch extends it with Marketplace-specific features:
  - A "Marketplace" tab alongside the existing "Installed" tab.
  - Visual indicators for plugins that have updates available.
  - "Update" button per plugin when a newer version exists in the registry.
  - Auto-update check on Studio startup (configurable via `plugins.autoCheckUpdates` setting).

**Verification**: The Plugins pane shows both installed plugins and Marketplace search results. Update indicators appear when newer versions are available.

---

### Batch 11.2 — Plugin packaging format

**What it introduces**:
- A `.espk` file format (Bifrost Forge World Plugin Package) — a ZIP archive containing:
  - `package.json` with manifest
  - Compiled plugin code
  - Webview assets
  - `LICENSE` and `README.md`
- A CLI command: `evil-plugin pack` that produces a `.espk` from the plugin project.
- The Studio can install `.espk` files (drag-and-drop or "Install from file..." button).

---

### Batch 11.3 — Plugin registry backend

**What it introduces**:
- A web service (API) for the marketplace:
  - `POST /publish` — upload a `.espk` package
  - `GET /search?q=...` — search for plugins
  - `GET /plugin/:name` — get plugin metadata
  - `GET /plugin/:name/download` — download the `.espk` package
- Authentication for publishers (API key or OAuth).
- Basic metadata storage: name, version, description, download count, publisher.

**Note**: The backend infrastructure, hosting, and legal framework (terms of service, content policy, licensing requirements) are out of scope for this technical roadmap and must be planned separately.

---

### Batch 11.4 — Marketplace UI in the Studio

**What it introduces**:
- The Plugins pane gains a "Marketplace" tab:
  - Search field
  - Plugin cards with name, publisher, description, rating, install count
  - Install/update buttons
  - Plugin detail view with README, changelog, screenshots
- Auto-update checks on Studio startup (configurable in settings).

---

### Batch 11.5 — Plugin permissions & trust

**What it introduces**:
- A permission system for plugins:
  - `workspace.readFiles` — can read solution files
  - `workspace.writeFiles` — can write solution files
  - `native` — ~~has a native module (main process code)~~ removed from v1
  - `network` — can make HTTP requests
- Permissions are declared in the manifest and shown to the user on install.
- Users can revoke permissions after install.
- The Plugin Host enforces permissions — API calls that exceed a plugin's granted permissions are rejected.

---

### Batch 11.6 — Documentation: Marketplace & publishing

**What changes**:
- New doc: `docs/plugin-publishing-guide.md`
- Covers: packaging, publishing, versioning, permissions, content policy, update flow

---

## Appendix A — Architecture Principles

The plugin mechanism must adhere to Bifrost Forge World's established principles:

1. **Separation of Concerns** — Plugins have clear boundaries. The Plugin Host isolates plugin code from the UI. Webviews isolate plugin UI from the Studio's DOM.

2. **Let Data Be Data** — All cross-process communication uses plain serializable data objects. No function references, no class instances, no executable code in messages.

3. **Commands as the Primary Interaction Model** — Plugins interact with the Studio through commands, not direct function calls. This ensures uniform behavior regardless of how an action is triggered.

4. **Not Everything Is a Plugin** — Core framework features (editor management, window management, theming, command system) remain in `Bifrost`. Plugins add domain functionality, not framework infrastructure.

5. **Divergence and Convergence** — The API starts small and grows based on real needs. Resist the urge to expose everything upfront.

6. **Let It Crash / Testability** — Plugin crashes are isolated to the Plugin Host and do not bring down the Studio. All errors are surfaced to the user.

---

## Appendix B — Glossary

- **PluginService**: The public facade at `bifrost.plugins` (type `PluginService`). Wraps the `PluginHost` and exposes toggle, uninstall, refresh, and event subscription APIs. Extends `AbstractEmitter` and emits `EVENT_PLUGIN_LIST_CHANGED`. All extensions and UI components interact with this class — never with `PluginHost` directly.
- **Plugin Host**: A Node.js child process forked from the Electron renderer process (one per window). Plugins run here, isolated from the UI. The Electron main process is not involved in plugin communication. The renderer-side `PluginHost` class that manages this child process is an internal implementation detail hidden behind `PluginService`.
- **PH (Plugin Host Protocol)**: The typed message protocol for communication between the Plugin Host child process and the renderer.
- **Webview**: An isolated `<webview>` / `<iframe>` container where plugins can render custom UI using any web technology.
- **Manifest**: The `bifrostStudio` section in a plugin's `package.json`, declaring static contributions and activation events.
- **Packaged Extension**: An internal extension compiled into the Studio bundle. Has full access to `Bifrost` and internal APIs.
- **Plugin**: A third-party extension loaded from disk into the Plugin Host. Has access only to `StudioPluginApi`. All code, UI, and documentation use "Plugin" to distinguish from pre-packaged internal extensions.
- **Activation Event**: A condition that triggers loading a plugin's code (e.g., a command is invoked, a file type is opened).
- **Contribution**: A static declaration in the manifest (command, menu item, setting, icon, keybinding, pane) that is registered without running plugin code.
- **Native Module**: ~~A plugin's main-process code that runs with full Node.js access. Privileged, requires explicit user permission.~~ Removed from v1 roadmap due to security concerns.
- **Plugin Sandbox**: An isolated execution boundary (Worker Thread, child process, or WASM runtime) in which a single plugin runs. Prevents cross-plugin interference.
- **Quarantine**: A safety mechanism that automatically disables a plugin after repeated crashes or resource limit violations. Quarantined plugins are not loaded until the user explicitly re-enables them.
- **Editor Enrichment**: The capability for plugins to enhance editor documents with overlays, element events, and modeling operations through a safe declarative API.
- **EditorEnrichmentBridge**: An interface that editor document types implement to support plugin-provided overlays, element events, and element queries. The BPMN editor's `BpmnApiBridge` is the reference implementation; the DMN editor's `DmnApiBridge` (Phase 9) is the second implementation.
- **Renderer Module Injection**: A privileged, opt-in mechanism that allows plugins to inject diagram-js modules directly into the renderer process, gaining full access to diagram-js services. Requires the `renderer` permission.
- **Plugin Channel**: A sandboxed message pipe connecting a plugin's renderer-injected diagram-js module to its code in the Plugin Host, relayed through the PH protocol.

---

## Appendix C — Current State Reference

### Files removed in Phase 0

| File | Purpose | Replacement |
|------|---------|-------------|
| `studio/src/bifrost/electron-renderer/CodeLoaderElectron.ts` | `vm.runInNewContext` for external extensions | Plugin Host `require()` in `PluginLoader` |
| `studio-sdk/src/components/internal/getModuleFromStudio.ts` | Window bridge consumer | Direct imports |

### Files modified in Phase 0

| File | Change |
|------|--------|
| `studio/src/bifrost/browser/BootstrapInitializer.ts` | Remove `window.__react__` etc. Keep Monaco/tooltip setup |
| `studio/src/bifrost/common/ModuleManager.ts` | Remove `loadExtensionFromUri`, `loadExtensionFromObject` |
| `studio/src/bifrost/browser/ModuleMediator.ts` | Remove `requireAllExtensionsInDirectory`, `requireExtensionInDirectory` |
| `studio/src/bifrost/common/CodeLoader.ts` | Remove `loadUri` (eval-based loader) |
| `studio/src/bifrost/electron-renderer/entrypoint-electron-renderer.tsx` | Remove external extension loading block |

### Key new files introduced across all phases

> Paths below use the **current** directory layout (post-migration). All `plugin-host/` paths are relative to `studio/src/bifrost/`.

| Phase | File | Purpose |
|-------|------|---------|
| 1 | `electron-renderer/plugin-host/PluginHost.ts` | Renderer-side lifecycle manager (forks child process) — **internal, hidden behind PluginService** |
| 1 | `common/plugin-host/plugin-host-main.ts` | Child process entry point |
| 1 | `contracts/PluginHostProtocol.ts` | Shared message types |
| 1 | `contracts/PluginHostConnection.ts` | Promise-based request/response wrapper |
| 1 | `electron-renderer/plugin-host/PluginHostBridge.ts` | Renderer-side API executor |
| 1 | `common/plugin-host/api/StudioPluginApi.ts` | Plugin-facing API (child process) |
| 2 | `common/plugin-host/PluginService.ts` | Public facade at `bifrost.plugins`: toggle, uninstall, refresh, `AbstractEmitter`, event re-emission |
| 2 | `modules/plugins/PluginsPaneRenderer.tsx` | Plugins pane UI (subscribes to `bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED)`) |
| 2 | `modules/plugins/PluginCard.tsx` | Individual plugin card component |
| 3 | `components/webview/PluginIframe.tsx` | React `<iframe>` component with origin validation and crash recovery |
| 3 | `components/webview/PluginIframeManager.ts` | Singleton registry: tracking, messaging, state persistence, theme broadcasting |
| 3 | `components/webview/bridge-script.ts` | Bridge script exposing `acquireStudioApi()` inside plugin iframes |
| 3 | `components/webview/types.ts` | Shared type definitions for iframe postMessage protocol |
| 3 | `electron-renderer/plugin-host/IframeDocumentRenderer.tsx` | Factory creating iframe-backed editor document renderers |
| 3 | `electron-renderer/plugin-host/IframePaneProvider.tsx` | Factory creating iframe-backed pane providers |
| 4 | `common/plugin-host/manifest/ManifestTypes.ts` | TypeScript interfaces for the manifest schema |
| 4 | `common/plugin-host/manifest/ManifestReader.ts` | Plugin manifest parser/validator |
| 4 | `electron-renderer/plugin-host/manifest/ContributionRegistrar.ts` | Processes manifest contributions, returns disposer |
| 4 | `electron-renderer/plugin-host/ActivationManager.ts` | Lazy plugin activation logic |
| 10 | `studio-sdk/` refactored | SDK repurposed as plugin developer toolkit (types, reusable components) |
| 7 | `common/plugin-host/api/BpmnApi.ts` | BPMN overlay, event, and modeling API (child process side) |
| 7 | `electron-renderer/plugin-host/BpmnApiBridge.ts` | Renderer-side BPMN API execution against diagram-js |
| 7 | `electron-renderer/plugin-host/EditorEnrichmentBridge.ts` | Generic enrichment interface for all document types |
| 7 | `modules/bpmn-core/modules/PluginPaletteProvider.ts` | diagram-js palette provider for plugin-declared entries |
| 7 | `modules/bpmn-core/modules/PluginContextPadProvider.ts` | diagram-js context pad provider for plugin-declared entries |
| 7 | `modules/bpmn-core/modules/PluginModuleLoader.ts` | Loads plugin-provided renderer modules into diagram-js |
| 7 | `modules/bpmn-core/modules/PluginChannel.ts` | Per-plugin message channel for renderer module communication |
| 8 | `common/plugin-host/api/DmnApi.ts` | DMN overlay, event, and modeling API (child process side) |
| 8 | `electron-renderer/plugin-host/DmnApiBridge.ts` | Renderer-side DMN API execution against dmn-js DRD |
| 8 | `modules/dmn-core/modules/PluginDmnPaletteProvider.ts` | diagram-js palette provider for DMN plugin entries |
| 8 | `modules/dmn-core/modules/PluginDmnContextPadProvider.ts` | diagram-js context pad provider for DMN plugin entries |
| 8 | `modules/dmn-core/modules/PluginDmnContributionStore.ts` | Shared contribution registry for DMN palette/context pad |
| 8 | `modules/dmn-core/modules/PluginDmnModuleLoader.ts` | Loads plugin-provided renderer modules into dmn-js DRD |
