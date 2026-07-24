# Plugin DMN Editor Enrichment

Plugins can extend the DMN editor's DRD (Decision Requirements Diagram) view through the same tiered permission model used for BPMN. This document mirrors `plugin-bpmn-enrichment.md`; only the DMN-specific differences (DRD-only scope, multi-view awareness, absolute element creation) are called out explicitly.

## Scope: DRD only

The DMN editor has multiple views: the DRD (the spatial decision requirements graph) and, per decision, a decision table / literal expression / boxed expression editor reached by drilling down (`DmnModelerComponentAdapter` view switching, `EVENT_DMN_ADAPTER_VIEW_CHANGED`). The `api.dmn` plugin surface targets **only the DRD view** — expression editors have no spatial element model and therefore no overlays, palette, context pad, or modeling operations.

All `api.dmn` operations first check whether the DRD view is currently active:

- **Modeling operations** (`updateProperties`, `removeElement`, `createElement`, `appendElement`, `createConnection`, `moveElement`) **throw** a descriptive error when the DRD is not active.
- **Query operations** (`getElement`, `getElements`) return `null` / an empty array when the DRD is not active, rather than throwing — a plugin polling element state should not need to wrap every call in a try/catch just because the user drilled into a decision table.
- **Overlays** are cleared when the view switches away from the DRD, and re-resolved when it switches back (see "View awareness" below).

## Permission Model

```
dmn (low risk)
 └── dmn.modelling (medium risk)
      └── dmn.renderer (high risk)
```

| Permission | Risk | Capabilities |
|------------|------|-------------|
| `dmn` | Low | Read elements, subscribe to events, place overlays, register overlay factories |
| `dmn.modelling` | Medium | All of `dmn` + modify the model (updateProperties, removeElement, createElement, appendElement, createConnection, moveElement) + contribute palette/context pad entries |
| `dmn.renderer` | High | All of `dmn.modelling` + inject diagram-js modules directly into the DRD renderer process |

Higher tiers implicitly grant all lower-tier capabilities. A plugin declaring `dmn.renderer` does not need to also declare `dmn` or `dmn.modelling`.

### Hierarchy enforcement

`PermissionGate.ts` expands declared permissions via `PERMISSION_HIERARCHY`:

```typescript
'dmn.renderer': ['dmn.modelling', 'dmn'],
'dmn.modelling': ['dmn'],
```

At runtime, `permissionGate.assert(pluginName, requiredPermission, context)` throws a structured error if the plugin lacks the required tier. The same `PluginHostBridge` namespace-dispatch mechanism used for `bpmn.*` requests routes `dmn.*` requests, gated identically.

## Overlay API

DMN has no internal overlay factory pipeline of its own (unlike BPMN, which already had one before plugins existed). `DmnPluginOverlayManager` was built specifically for Phase 9: it combines factory-chain resolution with direct rendering of raw DOM overlays onto the DRD's `overlays` diagram-js service, obtained via `DmnModelerComponentAdapter.getDrdOverlays()` / `getDrdElementRegistry()`.

### Overlay types

DMN overlays support the same two mechanisms as BPMN: direct, imperative overlays via `api.dmn.setOverlays(uri, overlays)` / `clearOverlays(uri, filter?)` (rendered immediately, tracked per plugin+uri, and re-applied automatically once the DRD view reactivates if it was inactive when set), and factory-based overlays via `api.dmn.registerOverlayFactory(factory, options?)` (auto-resolved and re-rendered whenever the element set, selection, or active view changes). Both are rendered by `DmnPluginOverlayManager` / `DmnApiBridge` onto the same DRD `overlays` diagram-js service.

| Type | Rendering | Interactivity | Use case |
|------|-----------|---------------|----------|
| `badge` | Text label in rounded rect | Optional (via `onClickCommand`) | Counters, status indicators |
| `icon` | Phosphor icon | Optional (via `onClickCommand`) | Warnings, markers |
| `action` | Pill with icon + hover state | Always interactive | Trigger actions |
| `status` | Pill with icon, informational | Never interactive | Display state |

### Overlay factories

```javascript
api.dmn.registerOverlayFactory(
  (context) => {
    // context: { uri, elements, currentOverlays }
    return [...context.currentOverlays, /* new overlay descriptors */];
  },
  { priority: 1 },
);
```

Factories are invoked in priority order, each receiving the accumulated overlay list from lower-priority factories via `context.currentOverlays`.

### Overlay refresh

Call `api.dmn.requestOverlayRefresh()` when a plugin's internal state changes in a way that affects overlay factories. `DmnDocumentModel` also triggers a refresh automatically on:

- `EVENT_DMN_ADAPTER_XML_CHANGED` (model edits — the closest DMN equivalent to a generic "data updated" event)
- `EVENT_DMN_ADAPTER_SELECTION_CHANGED` (selection changes)
- `EVENT_DMN_ADAPTER_VIEW_CHANGED` (DRD ↔ decision table / expression editor switches)
- `pluginDmnOverlayFactoriesChanged` (a plugin registered/unregistered a factory)

### View awareness

Because DMN documents have multiple views, `DmnPluginOverlayManager.refresh()` must be view-aware: when `EVENT_DMN_ADAPTER_VIEW_CHANGED` fires and the new view is not the DRD, the manager clears every previously-rendered overlay from the DRD's overlay service without re-invoking factories (there is nothing to render on a decision table). When the view switches back to the DRD, the manager re-resolves and re-renders from scratch. This prevents the "view-switch overlay leak" — overlays that would otherwise linger, detached from their now-invisible canvas, if the manager only reacted to `EVENT_DMN_ADAPTER_XML_CHANGED`.

The direct `setOverlays`/`clearOverlays` mechanism follows the same deferral discipline: `DmnApiBridge.handleSetOverlays()` never drops a plugin's overlay request just because the DRD is inactive at call time — it stores the descriptors and, via a per-uri `EVENT_DMN_ADAPTER_VIEW_CHANGED` listener, re-applies them the moment the DRD reactivates.

`getActiveView(uri)` / `onViewChanged(uri, callback)` report a `DmnViewChangedEvent { uri, viewType, isDrd, decisionId }`. `viewType` is one of `'drd' | 'decisionTable' | 'literalExpression' | 'boxedExpression'` (matching `DmnModelerComponentAdapter.getActiveViewType()` verbatim). `decisionId` is `null` while `isDrd` is `true` (the DRD has no single "current decision"), and otherwise identifies the decision whose expression editor is active, letting plugins react to drill-down navigation.

## Palette & Context Pad Contributions

### Manifest-declared contributions

```json
{
  "contributes": {
    "dmnPalette": [
      { "id": "my-tool", "icon": "ph-light ph-wrench", "title": "My Tool", "command": "myCommand" }
    ],
    "dmnContextPad": [
      { "id": "my-action", "icon": "ph-light ph-info", "title": "Inspect", "command": "inspectCmd", "elementTypes": ["dmn:Decision"] }
    ]
  }
}
```

### Runtime-registered contributions

```javascript
await api.dmn.registerPaletteEntry({ id: 'dynamic-tool', icon: '...', title: '...', command: '...' });
await api.dmn.registerContextPadEntry({ id: 'dynamic-action', icon: '...', title: '...', command: '...', elementTypes: ['dmn:Decision'] });
```

### Context pad dynamic visibility

Identical rationale and mechanism to BPMN: the diagram-js `getContextPadEntries(element)` call is synchronous, but the plugin sandbox bridge is asynchronous, so `visibleWhen` callbacks are architecturally impossible. The solution is the same **pre-evaluated `elementIds` allowlist** pattern:

1. Plugin subscribes to element events (`onElementsChanged`, `onElementSelected`)
2. Plugin computes which elements qualify for the entry
3. Plugin calls `updateContextPadEntry(id, { elementIds: ['Decision_1', 'Decision_3'] })`
4. `PluginDmnContextPadProvider` performs an O(1) Set lookup in its synchronous `getContextPadEntries` call

The two-level filter model: `elementTypes` (static, declared in manifest or at registration) + `elementIds` (dynamic Set, updated at runtime). Both must match for an entry to appear.

### Command argument format

Identical to BPMN — a single argument object, not a bare string:

```javascript
{ elementId: string, elementType: string }
```

### Architecture

- `PluginDmnContributionStore` — Singleton registry for all plugin-contributed DMN palette and context pad entries (mirrors `PluginBpmnContributionStore`)
- `PluginDmnPaletteProvider` — diagram-js module (registered against the DRD's palette) that multiplexes entries from all plugins
- `PluginDmnContextPadProvider` — diagram-js module (registered against the DRD's context pad) with two-level filtering (elementTypes + elementIds)

Both providers are pre-registered into `DmnModelerModuleRegistry` at module-index time (`modules/dmn-core/index.ts`), so they participate in every DRD modeler instance regardless of whether any plugin is currently contributing entries.

## Modeling API

All modeling operations go through the DRD's diagram-js `commandStack` and are undoable (Ctrl+Z). Every operation requires `dmn.modelling` (or higher) and throws if the DRD view is not active.

| Method | Description | Validations |
|--------|-------------|-------------|
| `updateProperties(uri, elementId, properties)` | Update element properties | Element exists; no `$parent`/`$type`/`di` |
| `removeElement(uri, elementId)` | Remove element from canvas | Element exists; not root |
| `createElement(uri, descriptor)` | Create a new element at an **absolute** position | Valid DMN type; `descriptor.position` (`{x, y}`) required |
| `appendElement(uri, sourceId, descriptor)` | Create a new element connected to `sourceId` (source's position + a fixed offset) | Source exists; valid DMN type |
| `createConnection(uri, sourceId, targetId, type?)` | Create an information/knowledge/authority requirement connection | Source/target exist; no duplicates |
| `moveElement(uri, elementId, delta)` | Move element by delta | Element exists; finite numbers |

### `createElement` vs `appendElement`

DMN's DRD is a graph of loosely-coupled artifacts (decisions, inputs, knowledge sources, BKMs) rather than a strictly sequential flow like BPMN. Both an absolute-positioning primitive and a relative "append near an existing element" primitive are useful for DMN plugin authors, so both are exposed:

- `createElement(uri, { type, name?, position: { x, y } })` — places a new element at an exact canvas position. Useful when a plugin is laying out an entire generated DRD fragment (e.g. importing a decision table batch) and needs full control over positions.
- `appendElement(uri, sourceId, { type, name? })` — places a new element near `sourceId` and creates a connection to it, mirroring BPMN's `appendElement` ergonomics for the common "insert a related decision" case. See `docs/decisions.md` for the rationale.

Validation errors are returned as rejected promises with `{ message, code }` — the modeler never crashes.

## Renderer Module Injection

For advanced use cases (custom highlighting, requirement tracing, decision-service visualizations), plugins can inject diagram-js modules directly into the DRD renderer process.

### Manifest declaration

```json
{
  "permissions": ["dmn.renderer"],
  "contributes": {
    "dmnModules": [
      { "entry": "renderer/my-module.js", "description": "Custom requirement tracer" }
    ]
  }
}
```

### Loading flow

1. `ContributionRegistrar` detects `dmnModules` + `dmn.renderer` permission
2. `PluginDmnModuleLoader.loadPluginModules(name, path, modules)`:
   - Creates a `PluginChannel` for bidirectional communication
   - Registers the channel under a **unique DI name** `pluginChannel__<pluginName>` (prevents multi-plugin collisions in the flat DI container)
   - Evicts the Node.js `require` cache for each module path (ensures the latest code is loaded from disk)
   - Loads each bundle via `__non_webpack_require__()` (runtime Node.js require)
   - Rewrites `$inject` arrays in the loaded module: replaces `'pluginChannel'` with the plugin-specific DI name (`rewriteChannelInjections`)
   - Registers all modules in `DmnModelerModuleRegistry`
3. On success, `ContributionRegistrar.forceReopenDmnEditors()` closes and reopens all open DMN editors so the new DRD modeler instances include the freshly registered modules
4. `DmnModelerModuleRegistry.getAll()` returns both internal (core) and plugin modules

### PluginChannel message pipe

```
┌─────────────────────────┐         ┌─────────────────────────────┐
│   Plugin Host (sandbox)  │         │   Renderer (diagram-js DI)   │
│                         │         │                             │
│ api.dmn.postToRenderer  │ ──IPC── │ pluginChannel.onMessage(cb) │
│ Module(data)            │         │                             │
│                         │         │                             │
│ api.dmn.onRenderer      │ ──IPC── │ pluginChannel.postMessage   │
│ ModuleMessage(cb)       │         │ (data)                      │
└─────────────────────────┘         └─────────────────────────────┘
```

Messages are routed through `PluginHostBridge` → `DmnApiBridge` → `PluginChannel` (and back). The channel is per-plugin — modules from different plugins cannot intercept each other's messages.

### DI scoping and multi-plugin isolation

Identical to BPMN: the renderer module receives diagram-js services + `pluginChannel` via standard `$inject` dependency injection. Plugin authors declare `'pluginChannel'` in their `$inject` array — `PluginDmnModuleLoader` transparently rewrites this to a per-plugin unique name (`pluginChannel__<pluginName>`) at registration time.

No `bifrost` or `window.bifrost` reference is injected. Accessing `window.bifrost` is unsupported and may break in future versions.

**Important for plugin authors**: Always use `'pluginChannel'` in `$inject`. Never hardcode `pluginChannel__*` names — they are internal and subject to change.

### Force-reopen on unload

When a plugin with renderer modules is disabled:

1. `PluginDmnModuleLoader.unloadPluginModules(pluginName)` removes from registry + disposes channel
2. All open DMN editors are closed and reopened (new DRD modeler instances pick up the reduced module set)
3. A notification informs the user

### Security model

- Renderer modules run in the same V8 isolate as the Studio (no additional sandboxing)
- The `dmn.renderer` permission is flagged with a high-risk badge in the UI
- Module load failures (bad JS, missing file) deactivate the plugin with a clear error
- The `PluginChannel` is the only sanctioned communication path between host and renderer

## File Map

| File | Purpose |
|------|---------|
| `bifrost/common/plugin-host/sandbox/sandbox-worker.ts` | `createPluginApi()` — the runtime `api.dmn` object exposed inside the plugin sandbox (mirrors `api.bpmn` in the same file) |
| `bifrost/electron-renderer/plugin-host/DmnApiBridge.ts` | Renderer-side DMN API executor |
| `bifrost/electron-renderer/plugin-host/PluginHostBridge.ts` | Namespace dispatch + permission gating (shared with BPMN) |
| `bifrost/common/plugin-host/permissions/PermissionTypes.ts` | Permission types + hierarchy (shared with BPMN) |
| `bifrost/common/plugin-host/permissions/PermissionGate.ts` | Runtime permission enforcement (shared with BPMN) |
| `modules/dmn-editor/DmnPluginOverlayManager.ts` | Overlay factory-chain resolution + direct DRD overlay rendering |
| `modules/dmn-core/plugin-modules/PluginDmnModuleLoader.ts` | Loads plugin renderer modules for the DRD |
| `modules/dmn-core/DmnModelerModuleRegistry.ts` | Module registry (internal + plugin), keyed per DRD modeler |
| `modules/dmn-core/PluginDmnContributionStore.ts` | Palette/context pad contribution registry |
| `modules/dmn-core/dmn-js/Provider/PluginDmnPaletteProvider.ts` | diagram-js palette multiplexer for the DRD |
| `modules/dmn-core/dmn-js/Provider/PluginDmnContextPadProvider.ts` | diagram-js context pad multiplexer for the DRD |
| `modules/dmn-core/DmnModelerComponentAdapter.ts` | DRD service accessors (`getDrdModeling`, `getDrdOverlays`, `getDrdElementRegistry`, `getDrdEventBus`, `getDrdPalette`, `getDrdContextPad`) + view tracking |
| `studio-sdk/src/plugin-api/DmnApi.ts` | SDK type definitions for `api.dmn` |
| `studio-sdk/src/plugin-api/manifest/ManifestTypes.ts` | Manifest contribution types (`dmnPalette`, `dmnContextPad`, `dmnModules`) |

There is no internal `api/DmnApi.ts` typed-class hierarchy — the equivalent BPMN pattern (`common/plugin-host/api/BpmnApi.ts`) was removed from the codebase before Phase 9 began. The sandbox-worker `createPluginApi()` object and the SDK `DmnApi.ts` contract types are the only two surfaces plugin authors and Studio contributors need to keep in sync.
