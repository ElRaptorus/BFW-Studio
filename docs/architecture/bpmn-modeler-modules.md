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

**SDK type:** `studio-sdk/types/bpmn/BpmnModelerComponentAdapter.ts`
**Getter on:** `BpmnDocumentModel.modelerAdapter` (readonly)

Modules retrieve their injected modules by name from the currently focused editor:

```typescript
import type { BpmnDocumentModel } from '@evil/bifrost_fw_sdk';

const editorDocument = studio.editors.getFocusedEditorDocument();
const model = studio.editors.getEditorDocumentModelIfPresent<BpmnDocumentModel>(editorDocument);
const myService = model?.modelerAdapter.getModelerComponentByName<MyService>('myService');
```

The SDK type exposes:

- `getModelerComponentByName<T>(name: string): T` — retrieves a named diagram-js service
- `isReadyForInteraction(): boolean` — whether the modeler has finished initializing
- `onceInteractive(callbackFn: Function): void` — callback for post-initialization

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

## Design Constraints

- Modules are **static**: once registered, a module is included in every `BpmnModeler` instance. There is no per-document opt-in/opt-out.
- Modules are **append-only**: there is no API to unregister a module.
- The `modelerAdapter` getter on `BpmnDocumentModel` is **generic**: it does not know about any specific module. Modules reach their own injected services by name.

## File Path Reference

| Component | Path |
|-----------|------|
| BpmnModelerModuleRegistry | `studio/src/modules/bpmn-core/BpmnModelerModuleRegistry.ts` |
| Registration command | `studio/src/modules/bpmn-core/index.tsx` |
| Registry consumer | `studio/src/modules/bpmn-editor/BpmnDocumentModel.ts` (constructor) |
| Adapter (spreads modules) | `studio/src/modules/bpmn-core/BpmnModelerComponentAdapter.ts` (constructor) |
| SDK adapter type | `studio-sdk/types/bpmn/BpmnModelerComponentAdapter.ts` |
| SDK model type | `studio-sdk/types/BpmnDocumentModel.ts` |
