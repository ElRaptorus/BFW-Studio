# BPMN Modeler Module Discovery

---

## Overview

The BPMN modeler module discovery mechanism allows modules to inject diagram-js modules into every `BpmnModeler` instance. This enables modules to add custom behaviors, overlays, context pads, or any other diagram-js service to the BPMN editor without modifying `BpmnDocumentModel` or `BpmnModelerComponentAdapter` directly.

The mechanism consists of three parts:

1. **BpmnModelerModuleRegistry** — a singleton that collects diagram-js modules
2. **`bpmn.modeler.registerModule` command** — the command-based API for registering modules
3. **`BpmnDocumentModel.modelerAdapter`** — a readonly accessor for modules to reach their injected modules at runtime

## Architecture

```
Module onLoad()
    │
    ▼
bifrost.commands.executeCommand('bpmn.modeler.registerModule', MyModule)
    │
    ▼
BpmnModelerModuleRegistry (singleton, collects modules)
    │
    ▼ (user opens a BPMN file)
BpmnDocumentModel constructor
    │  reads bpmnModelerModuleRegistry.getAll()
    ▼
BpmnModelerComponentAdapter constructor
    │  spreads modules into BpmnModeler's additionalModules
    ▼
diagram-js DI instantiates all registered modules
    │
    ▼
Module retrieves its service via:
  model.modelerAdapter.getModelerComponentByName('myModuleName')
```

## BpmnModelerModuleRegistry

**File:** `studio/src/modules/bpmn-core/BpmnModelerModuleRegistry.ts`

A simple singleton that collects diagram-js modules. Modules register modules during their `onLoad` phase; the registry is read when a BPMN document is instantiated.

```typescript
class BpmnModelerModuleRegistry {
  private modules: any[] = [];
  register(module: any): void;
  getAll(): any[];
}

export const bpmnModelerModuleRegistry: BpmnModelerModuleRegistry;
```

## Registration Command

**Registered in:** `studio/src/modules/bpmn-core/index.tsx`
**Command:** `bpmn.modeler.registerModule`
**Parameter:** A diagram-js module object (follows the `didi` convention)

Modules call this command during `onLoad` to register their modules without importing bpmn-core internals directly:

```typescript
bifrost.commands.executeCommand('bpmn.modeler.registerModule', {
  __init__: ['myService'],
  myService: ['type', MyServiceConstructor],
});
```

## Modeler Adapter Access

**Host type:** `studio/src/modules/bpmn-core/BpmnModelerComponentAdapter.ts`
**Getter on:** `BpmnDocumentModel.modelerAdapter` (readonly)

Internal modules retrieve their injected services by name from the currently focused editor:

```typescript
import type { Bifrost } from '#bifrost/Bifrost';
import type BpmnDocumentModel from '#modules/bpmn-editor/BpmnDocumentModel';

const editorDocument = bifrost.editors.getFocusedEditorDocument();
const model = bifrost.editors.getEditorDocumentModelIfPresent<BpmnDocumentModel>(editorDocument);
const myService = model?.modelerAdapter.getModelerComponentByName<MyService>('myService');
```

The adapter exposes:

- `getModelerComponentByName<T>(name: string): T` — retrieves a named diagram-js service
- `isReadyForInteraction(): boolean` — whether the modeler has finished initializing
- `onceInteractive(callbackFn: Function): void` — callback for post-initialization

Plugin authors do **not** import the host adapter. They use `api.bpmn` (`studio-sdk/src/plugin-api/BpmnApi.ts`).

## Diagram-js Module Format

Modules follow the `didi` dependency injection convention used by bpmn-js:

```typescript
function MyService(eventBus, canvas, elementRegistry) {
  // 'this' is the service instance, accessible via getModelerComponentByName
  this.eventBus = eventBus;
}
MyService.$inject = ['eventBus', 'canvas', 'elementRegistry'];

export const MyDiagramModule = {
  __init__: ['myService'],           // services to instantiate on modeler creation
  myService: ['type', MyService],    // DI registration: name -> constructor
};
```

Available injectable services include any standard diagram-js / bpmn-js service: `eventBus`, `canvas`, `elementRegistry`, `overlays`, `modeling`, `commandStack`, `selection`, etc.

## Timing and Loading Order

Modules are collected at module init time (during `onLoad`), but `BpmnModelerComponentAdapter` is only instantiated when a user opens a BPMN document. By the time a user can open any document, all modules have finished their `onLoad`. Therefore, the order in which modules register diagram-js modules is irrelevant — the only constraint is that `bpmn-core` loads before any module that calls `bpmn.modeler.registerModule`.

## Plugin Module Support (Phase 8)

The registry was extended to support per-plugin module tracking. Plugins with the `bpmn.renderer` permission can declare `bpmnModules` in their manifest, which are loaded by `PluginModuleLoader` and registered separately from internal modules.

```typescript
class BpmnModelerModuleRegistry {
  private modules: any[] = [];
  private pluginModules = new Map<string, any[]>();

  register(module: any): void;                               // internal modules
  registerPluginModule(pluginName: string, module: any): void;  // plugin modules
  unregisterPluginModules(pluginName: string): void;            // cleanup on disable
  hasPluginModules(pluginName: string): boolean;
  getAll(): any[];  // returns [...this.modules, ...all plugin modules]
}
```

Key differences from internal modules:

- Plugin modules are **removable** (via `unregisterPluginModules`) — internal modules are append-only
- Plugin modules receive a `pluginChannel` DI value for bidirectional communication with the plugin host
- When a plugin is disabled, its modules are unregistered and open BPMN editors are force-reopened

### PluginModuleLoader

**File:** `studio/src/modules/bpmn-core/plugin-modules/PluginModuleLoader.ts`

Responsible for loading plugin-provided JS bundles via `__non_webpack_require__()` (bypasses bundler static analysis), creating `PluginChannel` instances, and managing the lifecycle.

### PluginChannel

**File:** `studio/src/modules/bpmn-core/plugin-modules/PluginChannel.ts`

Per-plugin bidirectional message channel injected as a DI value (`pluginChannel`). The renderer module calls `pluginChannel.postMessage(data)` to send to the host; the host calls `api.bpmn.postToRendererModule(data)` to send to the renderer.

See [plugin-bpmn-enrichment.md](plugin-bpmn-enrichment.md) for the full renderer module architecture.

### PluginPaletteProvider & PluginContextPadProvider

**Files:**
- `studio/src/modules/bpmn-core/plugin-contributions/PluginPaletteProvider.ts`
- `studio/src/modules/bpmn-core/plugin-contributions/PluginContextPadProvider.ts`

These are diagram-js modules registered internally (not by plugins) that act as multiplexers for all plugin-contributed palette and context pad entries. They read from `PluginBpmnContributionStore` and present aggregated entries to the bpmn-js palette/context pad system.

`PluginContextPadProvider` implements a two-level filter: `elementTypes` (static, from manifest) + `elementIds` (dynamic Set, updated at runtime via `updateContextPadEntry`). Both must match for an entry to appear on a given element.

## Internal Replace-Menu Provider (CustomPopupProvider)

**File:** `studio/src/modules/bpmn-core/bpmn-js/Provider/CustomPopupProvider.ts`

`CustomPopupProvider` registers with the `bpmn-replace` popup menu and post-processes the replace/morph entries that stock bpmn-js offers for a selected element. It runs a pipeline in `getPopupMenuEntries`:

1. `injectEventSubProcessEntry` — adds a direct "Event Sub-Process" morph entry for activity source types.
2. `filterEntriesBySupportedBpmnElements` — drops entries whose target type/event-definition is not in the `SupportedBpmnElements` whitelist (`studio/src/modules/bpmn-core/bpmn-js/SupportedBpmnElements.ts`).
3. `filterEventSubProcessDowngrades` — enforces the one-way trip: an Event Sub-Process cannot be morphed back down to a task / plain subprocess.
4. `filterBoundaryEventHostRestrictions` — drops the escalation-boundary morph entries (`replace-with-escalation-boundary`, `replace-with-non-interrupting-escalation-boundary`) when the boundary event's host is not a Call Activity or Sub-Process. The host type is resolved via `element.host?.type ?? element.businessObject?.get('attachedToRef')?.$type`. Escalations bubble up from an inner scope, so an escalation boundary is only meaningful on those hosts.

Each filter honours the `showUnsupportedElements` escape hatch: when the toggle is on, entries are returned unchanged.

**Whitelist note:** `bpmn:Transaction` is intentionally **absent** from `SupportedBpmnElements`, because the engine does not support transaction sub-processes. As a consequence the Transaction morph entry is dropped, and — since stock bpmn-js only offers Cancel End / Cancel Boundary entries inside/on a Transaction scope — cancel events are unreachable in the menu today. If transaction support is added later, re-add `bpmn:Transaction` to the whitelist and to `ESCALATION_BOUNDARY_ALLOWED_HOST_TYPES` in `CustomPopupProvider.ts`.

These menu restrictions are backstopped by the `bpmn-linter` rules `escalation-boundary-host`, `cancel-event-transaction-scope`, and `top-level-start-event-type` for BPMN files that never pass through the menu (imports, hand-edits, merges). See [bpmn-linter.md](bpmn-linter.md) §Event-type placement rules.

## Design Constraints

- Internal modules are **static**: once registered, a module is included in every `BpmnModeler` instance. There is no per-document opt-in/opt-out.
- Internal modules are **append-only**: there is no API to unregister an internal module.
- Plugin modules are **removable**: they can be unregistered when the plugin is disabled. Open editors must be reopened for changes to take effect.
- The `modelerAdapter` getter on `BpmnDocumentModel` is **generic**: it does not know about any specific module. Modules reach their own injected services by name.

## File Path Reference

| Component | Path |
|-----------|------|
| BpmnModelerModuleRegistry | `studio/src/modules/bpmn-core/BpmnModelerModuleRegistry.ts` |
| Registration command | `studio/src/modules/bpmn-core/index.tsx` |
| Registry consumer | `studio/src/modules/bpmn-editor/BpmnDocumentModel.ts` (constructor) |
| Adapter (spreads modules) | `studio/src/modules/bpmn-core/BpmnModelerComponentAdapter.ts` (constructor) |
| Document model | `studio/src/modules/bpmn-editor/BpmnDocumentModel.ts` (default export class) |
| Plugin BPMN API | `studio-sdk/src/plugin-api/BpmnApi.ts` |
| PluginModuleLoader | `studio/src/modules/bpmn-core/plugin-modules/PluginModuleLoader.ts` |
| PluginChannel | `studio/src/modules/bpmn-core/plugin-modules/PluginChannel.ts` |
| PluginPaletteProvider | `studio/src/modules/bpmn-core/plugin-contributions/PluginPaletteProvider.ts` |
| PluginContextPadProvider | `studio/src/modules/bpmn-core/plugin-contributions/PluginContextPadProvider.ts` |
| PluginBpmnContributionStore | `studio/src/modules/bpmn-core/plugin-contributions/PluginBpmnContributionStore.ts` |
| CustomPopupProvider (replace menu) | `studio/src/modules/bpmn-core/bpmn-js/Provider/CustomPopupProvider.ts` |
| SupportedBpmnElements (morph whitelist) | `studio/src/modules/bpmn-core/bpmn-js/SupportedBpmnElements.ts` |
