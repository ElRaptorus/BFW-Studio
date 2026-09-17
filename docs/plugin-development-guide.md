# Bifrost Forge World — Plugin Development Guide

How to author, build, and load a plugin. Architecture (sandbox, IPC, quarantine) lives in [architecture/plugin-host.md](architecture/plugin-host.md). Manifest schema lives in [architecture/plugin-manifest.md](architecture/plugin-manifest.md). Method signatures live on `StudioPluginApi` in `@evil/bifrost_fw_sdk`.

## Getting Started

### Prerequisites

- Node.js >= 24.20.0
- npm >= 12.0.0
- A Working BFW Studio instance

### Create a new plugin

You can use the [Plugin generator](../tools/create-bfw-plugin/) to quickly create a scaffold for a new plugin.

```bash
# Interactive mode
node tools/create-bfw-plugin/src/cli.js my-plugin

# Non-interactive — minimal (no webview)
node tools/create-bfw-plugin/src/cli.js my-plugin --minimal

# Non-interactive — with webview support
node tools/create-bfw-plugin/src/cli.js my-plugin --webview
```

### Project structure (minimal)

```
my-plugin/
├── package.json       # Plugin metadata + bifrostStudio manifest
├── tsconfig.json
├── src/
│   └── index.ts       # activate / deactivate
└── dist/
    └── index.js       # CommonJS output
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
    ├── package.json
    ├── build.mjs
    ├── tsconfig.json
    ├── src/
    │   ├── index.html
    │   ├── main.tsx
    │   ├── App.tsx
    │   └── styles.css
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

# For webview plugins:
cd webview && npm install && cd ..
npm run build
```

Copy or symlink the plugin directory into the Studio plugins folder, or override it:

```bash
BFR_PLUGINS_DIR=/path/to/my-plugins-folder ./evil-studio
```

---

## Plugin Lifecycle

Every plugin must export two functions from its `main` entry:

```typescript
import type { StudioPluginApi } from '@evil/bifrost_fw_sdk';

export async function activate(api: StudioPluginApi): Promise<void> {
  // Register commands, panes, editors, settings, …
}

export async function deactivate(): Promise<void> {
  // Timers, event listeners, save delegates
}
```

**When activation happens:** `activate()` runs when an `activationEvents` entry fires. `onStartup` / `*` run after the window is ready. `onCommand:` / `onDocumentType:` / `onUri:` stay dormant until the trigger. Manifest `contributes.editorDocumentTypes` is itself a lazy trigger — a matching file open activates the plugin.

**The `api` object:** All methods return `Promise` because they cross IPC. Closures cannot be nested in option objects; register callbacks with `onMessage` / `onDidOpen` / `events.on`.

**`api.env`** (frozen):

| Property | Description |
|----------|-------------|
| `pluginPath` | Absolute path to the plugin root |
| `pluginName` | Identifier-safe name (scoped npm names are flattened at discovery) |
| `storagePath` | Persistent plugin-specific directory |
| `apiVersion` | Studio Plugin API version this load uses |

---

## What you will feel in the sandbox

Your code runs in a Worker Thread inside a SES Compartment. There is no DOM, no Electron, no `fetch` / `http` / `net`, and no `eval`. File I/O goes through `api.workspace` (or `fs` if you declared `filesystem`). Settings writes are only `plugin.<name>.*`. Crash 3 times in 60 seconds and the plugin is quarantined until **Trust & Re-enable**. Users see a permission dialog on every activation path unless they trust the current permission set.

Declare the minimum `permissions` in `bifrostStudio`. Vocabulary: `filesystem`, `commands.std` / `commands.bpmn` / `commands.dmn`, `bpmn` / `bpmn.modelling` / `bpmn.renderer` (same for `dmn`), `native`, `system-info`. `renderer-modules` is a legacy alias of `bpmn.renderer`. `network` is rejected.

Full tables, ModuleGate, and quarantine mechanics: [architecture/plugin-host.md](architecture/plugin-host.md) and [architecture/plugin-manifest.md](architecture/plugin-manifest.md).

Example:

```json
{
  "name": "my-plugin",
  "main": "dist/index.js",
  "bifrostStudio": {
    "apiVersion": "1.0.0",
    "displayName": "My Plugin",
    "activationEvents": ["onStartup"],
    "permissions": ["filesystem", "commands.std"],
    "contributes": { "commands": [] }
  }
}
```

CI can skip the dialog with `BFR_SKIP_PERMISSION_DIALOG=1`.

---

## Manifest (you declare; `activate()` still registers)

`package.json` → `bifrostStudio` lists contributions **before any plugin code runs**. That is how the Studio can show commands, panes, and file types for a dormant plugin.

Command IDs in the manifest are local (`hello`); the public ID is `plugin.<name>.hello`. The manifest registers a **stub** that only triggers activation. Your real handler exists only after `api.commands.register` in `activate()`.

`contributes.editorDocumentTypes` is a **placeholder**. You must call `api.editors.registerWebviewDocumentType({ id: <same id>, … })` in `activate()` or the tab stays on “Plugin activated but did not register an editor”.

Schema, contribution keys, and cleanup: [architecture/plugin-manifest.md](architecture/plugin-manifest.md).

---

## StudioPluginApi (index, not a reprint)

`activate(api)` gives you namespaces that **mirror** the corresponding Bifrost mediators, with serializable POJOs instead of closures. Import types from `@evil/bifrost_fw_sdk`.

| Namespace | Typical use |
|-----------|-------------|
| `commands` | `register` / `executeCommand` / `tryToExecuteCommand` |
| `notifications` | `open` / `close` / `onResponse` |
| `settings` | Read any key; write only `plugin.<name>.*` |
| `editors` | `registerWebviewDocumentType`, dirty/save delegates |
| `panes` | `registerWebviewPane` |
| `webviews` | `postMessage` / `onMessage` (register **before** the iframe loads) |
| `statusBar` / `menuBar` / `menus` | Chrome contributions |
| `events` | Studio events |
| `diagnostics` | Problems for a URI |
| `dialogs` | `open` / file pickers |
| `workspace` | Project folders, read/write, watch |
| `views` | Push-only tree views |
| `themes` | `--theme-*` token maps |
| `bpmn` / `dmn` | Editor enrichment (permissions required) |
| `env` | Frozen paths |

`enabledWhen` on plugin commands is not supported (sync predicate vs async IPC). `api.webviews.createPanel` is a stub — use an editor document or a pane.

Host-side wiring and denylist: [architecture/plugin-host.md](architecture/plugin-host.md).

---

## BPMN and DMN

You will subscribe to selection, place overlays, and (with modelling permission) mutate the diagram. Overlays are non-interactive unless they declare `onClickCommand`. Context-pad visibility is an `elementIds` allowlist you push, not a sync `visibleWhen`. Renderer modules must not touch `window.bifrost`; they talk through `postToRendererModule` / `onRendererModuleMessage`. Do not share the DI name `pluginChannel` across renderer-module plugins.

DMN APIs target the **DRD only**. Modeling throws when the user is in a decision table; queries return empty. Re-subscribe on `api.dmn.onViewChanged` after drill-down.

Permissions, overlay types, palette/context pad, modeling, renderer injection: [architecture/plugin-bpmn-enrichment.md](architecture/plugin-bpmn-enrichment.md) and [architecture/plugin-dmn-enrichment.md](architecture/plugin-dmn-enrichment.md).

---

## Webviews

UI runs in a sandboxed `<iframe>` at `evil-webview://<pluginName>/`. Inside the iframe, `acquireStudioApi()` gives `postMessage` / `onMessage` / theme helpers. Register `onMessage` in `activate()` **before** the iframe mounts. Collapsed panes unmount the iframe. Ctrl+S inside the iframe does not reach the Studio — use `onSaveRequest` / a plugin command. Cross-plugin `postMessage` is blocked.

Protocol, CSP, and surfaces: [architecture/webviews.md](architecture/webviews.md).

Theme tokens in CSS: `var(--theme-*)`. Feel editors and `PaneProperty` from the SDK are webview-safe; host `Icon` / `Table` / `Checkbox` are not.

---

## Development Workflow

### Plugin directory override

```bash
BFR_PLUGINS_DIR=/path/to/my-plugins ./evil-studio
```

### Per-plugin enable/disable

Plugins pane (left sidebar) → wrench → Enable / Disable / Uninstall. Disabled names live in `plugins.disabledPlugins`. Quarantine is **not** cleared by Disable — use Trust & Re-enable.

### Plugin Host console

`View > Console` or `plugins.showConsole`. Timestamped `stdout`/`stderr` from the host child. Filter by plugin name and free text.

### Manual reload

Refresh Plugin List restarts the host and re-discovers. Toggle a single plugin to reload only that one.

### Debugging

DevTools (`Ctrl+Shift+I`) inspects the renderer. Host output also appears under `[PluginHost:stdout]` / `[PluginHost:stderr]`.

---

## Build & Package

- Output: **CommonJS** (`format: 'cjs'`), **Node** (`platform: 'node'`)
- `main` must export `activate` and `deactivate`

esbuild for the host bundle:

```bash
esbuild src/index.ts --bundle --platform=node --format=cjs --outfile=dist/index.js --external:crypto
```

Webview bundle is IIFE for the browser:

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

TypeScript:

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

`@evil/bifrost_fw_sdk` is a `devDependency` for types (and optional webview-safe components). The `StudioPluginApi` instance is injected at runtime. Internal Studio modules type `Bifrost` from `#bifrost/Bifrost`, not `Studio` from the SDK.

## Examples

You can find a number of example plugins [in the Studio's Test Fixtures](../studio/test/fixtures/plugins/).
