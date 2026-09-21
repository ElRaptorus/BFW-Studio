# DMN Editor

---

## Overview

The DMN editor is a three-module system for modeling, diffing, and merging DMN 1.5 diagrams. It mirrors the BPMN editor architecture: a core module provides shared infrastructure (modeler adapter, validation, command handlers, module registry, diff engine), an editor module provides the main editing experience (document model, renderer, property panes, search indexing, settings), and a diff module provides comparison and history features.

All three modules are internal (bundled with the Studio), loaded sequentially in `createAndInitializeBifrost.ts` as `dmn-core` → `dmn-editor` → `dmn-diff`.

---

## Module Split

| Module | Directory | Purpose |
|--------|-----------|---------|
| `dmn-core` | `studio/src/modules/dmn-core/` | Shared infrastructure: `DmnModelerComponentAdapter`, `DmnModelerModuleRegistry`, validation (`DmnValidator`), command handlers, diff engine (`DmnDiff`, `DmnViewerWithSync`, change summary builder) |
| `dmn-editor` | `studio/src/modules/dmn-editor/` | Main editing module: `DmnDocumentModel`, `DmnDocumentRenderer`, right-area panes across four groups (`property` / `scripting` / `documentation` / `validation`), search indexing, keyboard shortcuts, menus, settings, merge resolver, FEEL context, help texts |
| `dmn-diff` | `studio/src/modules/dmn-diff/` | Diff and history: `DmnDiffDocumentModel`, `DmnHistoryPreviewDocumentModel`, renderers, change overview / content diff panes, diff commands |

### Dependency Direction

```
dmn-core  ←  dmn-editor  ←  dmn-diff
                              ↕
                          git-cruiser (command-based wiring)
```

`dmn-core` has no dependency on `dmn-editor` or `dmn-diff`. `dmn-diff` imports from `dmn-core` (diff engine, viewer) but not from `dmn-editor`. `git-cruiser` wires to `dmn-diff` via registered commands, not direct imports.

---

## DmnModelerComponentAdapter

`studio/src/modules/dmn-core/DmnModelerComponentAdapter.ts`

The adapter wraps the `dmn-js` `Manager` (v17.8.1) and provides a unified API for the document model and panes. Key responsibilities:

- **Lifecycle:** `initialize(xml, restoredMetadata)`, `attachToHtmlElement(target)`, `dispose()`. `EVENT_DMN_ADAPTER_ATTACHED_TO_HTML` fires on `Manager.attach`. `EVENT_DMN_ADAPTER_READY_FOR_INTERACTION` fires **after** `waitForDrdCanvasLayout` sees a non-zero DRD `viewbox.outer` and the initial zoom/restore has run. Do not treat attach as interactive — dmn-js imported XML into a detached 0×0 container.
- **View management:** `getActiveView()`, `getActiveViewType()`, `getViews()`, `switchToView(view)` — DRD, decision table, literal expression, boxed expression
- **Canvas:** `getZoom()`, `setZoom(pct)`, `zoomToViewport()`, `zoomToElement(id)`, `getSvg()`
- **Undo/redo:** `canUndo()`, `canRedo()`, `undo()`, `redo()` — proxied to the active view's `CommandStack`
- **XML:** `getXml()`, `setXml(xml)` — round-trip serialization
- **Selection:** emits `EVENT_DMN_ADAPTER_SELECTION_CHANGED` when DRD selection changes
- **View changes:** emits `EVENT_DMN_ADAPTER_VIEW_CHANGED` with `{ views, activeView }`
- **XML changes:** emits `EVENT_DMN_ADAPTER_XML_CHANGED` when the command stack fires `commandStack.changed`
- **DRD access:** `getDrdModeling()`, `getDrdSelection()`, `getDrdElementRegistry()`, `getDrdOverlays()`, `getDrdEventBus()`, `getDrdPalette()`, `getDrdContextPad()`, `getModelerComponentByName<T>(name)`, `getModdle()`, `getModeler()`
- **Element operations:** `deleteSelectedElements()` via DRD `editorActions.trigger('removeSelection')`

### Multi-View Architecture (AD-3)

dmn-js uses a `Manager` that embeds multiple viewers: DRD (diagram-js), Decision Table (table-js/Inferno), Literal Expression, and Boxed Expression views. The Studio wraps this in a single editor tab with a view-switcher bar rendered by `DmnDocumentRenderer`. Each view has its own `CommandStack`, so undo history is scoped per view.

### Custom Modules

`DmnModelerModuleRegistry` (`studio/src/modules/dmn-core/DmnModelerModuleRegistry.ts`) mirrors the BPMN `BpmnModelerModuleRegistry` pattern. Custom diagram-js modules are registered via `dmnModelerModuleRegistry.register(module)` and injected into the DRD viewer at construction time.

### Command Handlers

Custom command handlers live in `studio/src/modules/dmn-core/dmn-js/CommandHandler/`:

| Handler | Purpose |
|---------|---------|
| `MultiCommandHandler` | Batches multiple sub-commands into one undo step |
| `UpdateBusinessObject` | Updates a single property on a DMN business object |
| `UpdateBusinessObjectList` | Adds/removes items from a list property |
| `CmdHelper` | Factory functions for creating command descriptors |

---

## Document Types

| Type | URI Pattern | Model | Renderer |
|------|-------------|-------|----------|
| `dmn` | `*.dmn` | `DmnDocumentModel` | `DmnDocumentRenderer` |
| `dmn.diff` | `fragment+dmn.diff:*` | `DmnDiffDocumentModel` | `DmnDiffDocumentRenderer` |
| `dmn.history-preview` | `fragment+dmn.history-preview:*` | `DmnHistoryPreviewDocumentModel` | `DmnHistoryPreviewDocumentRenderer` |

### DmnDocumentModel

`studio/src/modules/dmn-editor/DmnDocumentModel.ts`

Owns a `DmnModelerComponentAdapter`, a `DmnDocumentElementAccess`, a `DmnDocumentSelection`, and a `DmnValidationOverlayManager`. Key lifecycle:

1. `create()` — static factory; loads XML from file, detects merge conflict markers, calls `initialize()`
2. `initialize()` — passes XML to the adapter, marks `xmlLoaded = true`
3. `attachToHtmlElement()` — deferred until the renderer mounts the DOM container. `isReadyForInteraction()` stays false until the DRD canvas has a non-zero outer viewbox (see `waitForDrdCanvasLayout.ts`).
4. `onEditorDocumentWillSave()` / `onEditorDocumentDidSave()` — file watcher management
5. `onEditorDocumentWillClose()` — disposes subscriptions, adapter, validation manager

File watcher handles external changes, renames, and deletions with the same state machine as the BPMN model.

### DmnDocumentElementAccess

`studio/src/modules/dmn-editor/DmnDocumentElementAccess.ts`

Read/write API for DMN element properties. Uses `CmdHelper` + `DmnModelerComponentAdapter.getDrdModeling()` for undo-safe property updates. Key methods:

- `getById(id)`, `getElementType(id)`, `getBusinessObject(id)`, `getDefinitions()`
- `castElement(modelerElement)` → `DmnElement`
- `setElementProperty(id, prop, value)` — routed through custom command handlers
- `getElementPropertyValue(id, prop)`
- `getDecisionExpression(decisionId)` → `DmnExpressionType`
- `getAllIds()` — all DRG element IDs; `countElementsByType()` — element counts grouped by `dmn:*` type
- Item definition CRUD: `getItemDefinitions()`, `addItemDefinition()`, `updateItemDefinition()`, `removeItemDefinition()`
- Import CRUD: `getImports()`, `addImport()`, `removeImport()`

There is no `getAllElements()` method returning full element objects — callers that need the full DRG element list (e.g. `DmnApiBridge.handleGetElements()`) iterate `DmnModelerComponentAdapter.getDrdElementRegistry().getAll()` directly and build snapshots via `castElement()` / `getById()`, rather than going through a single aggregate accessor.

### DmnDocumentSelection

`studio/src/modules/dmn-editor/DmnDocumentSelection.ts`

Selection abstraction that works across DRD and expression views. Listens to `EVENT_DMN_ADAPTER_SELECTION_CHANGED` and re-maps modeler elements via `castElement()`. Methods: `getElements()`, `getOnlyElementOrNull()`, `selectElement(id)`, `selectElements(ids)`, `isCurrentlySelected(id)`.

---

## Pane System

The general pane contract (`PaneProvider`, `shouldBeDisplayed` vs renderer, `PaneWrapper` gating) is documented in **[panes.md](panes.md)**. DMN-specific helpers live in `studio/src/modules/dmn-editor/panes/PropertiesPaneFunctions.ts`. Those helpers check document type, view, and selection only. Modeler `isReadyForInteraction()` is handled in `getDmnSelectionForPropertiesPane` / renderer `return null` so the pane header can still show while the body is empty.

Registration is in `initializeDmnPanes.ts`. Grouping matches BPMN: **property** holds fields without which the element cannot function; **scripting** holds optional definitions-level catalogs; **documentation** holds Markdown; **validation** is a findings group of its own (same role as BPMN `linter`, but a dedicated group so BPMN `linterCounts` icon wiring is not reused). Canvas-redundant dumps (requirement edges, table column lists, boxed-expression counts, Decision Service composition, Element Summary) are not registered.

### Right-area groups

| Group | Purpose | Empty DRD (nothing selected) |
|-------|---------|-------------------------------|
| `property` | Element / definitions identity and the expression’s raison d’être | Definitions only (Name, ID, Namespace, Exporter, Exporter Version) |
| `scripting` | Optional type catalog and cross-model imports | Item Definitions + Imports (empty-state + Add) |
| `documentation` | Markdown `description` on the selected DRG element | Hidden (no selection) |
| `validation` | `DmnValidator` findings, selection-independent | Always shown for a focused DMN document |

Do **not** reuse BPMN’s `linter` group. DMN `validation` hides on BPMN documents (no displayable panes) and vice versa.

### Property Panes (right / property group)

| Pane | Component | Visibility Rule | Fields |
|------|-----------|-----------------|--------|
| Merge Changes | `DmnMergeChangeOverview` | Merge documents only | Unchanged merge UI |
| Definitions | `PropertiesDefinitions` | DMN focused, DRD view, no element or root selected | Name, ID, Namespace (editable); Exporter, Exporter Version (read-only) |
| Decision | `PropertiesDecision` | DMN focused, DRD view, single `dmn:Decision` selected | Name, ID, Output Variable, Output Type (`variable.typeRef`, creatable catalog) |
| InputData | `PropertiesInputData` | DMN focused, DRD view, single `dmn:InputData` selected | Name, ID, Variable Name, Type (`variable.typeRef`, creatable catalog) |
| BKM | `PropertiesBKM` | DMN focused, DRD view, single `dmn:BusinessKnowledgeModel` selected | Name, ID, Output Variable, Output Type (`variable.typeRef`, creatable catalog) |
| KnowledgeSource | `PropertiesKnowledgeSource` | DMN focused, DRD view, single `dmn:KnowledgeSource` selected | Name, ID, Type (`businessObject.type`, free text — not `typeRef`) |
| DecisionService | `PropertiesDecisionService` | DMN focused, DRD view, single `dmn:DecisionService` selected | Name, ID |
| DecisionTable | `PropertiesDecisionTable` | DMN focused, `decisionTable` view active | Hit Policy; Aggregation when Hit Policy is COLLECT |
| LiteralExpression | `PropertiesLiteralExpression` | DMN focused, `literalExpression` view active | Output Type (owning Decision `variable.typeRef`, creatable catalog); `FeelEditor` for the expression text |

`typeRef` fields use `PaneProperty type="text-with-suggestions"` via `getTypeRefSuggestions` in `PropertiesPaneFunctions.ts`: FEEL builtins (`FEEL_BUILTIN_TYPES`) plus `model.elements.getItemDefinitionNames()`. Free text remains allowed (create option). Simple Item Definition Type on the Scripts pane uses the same helper (`excludeName` skips the definition being edited). Composite Item Definition Type stays a disabled dump. Table column Type menus still list only the nine builtins until a dedicated `dataTypes` follow-up.

Expression views treat the canvas as the editor. Property does not reprint table columns, rule counts, or boxed-expression structure. Column types and labels are edited in the decision-table column headers.

### Scripting Panes (right / scripting group)

`prependToPaneGroup('right', 'scripting', …)`. Same visibility as BPMN Process scripting: definitions-level, hidden when a DRG element is selected.

| Pane | Component | Visibility Rule |
|------|-----------|-----------------|
| ItemDefinitions | `PropertiesItemDefinitions` | DMN focused, DRD view, no DRG element selected (connection-only selection still counts as none) |
| Imports | `PropertiesImports` | Same as Item Definitions. Visible with zero imports: empty-state copy plus **Add Import** |

### Documentation Pane (right / documentation group)

| Pane | Component | Visibility Rule |
|------|-----------|-----------------|
| Documentation | `PropertiesDocumentation` | DMN focused, DRD view, single element selected |

Edits the `description` attribute on the DMN business object (not `documentation[0].text` like BPMN).

### Validation Pane (right / validation group)

Registered with `registerPaneGroup('right', 'validation', …, { label: 'Validation', icon: 'ph-fill ph-highlighter' })`. Independent of BPMN `linter`.

| Pane | Component | Visibility Rule |
|------|-----------|-----------------|
| Validation | `PropertiesValidation` | DMN focused, any view |

Global findings list from `DmnValidator`. Clicking a finding zooms and selects. Not the sanitizer (`DmnSanitizerInspector` in the bottom inspector).

`getKeyForDmnPropertiesPane` (DRD element panes) and `getActiveViewElementKey` (expression-view panes) are `type__id` only. Documentation `MarkdownEditor` is keyed `type__id`. Do not include `name` — that field is the value being edited; committing it remounts uncontrolled selects and the markdown editor.

### Inspector (bottom)

`DmnEditorDocumentInspector` registered on the `dmn` document type definition. Uses the generic host `DocumentContentInspector` + `DocumentTypeDefinitionInspector` pattern (`studio/src/components/panes/inspectors/`).

---

## Diff Architecture

Mirrors the BPMN diff architecture (`docs/architecture/bpmn-diff.md`).

### DmnDiff Engine

`studio/src/modules/dmn-core/diff/DmnDiff.ts`

XML-level structural comparison using `dmn-moddle`. Compares DRG elements by ID across two parsed definitions:

- **Added / Removed** — element exists in one version only
- **Updated** — semantic property changes (name, variable, expression fingerprint, requirements, DecisionService composition)
- **Layout Changed** — DMNDI bounds/waypoint changes only

Expression fingerprinting detects changes in decision tables (rule count, column count, hit policy), literal expressions (text hash), and boxed expressions (type + structure).

Output: `DmnDiffChangesByAction` with `{ added, removed, updated, layoutChanged }` keyed by element ID.

### DmnViewerWithSync

`studio/src/modules/dmn-core/diff/DmnViewerWithSync.tsx`

Read-only `NavigatedViewer` (DRD only) with viewbox sync, selection sync, and diff overlays. Used by both diff and merge views. Key defensive guards:

- `hasValidViewbox()` — prevents `SVGMatrix.scale()` errors from non-finite viewbox dimensions
- `requestAnimationFrame` deferral — viewbox sync and `resetZoom()` are deferred until after browser layout completes

### Document Models

`DmnDiffDocumentModel` owns two `DmnViewerWithSync` instances (before/after). On initialize: parses URI, loads before/after XML, runs `DmnDiff`, builds change summary. Provides change navigation API (`selectNextChange`, `selectPreviousChange`, `getCurrentAndMaxChanges`).

`DmnHistoryPreviewDocumentModel` extends `DmnDiffDocumentModel` with commit metadata and two modes: `'preview'` (single viewer) and `'diff'` (inherited side-by-side).

### Diff commands

| Command | Description |
|---------|-------------|
| `dmn.diff.openDiffOriginalDataVsCurrentData` | Working copy diff for the focused DMN (command search) |
| `dmn.diff.openDiffTwoFiles` | Compare two files by URI (called by git-cruiser) |
| `dmn.diff.showChangeSummaryDialog` | Markdown summary dialog from the computed `DmnDiffDocumentModel`. Toolbar passes `editorDocument`; `enabledWhen` and the handler fall back to the focused `dmn.diff` document when invoked with no args. The handler awaits `bifrost.dialog.open` until Close/Copy; integration tests must use `executeCommandWithoutBlocking`, not `executeCommand` |
| `dmn.diff.getChangeSummaryMarkdown` | Markdown summary for two XMLs (git-cruiser commit preview) |

---

## Search Indexing

### Worker Architecture

```
DmnSearchIndexerWorkerClient  →  DmnSearchIndexerWorker  →  DmnElementConverter
     (main thread)                  (web worker)              (DmnModdle parser)
```

`DmnElementConverter` parses DMN XML with `DmnModdle` and extracts:
- DRG elements: Decision, InputData, BKM, KnowledgeSource, DecisionService
- Expression content: decision table cells, literal expression text, hit policies
- Item definitions (non-selectable, searchable via `rest` field)
- DMNDI presence → `isSelectable` flag

Search results use weighted fields: `prio1` (name), `prio2` (ID), `prio3` (description), `rest` (JSON of all properties).

### Registration

In `dmn-editor/index.ts`:
- `bifrost.searchIndex.registerSearchIndexerWorkerClient('dmn', ...)`
- Search result filter: `isSelectable && label != null`
- Open handler: focus editor → `zoomToElement` + `selectElement`
- Icons: `dmn/search-result/types/{TypeName}`

---

## Client-Side Validation

`studio/src/modules/dmn-core/validation/DmnValidator.ts`

Debounced validator triggered on XML changes and property updates. Rules include:

- Required `name` on Decisions, InputData, BKMs
- Decision must have an expression (decision table, literal expression, etc.)
- Decision table completeness (inputs, outputs, at least one rule)
- Information requirement targets must exist
- Variable name consistency
- Item definition type validity

Results rendered via `DmnValidationOverlayManager` as DRD overlays and listed in the Validation right-area pane (`validation` group).

---

## Keyboard Shortcuts

Registered in `dmn-editor/index.ts` via `bifrost.keybindings.registerKeyBindings`:

| Action | macOS | Windows/Linux | Scope |
|--------|-------|---------------|-------|
| Delete selected elements | `Backspace` | `Delete` | `.kbm-editor[data-editor-document-type=dmn]` |

Undo, redo, zoom, save, and select-all are handled by the `std` module (generic for all editor types) or by diagram-js internally.

---

## Menus

### Application Menu

`View → DMN Editor` submenu (registered via `registerMenuModifier` on `std/application/main`):
- Toggle Grid
- Toggle Minimap

### DRD Element Context Menu

`dmn/element` — right-click on DRG element on the DRD canvas:
- Delete

### Command Search

| Command ID | Labels |
|------------|--------|
| `dmn.editor.openSettings` | DMN: Open DMN Settings |
| `dmn.editor.toggleShowGrid` | DMN: Toggle Grid |
| `dmn.editor.toggleShowMinimap` | DMN: Toggle Minimap |
| `std.editor.showExportDialog.dmn` | (toolbar **Export as...**) |
| `dmn.diff.compareTwoFilesFromSolution` | DMN: Compare two DMN files |

`std.editor.showExportDialog` dispatches to `std.editor.showExportDialog.dmn`. That dialog then calls `std.editor.exportDocumentAs`, which `std` forwards to `std.editor.exportDocumentAs.dmn` (SVG via `DmnModelerComponentAdapter.getSvg()`, DMN copy from `currentXml`). Do not put a BPMN `BpmnViewer.importXML` body on the unsuffixed `exportDocumentAs` name.

---

## Settings

Registered in `initializeDmnSettings.ts`:

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `dmn.editor.showGrid` | boolean | `true` | DRD grid visibility |
| `dmn.editor.showMinimap` | boolean | `false` | DRD minimap visibility |
| `dmn.editor.defaultHitPolicy` | enum | `'UNIQUE'` | Default hit policy for new decision tables |
| `dmn.editor.autoValidate` | boolean | `true` | Real-time validation on/off |

---

## FEEL Context

`initializeDmnFeelContext.ts` registers the `dmn.feel.getExpressionContext` command. It derives `FeelEditorVariable[]` from:
- All InputData names and types
- All upstream Decision output variables (via information requirements)
- BKM formal parameters (when editing a BKM's encapsulated logic)

This feeds the `FeelEditor` / `OneLineFeelEditor` autocompletion in decision table cells and literal expressions.

---

## Plugin identification types

Plugin authors do **not** import `DmnDocumentModel` or the full `DmnElement` union. Those live in `studio/src/modules/dmn-editor/` for the host editor.

Plugin-facing identification is `PluginDmnElementType` and `DmnViewType` on `studio-sdk/src/plugin-api/DmnApi.ts` (moddle-prefixed strings such as `'dmn:Decision'`, matching the host `DmnElementType` enum). Snapshots returned by `api.dmn.getElement` / `getElements` use that vocabulary. See [plugin-dmn-enrichment.md](plugin-dmn-enrichment.md).

Host typed model:

| File | Key exports |
|------|-------------|
| `studio/src/modules/dmn-editor/DmnElementTypes.ts` | `DmnElementType`, `DmnElement`, expression/hit-policy unions |
| `studio/src/modules/dmn-editor/DmnDocumentModel.ts` | Document model (extends `EditorDocumentModel`) |
| `studio/src/modules/dmn-editor/DmnDocumentSelection.ts` | Selection helpers |
| `studio/src/modules/dmn-editor/DmnDocumentElementAccess.ts` | Element access helpers |
| `studio/src/modules/dmn-core/DmnModelerComponentAdapter.ts` | Adapter + `DmnView` |
| `studio/src/modules/dmn-core/waitForDrdCanvasLayout.ts` | Poll until DRD `viewbox.outer` is non-zero after attach |

---

## Merge Resolver

`studio/src/modules/dmn-editor/merge/DmnMergeResolver.tsx`

`studio/src/modules/dmn-editor/merge/dmnXmlMergeEngine.ts` — pure XML-level merge engine (`dmnXmlMergeEngine()`). Mirrors BPMN `autoApplyEngine.ts`: parses starting-side and apply-side DOMs, applies non-conflicting `DmnDiffChangesByAction` entries (`removed`, `updated`, `layoutChanged`, `added`), returns merged XML and `autoAppliedIds`. Indexes semantic elements by `id` and DMNDI nodes by `dmnElementRef` on `DMNShape` / `DMNEdge`; appends new DI under `DMNDiagram`. No lane or connection-order handling.

`studio/src/modules/dmn-editor/merge/DmnMergeResultModeler.tsx` — result panel; runs `dmnXmlMergeEngine` for initial auto-apply and per-conflict resolution; tracks resolution state per element ID.

Three-panel layout (class component, mirrors `BpmnMergeResolver`):
- **Ours** (top-left) — read-only DRD viewer with classification overlays (`ours-only`, `theirs-only`, `both`)
- **Theirs** (top-right) — read-only DRD viewer, selection- and viewbox-synced with Ours
- **Result** (bottom) — `DmnMergeResultModeler`; viewbox-synced from Ours

Dual diffs (`base→ours`, `base→theirs`) via `DmnDiff`; `classifyElements()` unions changed DRG element IDs into `DmnClassifiedElement` (`ours-only` / `theirs-only` / `both`). `applySideChanges` is the apply-side diff bucket (ours on rebase, theirs on merge).

Imperative API on `resolverRef` (same surface as BPMN): zoom, conflict navigation, selection, `getClassifiedElements()`, per-element/key resolution (`acceptOursForElement`, `acceptTheirsForElement`, `revertAutoApplied`, etc.), `getResultXml()`, `getResolutionProgress()`, `getResultModelerApi()`.

Registered on the `dmn` document type via `mergeResolverKey: 'DmnMergeResolver'`. Git-cruiser dispatches to it via `classifyFileType()` returning `'dmn'` for `.dmn` files. Merge commands: `git.merge.acceptAllOurs.dmn`, `git.merge.getResultXml.dmn`, etc. in `initializeDmnCommands.ts`.

---

## Help Texts

7 module-level help texts registered in `initializeDmnHelpTexts.ts`:

| ID | File |
|----|------|
| `dmn/editor` | `texts/dmn-editor.md` |
| `dmn/decision-tables` | `texts/dmn-decision-tables.md` |
| `dmn/literal-expressions` | `texts/dmn-literal-expressions.md` |
| `dmn/boxed-expressions` | `texts/dmn-boxed-expressions.md` |
| `dmn/drd` | `texts/dmn-drd.md` |
| `dmn/decision-services` | `texts/dmn-decision-services.md` |
| `dmn/item-definitions` | `texts/dmn-item-definitions.md` |

Plus pane-level help text for the Documentation pane (`dmn/properties/documentation`).

Each remaining pane wires `PaneHeaderHelpIcon` to a matching help text ID:

| Pane | Help text ID |
|-------|-------------|
| Definitions, Decision, InputData, BKM, KnowledgeSource | `dmn/drd` |
| DecisionService | `dmn/decision-services` |
| DecisionTable | `dmn/decision-tables` |
| LiteralExpression | `dmn/literal-expressions` |
| ItemDefinitions | `dmn/item-definitions` |
| Imports, Validation | `dmn/editor` |
| Documentation | `dmn/properties/documentation` |

---

## Context Menu

The DRD context menu (`dmn/element`) provides:

| Item | Command | Condition |
|------|---------|-----------|
| Select All | `dmn.editor.selectAllElements` | DRD active and ready |
| Delete | `dmn.editor.deleteSelectedElements` | Has selection |
| Zoom to Element | `dmn.editor.zoomToSelectedElement` | Exactly one element selected |
| Open in Text Editor | `dmn.editor.openElementInTextEditor` | One element, local file |

Copy/Paste is not available — `dmn-js` DRD does not include a `copyPaste` module (open issue [dmn-js#384](https://github.com/bpmn-io/dmn-js/issues/384)).

---

## Grid & Minimap

Both `diagram-js-grid` and `diagram-js-minimap` are injected into the DRD viewer via `drd.additionalModules` in `DmnModelerComponentAdapter`. Settings `dmn.editor.showGrid` (default true) and `dmn.editor.showMinimap` (default false) are wired through `settingsUpdate` listeners in `DmnDocumentModel`. Minimap CSS is imported in `DmnDocumentRenderer`.

---

## Symbol Indexer

DMN participates in the Studio's structured symbol index alongside BPMN:

- **Worker client:** `DmnSymbolIndexerWorkerClient` (extends `AbstractWorkerClient`)
- **Worker:** `DmnSymbolIndexerWorker` — reuses `DmnElementConverter.getElementsFromXml()`, maps to `SymbolResult` with `dmn/search-result/types/*` icons
- **Registration:** `bifrost.symbolIndex.registerSymbolIndexerWorkerClient(DMN_DOCUMENT_TYPE, ...)`

Indexed elements: `Definitions`, `Decision`, `InputData`, `BusinessKnowledgeModel`, `KnowledgeSource`, `DecisionService`, `ItemDefinition`. Consumers can query by type, element ID, or definition ID.

---

## Per-Element Merge Resolution

The DMN merge system provides the same per-element conflict resolution as BPMN:

| Component | File | Purpose |
|-----------|------|---------|
| `dmnXmlMergeEngine` | `merge/dmnXmlMergeEngine.ts` | DOM-level XML merge with skip set |
| `DmnMergeResultModeler` | `merge/DmnMergeResultModeler.tsx` | Resolution state, engine re-runs, overlays |
| `DmnMergeResolver` | `merge/DmnMergeResolver.tsx` | Three-panel UI, dual diff, classification |
| `DmnMergeChangeOverview` | `merge/panes/DmnMergeChangeOverview.tsx` | Sidebar pane with per-element accept/reject |

Merge commands: `git.merge.zoomToViewport.dmn`, `git.merge.selectNextConflict.dmn`, `git.merge.acceptOursForElement.dmn`, `git.merge.acceptTheirsForElement.dmn`, etc.

DMN merge is element-level (one conflict key per DRG element) without custom-property sub-keys. The `dmnXmlMergeEngine` handles `removed`, `updated`, `layoutChanged`, and `added` actions, using `dmnElementRef` for DMNDI correlation.

---

## dmn-js Integration Details

- **Package:** `dmn-js` v17.8.1
- **CSS imports:** 10 stylesheet imports in `DmnDocumentRenderer.tsx` (diagram-js, dmn-font, decision table, boxed expression, literal expression, DRD, shared, controls)
- **View switching:** Internal to dmn-js `Manager`. The Studio renders a view-switcher bar mapping to `DmnView` objects.
- **Event wiring:** Adapter subscribes to `views.changed`, `commandStack.changed`, `selection.changed` on each sub-viewer
- **Undo history:** Scoped per view (DRD, decision table, etc.) — a known dmn-js limitation

---

## Engine Alignment

The DMN editor's type system (`DmnElementTypes.ts`) uses moddle-prefixed values (`'dmn:Decision'`, etc.) and camelCase expression types (`'decisionTable'`, `'literalExpression'`). These correspond to the engine's DMN parser output but use different naming conventions: the engine uses atoms (`:decision_table`, `:literal_expression`) while the Studio uses JavaScript-style camelCase. Hit policies use the same string values as the engine's `BfwEngine.DMN.Types.HitPolicy`.

---

## Plugin Integration

Plugins can enrich the DRD view (overlays, palette/context pad entries, modeling operations, renderer module injection) through the `api.dmn` namespace, gated by the `dmn` / `dmn.modelling` / `dmn.renderer` permission tiers. This is documented in full in [`plugin-dmn-enrichment.md`](plugin-dmn-enrichment.md) — the summary below only covers the touch points inside this module.

- `DmnModelerComponentAdapter` exposes the DRD service accessors plugins need indirectly: `getDrdModeling()`, `getDrdOverlays()`, `getDrdElementRegistry()`, `getDrdEventBus()`, `getDrdPalette()`, `getDrdContextPad()`, and the generic `getModelerComponentByName<T>(name)` escape hatch. None of these are called directly by plugins — they are called by `DmnApiBridge` (renderer process) on the plugin's behalf, gated by `PermissionGate`.
- `DmnDocumentModel` refreshes plugin overlays (via `DmnPluginOverlayManager`) whenever `EVENT_DMN_ADAPTER_XML_CHANGED`, `EVENT_DMN_ADAPTER_SELECTION_CHANGED`, or `EVENT_DMN_ADAPTER_VIEW_CHANGED` fires, and clears the document's overlay manager state `onEditorDocumentWillClose()`.
- `DmnModelerModuleRegistry` tracks plugin-injected diagram-js modules (`registerPluginModule` / `unregisterPluginModules` / `hasPluginModules`) alongside the core modules registered by this module — `getAll()` returns the flattened union, mirroring `BpmnModelerModuleRegistry`.
- `PluginDmnPaletteProvider` and `PluginDmnContextPadProvider` (`dmn-core/dmn-js/Provider/`) are pre-registered as DI modules in `modules/dmn-core/index.ts`, so every DRD modeler instance always has them available — they render as no-ops until a plugin actually contributes an entry.
- All of the above is DRD-only: the decision table / literal expression / boxed expression views have no plugin surface, matching the "DRD access" scope of `DmnModelerComponentAdapter` itself.

---

## Sanitizer

The DMN Sanitizer is a 1:1 architectural equivalent of the [BPMN Sanitizer](bpmn-sanitizer.md). It detects invisible structural artifacts in DMN XML — ghost DRG elements, zombie DI shapes/edges, orphaned definitions, dangling requirement references, and empty containers.

### Architecture

The implementation follows the same module split as the BPMN Sanitizer:

- **`dmn-core/sanitizer/`** — Pure detection (`DmnSanitizerAnalyzer`), fix command builder (`DmnSanitizerFixer`), diagram-js bridge (`SanitizerBridge`), React badge (`SanitizerBadge`), types, descriptions, SCSS
- **`dmn-editor/`** — Inspector pane (`DmnSanitizerInspector`), command registration (`initializeDmnSanitizerCommands`), help text (`dmn-sanitizer.md`)

### Key Differences from BPMN

- The bridge is injected into `drd.additionalModules` (not top-level), so it only runs when the DRD viewer is active
- The adapter's `views.changed` handler triggers sanitizer re-analysis when the user switches back to DRD from any sub-view (decision table, literal expression)
- DMN moddle uses `definitions.drgElement` instead of `definitions.rootElements`
- DMN DI uses `definitions.dmnDI.diagrams[].diagramElements[]` with `dmndi:DMNShape` / `dmndi:DMNEdge` and `dmnElementRef` instead of `bpmnElement`
- DMN has `itemDefinition` and `import` as definitions-level constructs (analogous to global Messages/Errors/Signals in BPMN)
- Ghost connection detection (shapeless requirements, shapeless associations) is deferred to v2 because `dmn-js` auto-renders edges when both endpoints are visible

### Issue Taxonomy

| Category | Issue Types | Severity |
|----------|------------|----------|
| Ghost Elements | `shapeless-decision`, `shapeless-input-data`, `shapeless-bkm`, `shapeless-knowledge-source`, `shapeless-decision-service` | error |
| Zombie Elements | `zombie-shape`, `zombie-edge` | warning |
| Dangling References | `dangling-requirement-ref`, `dangling-dmn-element-ref` | warning |
| Empty Containers | `empty-extension-elements` | warning |
| Unreferenced Definitions | `unreferenced-item-definition`, `unreferenced-import` | info |

### Commands

| Command | Searchable | Description |
|---------|-----------|-------------|
| `dmn.sanitizer.showInInspector` | Yes | Navigate to the sanitizer section in the DMN inspector |
| `dmn.sanitizer.fixAll` | Yes | Confirmation dialog + batch fix all issues |
| `dmn.sanitizer.fixIssue` | No | Fix a single issue (called from the inspector UI) |

### File Map

| File | Purpose |
|------|---------|
| `dmn-core/sanitizer/sanitizerTypes.ts` | Discriminated union types for all DMN issue kinds |
| `dmn-core/sanitizer/sanitizerIssueDescriptions.ts` | Per-issue message/why/suggestion + category labels |
| `dmn-core/sanitizer/DmnSanitizerAnalyzer.ts` | Pure detection function |
| `dmn-core/sanitizer/DmnSanitizerFixer.ts` | Fix command builder using DMN `CmdHelper` |
| `dmn-core/sanitizer/SanitizerBridge.ts` | Always-on diagram-js module for DRD |
| `dmn-core/sanitizer/SanitizerBadge.tsx` | Bottom-left canvas badge |
| `dmn-core/sanitizer/sanitizer.scss` | Imports shared styles from BPMN sanitizer |
| `dmn-core/sanitizer/index.ts` | Barrel exports |
| `dmn-editor/panes/inspector/panes/DmnSanitizerInspector.tsx` | Inspector section component |
| `dmn-editor/initializers/initializeDmnSanitizerCommands.ts` | Command + command search registration |
| `dmn-editor/texts/dmn-sanitizer.md` | Help text for the sanitizer |
