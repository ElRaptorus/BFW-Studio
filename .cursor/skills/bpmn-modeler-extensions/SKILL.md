---
name: bpmn-modeler-extensions
description: >-
  Extend the BPMN modeler with custom diagram-js modules via the module discovery
  mechanism. Use when adding custom behaviors, overlays, context pads, or any
  diagram-js service to the BPMN editor, or when building extensions that interact
  with the bpmn-js modeler instance.
---

# Extending the BPMN Modeler

Extensions can inject diagram-js modules into every `BpmnModeler` instance using the module discovery mechanism provided by `bpmn-core`. This allows adding custom behaviors, overlays, context pads, or any diagram-js service without modifying `BpmnDocumentModel` or `BpmnModelerComponentAdapter`.

For detailed architecture, see `docs/architecture/bpmn-modeler-modules.md`.

## Step 1: Create a diagram-js Module

Follow the `didi` dependency injection convention:

```typescript
function MyService(eventBus, canvas, elementRegistry) {
  this.eventBus = eventBus;
  this.canvas = canvas;
  // Use any diagram-js services here
}
MyService.$inject = ['eventBus', 'canvas', 'elementRegistry'];

export const MyDiagramModule = {
  __init__: ['myService'],
  myService: ['type', MyService],
};
```

Injectable services include: `eventBus`, `canvas`, `elementRegistry`, `overlays`, `modeling`, `commandStack`, `selection`, and any other diagram-js/bpmn-js service.

## Step 2: Register the Module

In your extension's `onLoad`:

```typescript
export function onLoad(bifrost: Bifrost): void {
  bifrost.commands.executeCommand('bpmn.modeler.registerModule', [MyDiagramModule]);
}
```

Modules are static — once registered, they are included in every `BpmnModeler` instance. Registration must happen during `onLoad`, before any BPMN document is opened.

## Step 3: Access Your Module at Runtime

Use the host-typed `BpmnDocumentModel.modelerAdapter` to reach your module:

```typescript
import type { Bifrost } from '#bifrost/Bifrost';
import type BpmnDocumentModel from '#modules/bpmn-editor/BpmnDocumentModel';

const editorDocument = bifrost.editors.getFocusedEditorDocument();
const model = bifrost.editors.getEditorDocumentModelIfPresent<BpmnDocumentModel>(editorDocument);
const myService = model?.modelerAdapter.getModelerComponentByName<MyService>('myService');
```

Always check that `model` and `modelerAdapter` are non-null before accessing.

## Coupling Rules

- **Internal Studio modules** import `BpmnDocumentModel` from `#modules/bpmn-editor/BpmnDocumentModel` and `Bifrost` from `#bifrost/Bifrost`. They register diagram-js modules via `bpmn.modeler.registerModule`. Existing examples: `bpmn-linter`, `bpmn-token-simulator`.
- **Never modify** `BpmnDocumentModel` for extension-specific logic. The model only exposes a generic `modelerAdapter` getter.
- **Third-party plugins** do **not** get the host modeler adapter. They use `api.bpmn` (`studio-sdk/src/plugin-api/BpmnApi.ts`) and manifest `contributes.bpmnModules`.
- **Communication** between an internal extension and the modeler goes through: (1) diagram-js DI services inside your module, (2) Studio commands for user-facing actions, (3) the host-typed adapter for runtime access.

## Theme Integration

If your module adds visual elements, define CSS variables in your extension's own stylesheet under `.bifrost.bifrost-theme--light` and `.bifrost.bifrost-theme--dark` selectors. Add variables to both theme blocks. Do NOT place extension-specific variables in `bpmn-editor`'s `bpmn.scss`.

Variable naming convention: `--your-feature-purpose` (e.g. `--token-sim-toolbar-bg`).

## Reference Implementation

The `bpmn-token-simulator` extension is the canonical example:

- Entry: `studio/src/modules/bpmn-token-simulator/index.ts`
- Bridge module: `studio/src/modules/bpmn-token-simulator/TokenSimulationBridge.ts`
- Architecture doc: `docs/architecture/bpmn-token-simulator.md`

## Extension Registration

Register your extension in `studio/src/createAndInitializeBifrost.ts` after `bpmn-core` (loading order is otherwise irrelevant — modules are only consumed when a BPMN document opens, by which point all extensions have loaded).
