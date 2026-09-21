# Webview System

## Overview

The webview system lets external plugins render custom UI inside sandboxed `<iframe>` containers. Each plugin's iframe runs in an isolated origin served by a custom Electron protocol, communicating with the plugin's backend code (in the Plugin Host child process) through a structured `postMessage` pipeline.

Three integration surfaces are available to plugins:

| Surface | API | iframeId prefix | Rendering context |
|---------|-----|-----------------|-------------------|
| **Editor document** | `api.editors.registerWebviewDocumentType()` | `editor:` | Editor tab (main content area) |
| **Pane** | `api.panes.registerWebviewPane()` | `pane:` | Pane area (left, right, bottom sidebar) |
| **Standalone panel** | `api.webviews.createPanel()` | `webview:` | _Stub — not yet fully implemented_ |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Plugin Host child process (Node.js)                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ StudioPluginApi                                      │    │
│  │  .webviews  → WebviewApi   (postMessage, onMessage)  │    │
│  │  .editors   → EditorsApi   (registerWebviewDocType)   │    │
│  │  .panes     → PanesApi     (registerWebviewPane)      │    │
│  └───────────────────┬──────────────────────────────────┘    │
│                      │ PH_API_REQUEST / PH_REGISTER_CALLBACK │
│                      │ PH_CALLBACK_INVOCATION                │
└──────────────────────┼───────────────────────────────────────┘
                       │ Node IPC (process.send / process.on)
┌──────────────────────┼───────────────────────────────────────┐
│  Renderer (Electron) │                                       │
│  ┌───────────────────┴──────────────────────────────────┐    │
│  │ PluginHostBridge                                     │    │
│  │  dispatches to handlers per namespace                │    │
│  └───────────────────┬──────────────────────────────────┘    │
│                      │                                       │
│  ┌───────────────────┴──────────────────────────────────┐    │
│  │ PluginIframeManager                                  │    │
│  │  tracks active iframes, routes messages, theme cache │    │
│  └───────────────────┬──────────────────────────────────┘    │
│                      │                                       │
│  ┌───────────────────┴──────────────────────────────────┐    │
│  │ PluginIframe (React component)                       │    │
│  │  <iframe sandbox="allow-scripts allow-same-origin">  │    │
│  │  src="bifrostfw-webview://<pluginName>/<entryPoint>"      │    │
│  └───────────────────┬──────────────────────────────────┘    │
│                      │ contentWindow.postMessage             │
└──────────────────────┼───────────────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────────────┐
│  iframe (web context) │                                      │
│  ┌────────────────────┴─────────────────────────────────┐    │
│  │ bridge-script.ts (studio-bridge.js)                  │    │
│  │  acquireStudioApi() → { postMessage, onMessage,      │    │
│  │                         setState, getState,           │    │
│  │                         getThemeType }                │    │
│  └──────────────────────────────────────────────────────┘    │
│  Plugin's React/HTML app                                     │
└──────────────────────────────────────────────────────────────┘
```

## Custom Protocol — `bifrostfw-webview://`

### Registration

The protocol is registered in `entrypoint-electron-main.ts` in two stages:

1. **Before `app.ready`**: `protocol.registerSchemesAsPrivileged` declares the scheme as privileged with `standard: true`, `secure: true`, `supportFetchAPI: true`.
2. **Inside `app.ready`**: `protocol.handle` serves files from plugin directories.

The scheme name follows the release channel pattern: `bifrostfw-webview` (stable) or `bifrostfw-webview-<channel>` (dev/beta).

### Origin model

Each plugin gets a unique origin: `bifrostfw-webview://<pluginName>/`. The hostname encodes the plugin name; the pathname is resolved relative to the plugin's install directory (`getPluginsDir()/<pluginName>/`).

### Path resolution

| Request | Served from |
|---------|-------------|
| `/studio-bridge.js` | App bundle directory (`out/studio-bridge.js`) |
| Any other path | Plugin install directory |

### Security

| Protection | Implementation |
|------------|----------------|
| **Path traversal** | `path.resolve()` + `path.relative()` boundary check |
| **Plugin name validation** | Regex `/^[@a-z0-9][@a-z0-9._-]*$/` rejects `.`, `..`, path separators |
| **CSP** | Response header: `default-src 'none'`, scoped `script-src`/`style-src`/`img-src`/`font-src`/`connect-src` to plugin's own origin |
| **Sandbox** | `allow-scripts allow-same-origin` (no navigation, popups, modals, forms) |
| **No Node.js** | Iframes have no `nodeIntegration`, no `contextIsolation` bypass |
| **Origin validation** | `PluginIframe` validates `event.origin` on every `message` event |
| **No X-Frame-Options** | Intentionally omitted — parent and iframe are cross-origin by design; clickjacking is not applicable in a desktop app |

### Protocol plumbing

The `webviewProtocol` scheme name flows from the Electron main process to the renderer:

1. `entrypoint-electron-main.ts` computes `webviewProtocolName`
2. `BifrostWindow` serializes it into the URL `windowOptions` query param
3. `entrypoint-electron-renderer.tsx` reads it → `BifrostOptions.webviewProtocol`
4. `Bifrost` stores it in `Environment.webviewProtocol`
5. `PluginHost` reads it from `this.bifrost.env.webviewProtocol`

## File Layout

```
studio/src/components/webview/
├── PluginIframe.tsx          — React <iframe> component with origin validation
├── PluginIframeManager.ts    — Singleton registry: tracking, messaging, state, themes
├── bridge-script.ts          — Runs inside iframe; exposes acquireStudioApi()
└── types.ts                  — Shared message envelope types

studio/src/bifrost/electron-renderer/plugin-host/
├── IframeDocumentRenderer.tsx — Factory: editor tab ↔ PluginIframe
├── IframePaneProvider.tsx     — Factory: pane ↔ PluginIframe
├── PluginHostBridge.ts        — Dispatcher for editors/panes/webviews namespaces
└── PluginHost.ts              — Theme wiring, iframe manager lifecycle

studio/src/bifrost/common/plugin-host/api/
├── WebviewApi.ts              — Child process: createPanel, postMessage, onMessage
├── EditorsApi.ts              — Child process: registerWebviewDocumentType, openDocument
├── PanesApi.ts                — Child process: registerWebviewPane
└── StudioPluginApi.ts         — Aggregate: webviews + editors + panes + ...

studio-sdk/src/webview/
└── studio-webview-theme.css   — Reference CSS: documents all --theme-* tokens
```

## Message Flow

### Plugin → iframe (host-to-guest)

```
Plugin code (child process)
  → api.webviews.postMessage(iframeId, data)
  → PH_API_REQUEST { namespace: 'webviews', method: 'postMessage' }
  → (Node IPC: child → renderer)
  → PluginHostBridge.handleWebviewsApi
  → pluginIframeManager.postMessageToIframe(iframeId, data)
  → iframeRef.contentWindow.postMessage({
      channel: 'studio-bridge',
      direction: 'to-guest',
      payload: { type: 'plugin-message', data }
    }, expectedOrigin)
  → bridge-script.ts: message listener → plugin's onMessage callback
```

### iframe → Plugin (guest-to-host)

```
Plugin iframe: acquireStudioApi().postMessage(data)
  → window.parent.postMessage({
      channel: 'studio-bridge',
      direction: 'to-host',
      payload: { type: 'plugin-message', data }
    }, '*')
  → PluginIframe 'message' event [validates origin]
  → pluginIframeManager.handleIframeMessage(iframeId, payload)
  → entry.messageHandler(data)
  → PH_CALLBACK_INVOCATION { callbackId, args: [data] }
  → (Node IPC: renderer → child)
  → callbackRegistry: getGlobalCallback(callbackId)(data)
  → plugin's onMessage callback fires
```

### Message envelope types

```typescript
// Host → iframe
interface BridgeMessageToGuest {
  channel: 'studio-bridge';
  direction: 'to-guest';
  payload: PluginIframeGuestMessage;  // plugin-message | restore-state | theme
}

// iframe → Host
interface BridgeMessageToHost {
  channel: 'studio-bridge';
  direction: 'to-host';
  payload: PluginIframeHostMessage;   // plugin-message | set-state
}
```

## State Persistence

The bridge script exposes `setState(state)` and `getState()` for lightweight state survival across iframe reloads:

1. `setState(data)` → sends `{ type: 'set-state', state: data }` to the host
2. `PluginIframeManager` stores `entry.state = data` in a renderer-side Map
3. On `PluginIframe` load event → `sendRestoredState(iframeId)` posts `{ type: 'restore-state', state }` back to the iframe
4. Bridge script receives it → updates `currentState` → guest reads via `getState()`

State is keyed by `iframeId` and survives iframe reloads but not window closes (no disk persistence).

## Theming Bridge

Theme propagation ensures plugin iframes match the Studio's appearance.

### Token extraction

`PluginHost.extractThemeTokens()` scans CSS rules in the renderer DOM for selectors containing `bifrost-theme--*` and collects all `--theme-*` custom properties from the computed style of the `.bifrost` root element.

### Broadcast flow

```
ThemeMediator.setTheme(id)
  → emit EVENT_THEME_CHANGED
  → PluginHost handler:
    1. extractThemeTokens()     → Record<string, string>
    2. getCurrentThemeType()    → 'light' | 'dark'
    3. pluginIframeManager.broadcastThemeTokens(tokens, themeType)
      → for each active iframe: postMessage({ type: 'theme', tokens, themeType })
      → bridge-script: applyThemeTokens(tokens, themeType)
        → injects/updates <style id="studio-theme-tokens">:root { --theme-*: ... }</style>
        → sets data-theme attribute on <html>
```

### Initial load

`PluginIframeManager` caches the latest theme tokens (`currentThemeTokens`, `currentThemeType`). When an iframe fires its `load` event, `sendRestoredState()` also sends the cached theme, ensuring new iframes are themed immediately.

### SDK reference

`studio-sdk/src/webview/studio-webview-theme.css` is a documentation-only file listing all available `--theme-*` tokens with Bifrost Night fallbacks. `ThemeToken` in `studio-sdk/src/plugin-api/theme/ThemeTokens.ts` is the typed const map of the same names. Plugin developers can reference both; neither is loaded at runtime. Live values are injected into iframes by `PluginHost.extractThemeTokens()`.

The SDK is not a chrome kit. Tab strips, pane title bars, Tree, host CodeMirror wrappers, Markdown, and host widgets (`Icon`, `Table`, `Checkbox`, `ColorPicker`) stay in the host. Inside the iframe, plugins use forwarded `--theme-*` tokens plus content controls (`FormInput`, `PaneProperty` / `PropertyValidation` / `PropertyValueWithSuggestions`, `FeelEditor` / `OneLineFeelEditor`, `PresentationalContextMenu`).

Phosphor in webviews: use `<span className="ph-…">`. The host does not inject Phosphor into iframes. Manifest `icon` on panes/tabs is host-rendered and already works.

### Token categories

| Category | Example tokens |
|----------|---------------|
| Core palette | `--theme-fg`, `--theme-editor-bg`, `--theme-accent`, `--theme-border` |
| Surfaces | `--theme-surface-primary`, `--theme-surface-elevated`, `--theme-surface-inset` |
| Inputs | `--theme-input-bg` |
| Buttons | `--theme-button-bg`, `--theme-button-hover-bg` |
| Feel / table (Keep components) | `--theme-feel-*`, `--theme-table-*` |
| Scrollbars | `--theme-scrollbar-track`, `--theme-scrollbar-thumb` |
| Status colors | `--theme-success`, `--theme-warning`, `--theme-error`, `--theme-info` |

## Editor Document Integration

### Registration

```typescript
api.editors.registerWebviewDocumentType({
  id: 'my-editor',
  displayName: 'My Editor',
  icon: 'ph ph-browser',
  uriPattern: '^ext://myPlugin/',
  webviewOptions: { entryPoint: 'webview/dist/index.html' },
  onDidOpen: (iframeId, uri) => {
    api.webviews.onMessage(iframeId, (data) => { /* ... */ });
  },
});
```

### How it works

1. `EditorsApi.registerWebviewDocumentType()` sends `PH_API_REQUEST` to the renderer
2. `PluginHostBridge.handleEditorsApi` creates an `IframeDocumentRenderer` constructor via `createIframeDocumentRendererConstructor(context)` and registers it with `bifrost.editors.registerDocumentType()`
3. Document type ID is namespaced: `plugin.<pluginName>.<id>`
4. When a matching URI is opened, `EditorWrapper` resolves the renderer and mounts `IframeDocumentRenderer`
5. `IframeDocumentRenderer` creates a `PluginIframe` with `iframeId = 'editor:<uri>'`
6. On mount, `useEffect` fires the `onDidOpenNotifier`, which invokes `PH_CALLBACK_INVOCATION` → plugin's `onDidOpen` callback with `(iframeId, uri)`
7. The plugin uses `api.webviews.onMessage(iframeId, handler)` to wire up per-document messaging

### Cleanup

On plugin unload, the disposer calls `bifrost.editors.unregisterDocumentType(id)`, which force-closes all open tabs and removes all sub-manager entries.

## Pane Integration

### Registration

```typescript
api.panes.registerWebviewPane({
  id: 'sidebar',
  title: 'My Sidebar',
  area: 'left',
  icon: 'ph ph-puzzle-piece',
  webviewOptions: { entryPoint: 'webview/dist/sidebar.html' },
  visibleWhen: { documentType: 'bpmn' },  // optional
});
```

### How it works

1. `PanesApi.registerWebviewPane()` sends `PH_API_REQUEST` to the renderer
2. `PluginHostBridge.handlePanesApi` creates an `IframePaneProvider` via `createIframePaneProvider(context)`
3. The provider is registered with `bifrost.panes.getPaneViaPaneProvider()`
4. If `groupId` is specified and points to an existing group, the pane is appended to it; otherwise, a new pane group is created for the plugin
5. Pane ID is namespaced: `plugin.<pluginName>.<id>`
6. `IframePaneProvider` creates a `PluginIframe` with `iframeId = 'pane:<paneId>'`
7. Messaging works identically to editor documents via `api.webviews.onMessage()` / `api.webviews.postMessage()`

### Visibility

The optional `visibleWhen.documentType` field maps to `PaneProvider.shouldBeDisplayed()`: the pane is only shown when the focused editor document matches the specified type. Omitting `visibleWhen` makes the pane always visible.

### Cleanup

On plugin unload, the disposer calls `bifrost.panes.unregisterPane(paneId)` and `bifrost.panes.unregisterPaneProvider(providerId)`, removing the pane from the UI and the provider from the registry.

## Build

### studio-bridge.js

The bridge script is compiled as a separate Rspack entry in `rspack.config.electron-main.js` (`configBridgeScript`):

- **Target**: `'web'` (no Node.js APIs)
- **Entry**: `studio/src/components/webview/bridge-script.ts`
- **Output**: `out/studio-bridge.js`

The custom protocol handler serves this file for any request to `/studio-bridge.js`, regardless of which plugin is being loaded.

### Plugin webviews

Plugin developers are expected to bundle their webview frontend (React, Vue, plain HTML, etc.) using any build tool (esbuild, webpack, Vite). The compiled output is placed in the plugin's directory and referenced via `webviewOptions.entryPoint`.

The `webview-showcase` fixture plugin uses esbuild:

```
webview/build.mjs → webview/dist/index.html + main.js + styles.css
                   → webview/dist/sidebar.html + sidebar.js + sidebar.css
```

## Security Model

| Layer | Protection |
|-------|------------|
| **Origin isolation** | Each plugin at `bifrostfw-webview://<name>/`, preventing cross-plugin DOM/storage access |
| **Iframe sandbox** | `allow-scripts allow-same-origin` only; top navigation, popups, modals, forms blocked |
| **CSP headers** | Per-response Content-Security-Policy; `connect-src` scoped to plugin's own origin (no external network) |
| **Path traversal** | `path.relative()` + boundary check rejects `../` escape sequences |
| **Plugin name validation** | Regex rejects `.`, `..`, path separators, and other escape characters |
| **No Node.js in iframes** | No `nodeIntegration`, no `contextIsolation` bypass |
| **Message origin validation** | `PluginIframe` checks `event.origin === expectedOrigin` on every message |
| **No X-Frame-Options** | Correctly omitted — parent and child are cross-origin by design in Electron |
