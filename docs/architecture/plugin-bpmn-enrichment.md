# Plugin BPMN Editor Enrichment

Plugins can extend the BPMN editor through a tiered permission model. Each tier unlocks progressively more powerful capabilities while maintaining security boundaries.

## Permission Model

```
bpmn (low risk)
 └── bpmn.modelling (medium risk)
      └── bpmn.renderer (high risk)
```

| Permission | Risk | Capabilities |
|------------|------|-------------|
| `bpmn` | Low | Read elements, subscribe to events, place overlays, register overlay factories |
| `bpmn.modelling` | Medium | All of `bpmn` + modify the model (updateProperties, removeElement, appendElement, createConnection, moveElement) + contribute palette/context pad entries |
| `bpmn.renderer` | High | All of `bpmn.modelling` + inject diagram-js modules directly into the renderer process |

Higher tiers implicitly grant all lower-tier capabilities. A plugin declaring `bpmn.renderer` does not need to also declare `bpmn` or `bpmn.modelling`.

### Hierarchy enforcement

`PermissionGate.ts` expands declared permissions via `PERMISSION_HIERARCHY`:

```typescript
'bpmn.renderer': ['bpmn.modelling', 'bpmn'],
'bpmn.modelling': ['bpmn'],
```

At runtime, `permissionGate.assert(pluginName, requiredPermission, context)` throws a structured error if the plugin lacks the required tier.

## Overlay API

### Pre-defined overlay types

Plugins can place overlays on BPMN elements using two mechanisms:

1. **Direct overlays** (`api.bpmn.setOverlays`) — Immediate HTML-based overlays for `badge` and `icon` types
2. **Overlay factories** (`api.bpmn.registerOverlayFactory`) — React-rendered overlays for all types, re-evaluated on diagram changes

| Type | Rendering | Interactivity | Use case |
|------|-----------|---------------|----------|
| `badge` | Text label in rounded rect | Optional (via `onClickCommand`) | Counters, status indicators |
| `icon` | Phosphor icon | Optional (via `onClickCommand`) | Warnings, markers |
| `action` | Pill with icon + hover state | Always interactive | Trigger actions (continue, retry) |
| `status` | Pill with icon, informational | Never interactive | Display state (waiting, count) |

### Overlay refresh

When a plugin's internal state changes in a way that affects overlay factories, call `api.bpmn.requestOverlayRefresh()`. This invalidates the `PluginOverlayStore` fingerprint cache and schedules a full factory re-evaluation cycle.

## Palette & Context Pad Contributions

### Manifest-declared contributions

```json
{
  "contributes": {
    "bpmnPalette": [
      { "id": "my-tool", "icon": "ph-light ph-wrench", "title": "My Tool", "command": "myCommand" }
    ],
    "bpmnContextPad": [
      { "id": "my-action", "icon": "ph-light ph-info", "title": "Inspect", "command": "inspectCmd", "elementTypes": ["bpmn:Task"] }
    ]
  }
}
```

### Runtime-registered contributions

Plugins can also register entries dynamically at activation time:

```javascript
await api.bpmn.registerPaletteEntry({ id: 'dynamic-tool', icon: '...', title: '...', command: '...' });
await api.bpmn.registerContextPadEntry({ id: 'dynamic-action', icon: '...', title: '...', command: '...', elementTypes: ['bpmn:Task'] });
```

### Context pad dynamic visibility

The plugin sandbox runs in an isolated process with an asynchronous bridge. The diagram-js `getContextPadEntries(element)` call is synchronous. This makes `visibleWhen` callbacks architecturally impossible without blocking the renderer.

**Solution: Pre-evaluated `elementIds` allowlist**

1. Plugin subscribes to element events (`onElementsChanged`, `onElementSelected`)
2. Plugin computes which elements qualify for the entry
3. Plugin calls `updateContextPadEntry(id, { elementIds: ['Task_1', 'Task_3'] })`
4. The `PluginContextPadProvider` performs an O(1) Set lookup in its synchronous `getContextPadEntries` call

The two-level filter model: `elementTypes` (static, declared in manifest) + `elementIds` (dynamic Set, updated at runtime). Both must match for an entry to appear.

### Command argument format

When a context pad or palette entry triggers a command, the `PluginContextPadProvider` / `PluginPaletteProvider` pass a single argument object to the command handler:

```javascript
{ elementId: string, elementType: string }
```

Plugin command handlers must destructure this object — not treat it as a bare string:

```javascript
// Correct
api.commands.register('myCommand', async (info) => {
  const elementId = info?.elementId;
  // ...
});

// WRONG — info is an object, not a string
api.commands.register('myCommand', async (elementId) => { ... });
```

### Architecture

- `PluginBpmnContributionStore` — Singleton registry for all plugin-contributed palette and context pad entries
- `PluginPaletteProvider` — diagram-js module that multiplexes entries from all plugins into the palette
- `PluginContextPadProvider` — diagram-js module with two-level filtering (elementTypes + elementIds)

## Modeling API

All modeling operations go through the diagram-js `commandStack` and are undoable (Ctrl+Z).

| Method | Description | Validations |
|--------|-------------|-------------|
| `updateProperties(uri, elementId, properties)` | Update element properties | Element exists; no `$parent`/`$type`/`di` |
| `removeElement(uri, elementId)` | Remove element from canvas | Element exists; not root |
| `appendElement(uri, sourceId, descriptor)` | Append new element connected to source | Source exists; valid BPMN type |
| `createConnection(uri, sourceId, targetId, type?)` | Create sequence flow | Source/target exist; no duplicates |
| `moveElement(uri, elementId, delta)` | Move element by delta | Element exists; finite numbers |

Validation errors are returned as rejected promises with `{ message, code }` — the modeler never crashes.

## Renderer Module Injection

For advanced use cases (Token Simulator, custom renderers, path highlighting), plugins can inject diagram-js modules directly into the renderer process.

### Manifest declaration

```json
{
  "permissions": ["bpmn.renderer"],
  "contributes": {
    "bpmnModules": [
      { "entry": "renderer/my-module.js", "description": "Custom path tracer" }
    ]
  }
}
```

### Loading flow

1. `ContributionRegistrar` detects `bpmnModules` + `bpmn.renderer` permission
2. `PluginModuleLoader.loadPluginModules(name, path, modules)`:
   - Creates a `PluginChannel` for bidirectional communication
   - Registers the channel under a **unique DI name** `pluginChannel__<pluginName>` (prevents multi-plugin collisions in the flat DI container)
   - Evicts the Node.js `require` cache for each module path (ensures the latest code is loaded from disk)
   - Loads each bundle via `__non_webpack_require__()` (runtime Node.js require)
   - Rewrites `$inject` arrays in the loaded module: replaces `'pluginChannel'` with the plugin-specific DI name (`rewriteChannelInjections`)
   - Registers all modules in `BpmnModelerModuleRegistry`
3. On success, `forceReopenBpmnEditors()` closes and reopens all open BPMN editors so the new modeler instances include the freshly registered modules
4. The modeler's `getAll()` returns both internal and plugin modules

### PluginChannel message pipe

```
┌─────────────────────────┐         ┌─────────────────────────────┐
│   Plugin Host (sandbox)  │         │   Renderer (diagram-js DI)   │
│                         │         │                             │
│ api.bpmn.postToRenderer │ ──IPC── │ pluginChannel.onMessage(cb) │
│ Module(data)            │         │                             │
│                         │         │                             │
│ api.bpmn.onRenderer     │ ──IPC── │ pluginChannel.postMessage   │
│ ModuleMessage(cb)       │         │ (data)                      │
└─────────────────────────┘         └─────────────────────────────┘
```

Messages are routed through `PluginHostBridge` → `BpmnApiBridge` → `PluginChannel` (and back). The channel is per-plugin — modules from different plugins cannot intercept each other's messages.

### DI scoping and multi-plugin isolation

The renderer module receives diagram-js services + `pluginChannel` via standard `$inject` dependency injection. Plugin authors declare `'pluginChannel'` in their `$inject` array — the `PluginModuleLoader` transparently rewrites this to a per-plugin unique name (`pluginChannel__<pluginName>`) at registration time. This ensures multiple renderer-module plugins can coexist without their channels interfering with each other in the shared diagram-js DI container.

No `bifrost` or `window.bifrost` reference is injected. Accessing `window.bifrost` is unsupported and may break in future versions.

**Important for plugin authors**: Always use `'pluginChannel'` in `$inject`. Never hardcode `pluginChannel__*` names — they are internal and subject to change.

### Force-reopen on unload

When a plugin with renderer modules is disabled:
1. `PluginModuleLoader.unloadPluginModules(pluginName)` removes from registry + disposes channel
2. All open BPMN editors are closed and reopened (new modeler instances pick up the reduced module set)
3. A notification informs the user

### Security model

- Renderer modules run in the same V8 isolate as the Studio (no additional sandboxing)
- The `bpmn.renderer` permission is flagged with a high-risk badge in the UI
- Module load failures (bad JS, missing file) deactivate the plugin with a clear error
- The `PluginChannel` is the only sanctioned communication path between host and renderer

## File Map

| File | Purpose |
|------|---------|
| `bifrost/common/plugin-host/api/BpmnApi.ts` | Plugin-facing BPMN API (host side) |
| `bifrost/electron-renderer/plugin-host/BpmnApiBridge.ts` | Renderer-side BPMN API executor |
| `bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` | Namespace dispatch + permission gating |
| `bifrost/common/plugin-host/permissions/PermissionTypes.ts` | Permission types + hierarchy |
| `bifrost/common/plugin-host/permissions/PermissionGate.ts` | Runtime permission enforcement |
| `bifrost/common/plugin-host/permissions/PermissionDisplay.ts` | Human-readable permission display |
| `modules/bpmn-core/plugin-modules/PluginChannel.ts` | Per-plugin bidirectional message channel |
| `modules/bpmn-core/plugin-modules/PluginModuleLoader.ts` | Loads plugin renderer modules |
| `modules/bpmn-core/BpmnModelerModuleRegistry.ts` | Module registry (internal + plugin) |
| `modules/bpmn-core/plugin-contributions/PluginBpmnContributionStore.ts` | Palette/context pad contribution registry |
| `modules/bpmn-core/plugin-contributions/PluginPaletteProvider.ts` | diagram-js palette multiplexer |
| `modules/bpmn-core/plugin-contributions/PluginContextPadProvider.ts` | diagram-js context pad multiplexer |
| `studio-sdk/src/plugin-api/BpmnApi.ts` | SDK type definitions |
| `studio-sdk/src/plugin-api/manifest/ManifestTypes.ts` | Manifest contribution types |
