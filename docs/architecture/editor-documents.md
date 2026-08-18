# Editor Documents

---

## Overview

The Editor Document system is the mechanism by which modules provide editors for different types of content. A module registers a **document type** that binds a URI pattern to a **model** (business logic), a **renderer** (React component), and an optional **inspector** (side pane). When a URI is opened, the Studio matches it against registered types and instantiates the appropriate components.

Every opened tab in the editor area is an `EditorDocument`. Documents that need business logic (data manipulation, event subscriptions, undo/redo) also have an `EditorDocumentModel`. Documents without a model (e.g. fragment renderers, about pages) render directly from the URI and the renderer alone.

```
┌──────────────────────────────────────────────────────────────────┐
│  EditorMediator  (bifrost.editors / studio.editors)               │
│    ├─ EditorDocumentTypeManager   (type definitions, URI match)  │
│    ├─ EditorDocumentModelManager  (model instances, lazy create) │
│    ├─ EditorDocumentRendererManager (renderer components)        │
│    ├─ EditorDocumentInspectorManager (inspector components)      │
│    └─ EditorAreaManager           (layout, open documents)       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Document Type Registration

Modules register document types in their `onLoad` entry point via `bifrost.editors.registerDocumentType`:

```typescript
bifrost.editors.registerDocumentType('bpmn', {
  uriMatch: /\.bpmn$/,
  modelKey: 'BpmnDocumentModel',
  modelConstructor: BpmnDocumentModel,
  rendererKey: 'BpmnRenderer',
  rendererConstructor: BpmnDocumentRenderer,
  inspectorKey: 'BpmnEditorDocumentInspector',
  inspectorConstructor: BpmnEditorDocumentInspector,
  icon: 'bpmn/editor-tab/bpmn',
});
```

### Type Definition Shape

**Path:** `studio/src/bifrost/common/EditorDocumentTypeManager.ts`

```typescript
type EditorDocumentTypeDefinitionWithoutName = {
  uriMatch: RegExp;
  icon: string;
  rendererKey: string;
  rendererConstructor: any;
  modelKey: string | null;
  modelConstructor?: any;
  inspectorKey?: string;
  inspectorConstructor?: any;
  canOpen?: (uri: string) => CanOpenDocumentResult;
};

type CanOpenDocumentResult = {
  documentCanBeOpened: boolean;
  error?: string;
};
```

| Parameter | Required | Purpose |
|-----------|----------|---------|
| `uriMatch` | yes | Regex tested against URIs to determine which type handles a document |
| `icon` | yes | Icon alias for the editor tab |
| `rendererKey` | yes | Key under which the renderer is registered internally |
| `rendererConstructor` | yes | React component class/function that renders the document |
| `modelKey` | yes | Key for the model (pass `null` if no model is needed) |
| `modelConstructor` | no | Class with a static `create` method (only needed when `modelKey` is non-null) |
| `inspectorKey` | no | Key for the inspector pane |
| `inspectorConstructor` | no | React component for the inspector pane |
| `canOpen` | no | Preflight check before opening (e.g. verify engine connectivity) |

### Document Types with and without Models

Not every document type needs a model. Fragment renderers, about pages, and simple viewers typically set `modelKey: null` and omit `modelConstructor`. The renderer receives the URI and renders content directly.

Document types that manage state (undo/redo, event subscriptions, data manipulation) provide a model class. The model is created lazily — only when a renderer first requests it via `studio.editors.getEditorDocumentModel(editorDocument)`.

### Registered Document Types (by module)

| Module | Document Type | uriMatch | Has Model | Has Inspector |
|-----------|---------------|----------|-----------|---------------|
| **std** | `Default.Document.Inspector.Item` | `/^fragment\+default\.…/` | no | no |
| **std/aboutpage** | `aboutpage` | `/^about:about$/` | no | no |
| **std/startpage** | `startpage` | `/^about:start$/` | no | no |
| **std/help** | `help` | `/^help:\/\/(.+)$/` | yes | no |
| **std/settings** | `settings-gui`, `settings-json` | `/^about:settings$/`, `/^about:settings-json$/` | yes (JSON only) | no |
| **std/settings** | `default-settings`, `key-bindings` | `/^about:…$/` | no | no |
| **bpmn-editor** | `bpmn` | `/\.bpmn$/` | yes | yes |
| **bpmn-editor** | `bpmn.script`, `bpmn.text`, `bpmn.data-output-association.transformation`, ... | `/^fragment\+bpmn\.…/` | no | no |
| **bpmn-diff** | `bpmn.diff` | `/^fragment\+bpmn.diff\:/` | yes | no |
| **machine-sanctum** | `machine-sanctum` | `/^about:machine-sanctum/` | yes | no |
| **engine-workspace** | `engine-dashboard`, `engine-process-explorer`, etc. | `/^engine:\/\//`, `/^engine-task-inbox:\/\//` | yes | no |
| **engine-model-viewer** | `engine-model-viewer` | `/^engine-model:\/\//` | yes | yes |
| **engine-decision-viewer** | `engine-decision-viewer` | `/^engine-decision:\/\//` | yes | yes |
| **engine-debugger** | `engine-debugger` | `/^engine-debug:\/\//` | yes | yes |
| **engine-debugger** | fragment types | `/^fragment\+engine-debug\./` | varies | varies |

---

## URI Schemes

Documents are identified by URIs. The scheme determines which document type handles them.

| Scheme | Pattern | Used by |
|--------|---------|---------|
| file path | `/path/to/file.[ext]` | bpmn-editor (matched by file extension; `dmn-editor` also matches by extension) |
| `about:` | `about:settings`, `about:start` | std/settings, std/startpage, std/aboutpage, machine-sanctum |
| `help://` | `help://home` | std/help |
| `engine://` | `engine://dashboard/{engineId}` | engine-workspace |
| `engine-model://` | `engine-model://{engineId}/{processModelId}` | engine-model-viewer |
| `engine-decision://` | `engine-decision://{engineId}/{decisionModelId}` | engine-decision-viewer |
| `engine-debug://` | `engine-debug://{engineId}/{processInstanceId}` | engine-debugger |
| `engine-task-inbox://` | `engine-task-inbox://{engineId}` | engine-workspace |
| `fragment+` | `fragment+bpmn.script:…` | bpmn-editor, engine-debugger, std |
| `buffer:` | `buffer:Untitled-1` | internal (unsaved buffers created via `createNewEditorDocumentAsBuffer`) |

Fragment URIs (`fragment+…`) represent sub-views of a parent document, typically opened as additional tabs (e.g. a script editor for a BPMN service task).

### BPMN Fragment Renderer Pattern

The `bpmn-editor` module registers 16+ fragment document types (script, text, data-output-association-transformation, send-task-payload, etc.) that all share the same rendering pattern. Each fragment renderer is a thin component that delegates to a shared hook and a shared view component.

**Key files:**

| File | Role |
|------|------|
| `studio/src/modules/bpmn-editor/open-in-new-tab-renderer/useBpmnFragmentRenderer.ts` | Shared hook: resolves parent document, loads `BpmnDocumentModel`, subscribes to data updates, provides fragment state |
| `studio/src/modules/bpmn-editor/open-in-new-tab-renderer/BpmnFragmentRendererView.tsx` | Shared view component (`forwardRef`): renders the toolbar; for FEEL fragments renders `FeelSimulatorEditor` (from `studio/src/components/feel-simulator/`), for other languages renders `MultiLineCodeEditor` |
| `studio/src/modules/bpmn-editor/open-in-new-tab-renderer/Bpmn*FragmentRenderer.tsx` | Individual renderers: define config, `getFragmentValue`, `setFragmentValue`, and wire hook + view together |

**Hook signature:**

```typescript
function useBpmnFragmentRenderer(
  props: EditorDocumentRendererProps,
  config: BpmnFragmentRendererConfig,
  getFragmentValue: GetFragmentValueFn,
  setFragmentValue: SetFragmentValueFn,
  multiLineCodeEditorRef: React.RefObject<MultiLineCodeEditor | null>,
): BpmnFragmentRendererState & { bifrost: Studio; handleChange: (value: string) => void }
```

The `multiLineCodeEditorRef` is created by each caller (`useRef<MultiLineCodeEditor | null>(null)`) and passed into the hook, rather than being created and returned by the hook. This avoids ref-taint in the return object (the React Compiler's `react-hooks/refs` rule taints all properties of an object that contains a `RefObject`). The same ref is forwarded to `BpmnFragmentRendererView` via the standard `ref` prop.

**Typical caller pattern:**

```typescript
export default function BpmnScriptFragmentRenderer(props: EditorDocumentRendererProps) {
  const multiLineCodeEditorRef = useRef<MultiLineCodeEditor | null>(null);
  const state = useBpmnFragmentRenderer(props, CONFIG, getFragmentValue, setFragmentValue, multiLineCodeEditorRef);
  if (state.loading) return null;
  return <BpmnFragmentRendererView ref={multiLineCodeEditorRef} bifrost={state.bifrost} config={CONFIG} ... />;
}
```

---

## EditorDocument (Data Object)

**Path:** `studio-sdk/src/contracts/EditorTypes.ts`

Every opened tab is represented by an `EditorDocument` data object:

```typescript
type EditorDocument = {
  readonly label: string;
  readonly icon: string;
  readonly hasUnsavedChanges: boolean;
  readonly uri: string;
  readonly documentType: string;
  readonly rendererKey: string;
  readonly modelKey: string | null;
  readonly inspectorKey?: string;
  readonly inspectorConstructor?: any;
  isTemporary?: boolean;
  readonly data: {
    readonly original: any;
    readonly current: any;
  };
  readonly metadata: any;
};
```

| Field | Purpose |
|-------|---------|
| `label` | Text shown in the editor tab |
| `icon` | Icon alias for the tab |
| `hasUnsavedChanges` | Whether the dot indicator is shown |
| `uri` | Primary identifier for the document |
| `documentType` | Links to the registered type |
| `rendererKey` | Key to look up the renderer component |
| `modelKey` | Key to look up the model class (`null` if no model) |
| `data.original` / `data.current` | File content (original = on disk, current = in memory) |
| `metadata` | Persistent view-related state (zoom level, scroll position, active tab) — persisted to localStorage for session restoration |
| `isTemporary` | Preview mode (replaced when another document opens) |

---

## Data Placement Rules

Both `data.current` and `metadata` are persisted to the user's localStorage. This persistence serves two purposes: dirty-state tracking (`data.current` vs `data.original`) and session restoration (both `data.current` and `metadata` are passed back to the model's `create` factory on next startup).

Because of this persistence, models must be intentional about what goes into each channel:

| Channel | Purpose | Examples |
|---------|---------|---------|
| `data.original` / `data.current` | File content for dirty-state tracking and session restoration | BPMN XML, JSON settings content |
| `metadata` | View-related restoration state only | Scroll position, zoom level, active tab index, filter revision counter |
| Private model fields + public getters | All working/production data | Selections, parsed models, data lists, fetched records, computed state |

**Key principle:** If a piece of data is not needed for dirty-state tracking or session restoration, it does not belong in `currentData` or `metadata`. Placing large or frequently-changing objects (parsed BPMN/DMN models, process instance lists, full selection objects) into these channels wastes localStorage space and can degrade performance.

### Anti-pattern: `registerSharedRessource` for per-document state

`studio.registerSharedRessource(key, value)` is a global singleton store. Using it for data that is per-document (e.g., "the selected element in this viewer tab") means that two tabs of the same document type overwrite each other's state. This breaks multi-instance isolation — the last tab to update wins, and inspector panes show stale data from the wrong tab.

**Wrong:**

```typescript
selectElement(element: MySelection): void {
  this.selectedElement = element;
  this.studio.registerSharedRessource('myModule.selection', element, true);
}
```

**Correct — panes use model getters (Debugger pattern):**

```typescript
// Model
selectElement(element: MySelection): void {
  this.selectedElement = element;
  this.selectionRevision++;
  this.updateMetadata({ selectionRevision: this.selectionRevision });
}

getSelectedElement(): MySelection | null {
  return this.selectedElement;
}

// Pane
function MyPane(props: PaneProviderProps) {
  const model = props.editorDocumentModel as MyDocumentModel | null;
  const selection = model?.getSelectedElement() ?? null;
  // ...
}
```

The `selectionRevision` counter in metadata serves only as a re-render trigger — it causes the Workbench to fire `EVENT_EDITOR_DOCUMENT_METADATA_UPDATED`, which makes panes re-read their data from the model. The actual selection object is never persisted.

### Revision counter patterns

The workspace models use three metadata revision counters, each serving as a lightweight re-render trigger for a specific concern:

| Counter | Written by | Triggers re-render of |
|---------|------------|----------------------|
| `dataRevision` | `publishDataRevision()` after each fetch cycle or connection state change | Renderer (list data, loading, error, pagination) |
| `selectionRevision` | `selectX()` / `clearSelection()` | Panes that read single-row selection |
| `filterRevision` | `publishFilterState()` / `applyColumnFilter()` | Renderer (syncs column filter UI with model filter state) |

All three follow the same pattern: the model increments a private counter, writes it to metadata, and the consuming component re-reads from model getters when it detects the counter changed.

The `updateCurrentData` override (`super.updateOriginalAndCurrentData(data, data)`) remains in all workspace models as a safeguard to suppress the dirty-dot. Without it, the base class would compare `original` vs. `current` and incorrectly flag the document as dirty. The override is defensive — no code calls it.

**Legitimate uses of `registerSharedRessource`:**
- `EngineConnectionManager` — a true global singleton, not per-document
- `TASK_INBOX_PENDING_COUNTS_KEY` — an intentionally cross-engine aggregate for sidebar badges

---

## EditorDocumentModel (Base Class)

**Path:** `studio-sdk/src/common/EditorDocumentModel.ts`

Abstract base class that all document models extend. Provides data management, event emission, and lifecycle hooks.

Extends `AbstractEmitterWithInitialBuffer` — events emitted before listeners attach are buffered and replayed.

### Static Factory

Models use a static `create` method invoked by `EditorDocumentModelManager`:

```typescript
static async create(
  uri: string,
  restoredCurrentData: any,
  restoredMetadata: any,
  fileLoader: ILoadable,
  bifrost: Bifrost,
): Promise<MyDocumentModel> {
  const contentOnFile = await fileLoader.load(uri);
  return new MyDocumentModel(uri, contentOnFile, restoredCurrentData, restoredMetadata, bifrost);
}
```

The constructor is typically `private` — only `create` constructs instances.

### Core Methods

| Method | Signature | Purpose |
|--------|-----------|---------|
| `getUri` | `(): string` | Returns the document URI |
| `canUndo` | `(): boolean` | Whether undo is available (default `false`) |
| `canRedo` | `(): boolean` | Whether redo is available (default `false`) |
| `undo` | `(): void` | Undo (no-op by default) |
| `redo` | `(): void` | Redo (no-op by default) |
| `saveEditorDocument` | `(): Promise<boolean \| null>` | `null` = let Studio save to disk; `true`/`false` = custom save |
| `closeEditorDocument` | `(): Promise<boolean \| null>` | `null` = let Studio handle; `true`/`false` = custom close logic |
| `resetUriAndData` | `(uri, data, optionalCurrentData?): void` | Internal: called after save or file move |

### Protected Helpers

| Method | Purpose |
|--------|---------|
| `getCurrentData()` | Returns current data |
| `updateUri(uri)` | Updates URI, emits `EVENT_URI_CHANGED` |
| `updateLabel(label)` | Emits `EVENT_LABEL_CHANGED` |
| `updateCurrentData(currentData)` | Emits `EVENT_DATA_UPDATED` (only if data changed) |
| `updateOriginalAndCurrentData(original, current)` | Emits `EVENT_DATA_UPDATED` (resets dirty state) |
| `updateMetadata(partialMetadata)` | Emits `EVENT_METADATA_UPDATED` |

### Lifecycle Hooks

| Hook | When Called |
|------|------------|
| `onEditorDocumentModelDidRegister()` | After model is registered with `EditorDocumentModelManager`. Bootstrap here (emit first events, call `updateOriginalAndCurrentData`). |
| `onEditorDocumentWillSave(willCloseAfterSave?)` | Before save |
| `onEditorDocumentDidSave(willCloseAfterSave?)` | After save |
| `onEditorDocumentWillClose()` | Before close. **Cleanup here**: dispose subscriptions, cancel network requests, invalidate timers. |
| `onEditorDocumentDidClose()` | After close |
| `onEditorDocumentDidFocus()` | After document gains focus |
| `onEditorDocumentDidBlur()` | After document loses focus |
| `restoreMetadataAfterNavigation(partialMetadata)` | After navigation state is restored (e.g. forward/back) |

### Built-in Events

**Path:** `studio-sdk/src/contracts/internal/EditorEvents.ts`

Events emitted by the base class through the protected helpers:

| Event | Emitted by | Args |
|-------|------------|------|
| `EVENT_DATA_UPDATED` | `updateCurrentData`, `updateOriginalAndCurrentData` | `{ original?, current }` |
| `EVENT_METADATA_UPDATED` | `updateMetadata` | `partialMetadata` |
| `EVENT_URI_CHANGED` | `updateUri` | `[originalUri, newUri]` |
| `EVENT_LABEL_CHANGED` | `updateLabel` | `[label]` |
| `EVENT_FRAGMENT_ID_UPDATED` | (subclass-emitted) | `[fragmentId]` |

---

## Renderer Contract

**Path:** `studio-sdk/src/contracts/EditorTypes.ts`

Renderers are plain React components (class or function). There is no base class.

### Props

```typescript
type EditorDocumentRendererProps = {
  readonly studio: Studio;
  readonly editorDocument: EditorDocument;
  readonly uri: string;
};
```

### Obtaining the Model

The model is not passed via props. Renderers that need it call:

```typescript
async componentDidMount(): Promise<void> {
  this.model = await this.props.studio.editors.getEditorDocumentModel<MyDocumentModel>(
    this.props.editorDocument,
  );
  this.forceUpdate();
}
```

For documents without a model (`modelKey: null`), the renderer works with `props.editorDocument` and `props.uri` directly.

### Rendering

**Path:** `studio/src/components/editors/EditorWrapper.tsx`

The `RenderDocument` component resolves the renderer by key and passes `EditorDocumentRendererProps`:

```typescript
function RenderDocument({ editorDocument }: { editorDocument?: EditorDocument }) {
  const studio = useBifrost();
  const EditorDocumentRenderer = useMemo(
    () => getRenderer(studio, editorDocument ? editorDocument.rendererKey : null),
    [studio, editorDocument],
  );

  const editorDocumentRendererProps: EditorDocumentRendererProps = {
    uri: editorDocument.uri,
    editorDocument,
    studio,
  };

  return <EditorDocumentRenderer {...editorDocumentRendererProps} key={`text-${uri}`} />;
}
```

---

## Inspector Contract

**Path:** `studio-sdk/src/contracts/PaneTypes.ts`

Inspectors are React components shown in a side pane when a document is focused. There is no base class.

### Props

```typescript
type DocumentInspectorProps = {
  readonly studio: Studio;
  readonly editorDocument: EditorDocument;
  readonly editorDocumentModel?: any;
  readonly paneId?: string;
};
```

The `editorDocumentModel` is optional — it is `null` for document types without a model.

### Rendering

**Path:** `studio/src/components/panes/inspectors/EditorDocumentInspector.tsx`

When a document has a registered inspector, it is resolved and rendered:

```typescript
const CustomInspector = bifrost.editors.getEditorDocumentInspector(documentInspectorKey);
const editorDocumentModel = props.studio.editors.getEditorDocumentModelIfPresent(focussedEditorDocument);
return <CustomInspector {...props} editorDocument={focussedEditorDocument} editorDocumentModel={editorDocumentModel} />;
```

If no inspector is registered for a document type, `DefaultDocumentInspector` is shown.

---

## Model-to-Renderer Communication

Three patterns are used to communicate state changes from a model to its renderer:

### Pattern 1: Built-in events

The base class emits `EVENT_DATA_UPDATED`, `EVENT_METADATA_UPDATED`, etc. through the protected helpers. The `EditorDocumentModelManager` listens to these and updates the `EditorDocument` data object, which flows through to the renderer via React's rendering cycle.

This is the default mechanism for data/metadata changes and requires no extra wiring.

### Pattern 2: Custom events

Models can emit module-defined events using the inherited `emit` method. Renderers subscribe via `model.on(EVENT_NAME, handler)`.

Examples:
- `EVENT_SETTINGS_RECEIVED_UPDATE` — `UserSettingsDocumentModel` notifies its renderer of external settings changes
- `EVENT_DEBUGGER_SELECTED_FLOW_NODE_INSTANCE_CHANGED` — `EngineBpmnDebuggerEditorDocumentModel` notifies when the selected flow node changes
- `EVENT_FILTERS_UPDATED` — engine-workspace list models notify their renderers after filter changes

```typescript
// Model
this.emit(EVENT_SETTINGS_RECEIVED_UPDATE, []);

// Renderer
const subscription = documentModel.on(EVENT_SETTINGS_RECEIVED_UPDATE, () => {
  setSettingsAsString(documentModel.getSettingsAsString());
});
```

### Pattern 3: Callback registration

Models expose setter methods that accept a callback function. The renderer registers in `componentDidMount`. The model invokes the callback at the appropriate time.

```typescript
// Model
private onProcessModelUpdatedHandler: Function | null = null;

onProcessModelUpdated(callback: Function): void {
  this.onProcessModelUpdatedHandler = callback;
}

// Renderer (componentDidMount)
this.model.onProcessModelUpdated(() => {
  this.forceUpdate();
});
```

Known callback methods:
- `onEngineReconnect(callback)` — engine document models, called after reconnect and data refresh
- `onProcessModelUpdated(callback)` — debugger model, called after a process model update
- `onceInteractive(callback)` — BPMN-based models, called once when the diagram is ready for interaction

This pattern is useful when the model needs to perform async work (e.g. refresh data from a remote engine) before signalling the renderer.

### `onceInteractive` and deferred layouts

`BpmnModelerComponentAdapter.onceInteractive(callback)` fires via `setTimeout(0)` after the modeler reports it is attached to the DOM. **This does not guarantee that the container has received its final layout dimensions.** When the modeler is hosted inside a `SplitterLayout`, a collapsed tab, or any other container that defers layout, the callback may fire while `canvas.viewbox().outer` is still `0 × 0`.

Calling `zoomToViewport()` or `setZoom()` in this state produces `NaN`/`Infinity` scale values that crash with `TypeError: Failed to execute 'scale' on 'SVGMatrix': The provided float value is non-finite`.

**Correct pattern**: Defer canvas operations that depend on container dimensions to the next animation frame:

```typescript
adapter.onceInteractive(() => {
  // Safe — no layout dependency:
  applyOverlays();
  setInitialized(true);

  // Needs container dimensions — defer:
  requestAnimationFrame(() => {
    adapter.zoomToViewport();
    onReady();
  });
});
```

The adapter's `zoomToViewport()` and `setZoom()` also include a zero-dimension guard that returns early instead of crashing, but callers should still defer when they want the zoom to actually happen.

See also: [common-pitfalls.md → bpmn-js canvas operations on zero-dimension containers](common-pitfalls.md#bpmn-js-canvas-operations-on-zero-dimension-containers).

---

## Renderer → Command Communication

When a renderer triggers a command — via `EditorToolbarButton`, `getClickHandler()`, or `executeCommand` — it should pass the `EditorDocumentModel` directly as a `commandArg`. The renderer already holds the model; re-deriving it inside the command handler adds latency and prevents synchronous enablement predicates.

See [commands.md → Renderer → Command: Pass the Model](commands.md#renderer--command-pass-the-model) for the full pattern and examples.

---

## Event Subscription Best Practices

When a document model needs to react to external events (e.g. engine events, settings changes), subscribe within the model — not in the module's `onLoad` function. Each model instance knows its own identity and can self-select relevant events.

### Subscribe in the constructor, dispose on close

```typescript
class MyDocumentModel extends EditorDocumentModel {
  private subscriptions: AbstractSubscription[] = [];

  private constructor(uri: string, private bifrost: Bifrost) {
    super(uri);

    this.subscriptions.push(
      connectionManager.on('engine:reconnected', async (args) => {
        if (args.engineId === this.engineId) {
          await this.refresh();
        }
      }),
    );
  }

  onEditorDocumentWillClose(): void {
    this.subscriptions.forEach((sub) => sub.dispose());
  }
}
```

### When to subscribe in `onLoad` instead

Only subscribe in the module's `onLoad` for concerns that are not tied to a specific document instance — for example, updating a global status bar indicator or reacting to an event before any document is opened.

---

## EditorMediator (`bifrost.editors` / `studio.editors`)

**Path:** `studio/src/bifrost/browser/EditorMediator.ts`
**SDK type declaration:** `studio-sdk/types/browser/EditorMediator.ts`

The public API for managing editor documents.

### Key Methods

| Method | Signature | Purpose |
|--------|-----------|---------|
| `registerDocumentType` | `(id, typeDefinition) → void` | Register a document type |
| `unregisterDocumentType` | `(id) → Promise<void>` | Force-close all open tabs of that type, then remove type + renderer + model + inspector + merge resolver entries |
| `focusOrOpenEditorDocument` | `(editorDocOrUri, label?) → EditorDocument` | Focus or open a document |
| `createNewEditorDocument` | `(uri, initialData) → Promise<EditorDocument>` | Create and focus a new document |
| `createNewEditorDocumentAsBuffer` | `(documentType, initialData?) → EditorDocument` | Create an in-memory buffer document |
| `getEditorDocumentByUri` | `(uri) → EditorDocument \| null` | Look up a document by URI |
| `getEditorDocumentModel` | `<T>(editorDocument, verifyInstanceOf?) → Promise<T>` | Get/create model (async, lazy) |
| `getEditorDocumentModelIfPresent` | `<T>(editorDocument) → T \| null` | Get model from cache (sync, may be null) |
| `getFocusedEditorDocument` | `() → EditorDocument \| null` | Currently focused document |
| `getOpenEditorDocuments` | `() → EditorDocument[]` | All open documents |
| `saveEditorDocument` | `(editorDocument, willCloseAfterSave?) → Promise<boolean>` | Save a document |
| `saveEditorDocumentAs` | `(editorDocument) → Promise<boolean>` | Save As dialog |
| `closeEditorDocument` | `(editorDocument) → Promise<boolean>` | Close a document |
| `updateEditorDocumentLabel` | `(editorDocument, newLabel) → void` | Update tab label |
| `getDocumentTypeDefinitionByUri` | `(uri) → EditorDocumentTypeDefinition` | Type definition for a URI |
| `hasDocumentTypeDefinitionForUri` | `(uri) → boolean` | Whether a type exists for a URI |

---

## Internal Managers

| Manager | Path | Purpose |
|---------|------|---------|
| `EditorDocumentTypeManager` | `studio/src/bifrost/common/EditorDocumentTypeManager.ts` | Stores type definitions, URI → type matching |
| `EditorDocumentModelManager` | `studio/src/bifrost/common/EditorDocumentModelManager.ts` | Lazy model creation, lifecycle hook invocation |
| `EditorDocumentRendererManager` | `studio/src/bifrost/common/EditorDocumentRendererManager.ts` | Renderer component lookup |
| `EditorDocumentInspectorManager` | `studio/src/bifrost/common/EditorDocumentInspectorManager.ts` | Inspector component lookup |
| `EditorAreaManager` | `studio/src/bifrost/common/EditorAreaManager.ts` | Editor layout, tab ordering, split editors |

---

## File Path Reference

| Component | Path |
|-----------|------|
| EditorDocumentModel (base class) | `studio-sdk/src/common/EditorDocumentModel.ts` |
| EditorDocumentRendererProps | `studio-sdk/src/contracts/EditorTypes.ts` |
| EditorDocument type | `studio-sdk/src/contracts/EditorTypes.ts` |
| DocumentInspectorProps | `studio-sdk/src/contracts/PaneTypes.ts` |
| EditorEvents | `studio-sdk/src/contracts/internal/EditorEvents.ts` |
| EditorDocumentTypeManager | `studio/src/bifrost/common/EditorDocumentTypeManager.ts` |
| EditorDocumentModelManager | `studio/src/bifrost/common/EditorDocumentModelManager.ts` |
| EditorDocumentRendererManager | `studio/src/bifrost/common/EditorDocumentRendererManager.ts` |
| EditorDocumentInspectorManager | `studio/src/bifrost/common/EditorDocumentInspectorManager.ts` |
| EditorAreaManager | `studio/src/bifrost/common/EditorAreaManager.ts` |
| EditorMediator | `studio/src/bifrost/browser/EditorMediator.ts` |
| EditorMediator SDK types | `studio-sdk/types/browser/EditorMediator.ts` |
| EditorWrapper (renderer usage) | `studio/src/components/editors/EditorWrapper.tsx` |
| EditorDocumentInspector (inspector usage) | `studio/src/components/panes/inspectors/EditorDocumentInspector.tsx` |
