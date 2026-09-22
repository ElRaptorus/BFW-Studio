# BPMN Subprocess Drill-Down

---

## Overview

The BPMN editor supports navigating into collapsed embedded subprocesses via bpmn-js's built-in `DrilldownModule`. When a user drills into a subprocess, the canvas switches to a dedicated "plane" showing the subprocess's internal flow. The Studio wires this plane-switching into its document model, metadata persistence, property panes, and overlay system so that the editor UX remains consistent across planes.

---

## Architecture

### bpmn-js Plane System

bpmn-js creates a separate canvas root for each collapsed subprocess. These roots are managed by `SubProcessPlaneBehavior` (bundled with bpmn-js) and have IDs following the pattern `{subprocessId}_plane`. The active root is controlled via `canvas.setRootElement()`, which fires the `root.set` event.

The `DrilldownModule` (included in the modeler) provides:

| Component | Purpose |
|-----------|---------|
| `DrilldownOverlayBehavior` | Renders a clickable overlay button on collapsed subprocesses |
| `DrilldownBreadcrumbs` | Renders a breadcrumb trail above the canvas for plane navigation |
| `DrilldownCentering` | Saves/restores the viewbox when switching between planes |

### Event Flow

```
User clicks drilldown overlay / double-clicks subprocess / uses command
  → canvas.setRootElement(targetPlane)
    → diagram-js fires "root.set" { element: newRoot }
      → BpmnModelerComponentAdapter.onRootChanged()
        → emits EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED
          → BpmnDocumentModel handles:
              - refreshOverlays() (scoped to new plane)
              - updateMetadata({ currentRootId })
      → DrilldownBreadcrumbs updates trail
      → DrilldownCentering saves/restores viewbox
      → Selection is cleared (fires "selection.changed")
```

### Studio Integration Points

#### BpmnModelerComponentAdapter

**Path:** `studio/src/modules/bpmn-core/BpmnModelerComponentAdapter.ts`

- Listens to `root.set` in the modeler event map
- Emits `EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED` carrying the new root element
- `restoreViewboxAfterNavigation()` restores the root element before the viewbox when metadata contains `currentRootId`
- `initialize()` also restores the root on initial load from persisted metadata

#### BpmnDocumentModel

**Path:** `studio/src/modules/bpmn-editor/BpmnDocumentModel.ts`

- Subscribes to `EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED`
- On root change: refreshes overlays and updates metadata with `currentRootId`
- The `LOCATION_CHANGED` handler also includes `currentRootId` in the metadata payload
- `hideSubprocessDrilldown()` has been removed — bpmn-js drilldown overlays are no longer suppressed

#### BpmnDocumentElementAccess

**Path:** `studio/src/modules/bpmn-editor/BpmnDocumentElementAccess.ts`

Provides two element enumeration methods:

| Method | Scope | Use case |
|--------|-------|----------|
| `getAllElements()` | All planes (flat registry) | Cross-plane operations, ID uniqueness checks |
| `getVisibleElements()` | Current plane only | Overlays, pane logic, FEEL context |

`getVisibleElements()` walks each element's `.parent` chain and only returns elements whose root ancestor matches the current canvas root.

Helper methods:

| Method | Returns |
|--------|---------|
| `isInsideSubprocessPlane()` | `true` if the current root's businessObject is `bpmn:SubProcess` |
| `getCurrentRootElement()` | The raw diagram-js root element |

### Plane-Aware Property Panes

When the canvas root is a subprocess plane:

| Pane | Behavior |
|------|----------|
| `PropertiesDefinition` | Hidden (top-level metadata is irrelevant inside a subprocess) |
| `PropertiesProcess` | Hidden (subprocesses are not BPMN processes) |
| `PropertiesProcesses` | Hidden (participants exist on the parent plane) |
| `PropertiesSubprocessContext` | Shown when nothing is selected — displays subprocess name, ID, loop characteristics, and a "Back to parent" button |

**Path (new pane):** `studio/src/modules/bpmn-editor/panes/properties/PropertiesSubprocessContext.tsx`

### Enhanced Navigation

#### DrilldownBehavior (diagram-js module)

**Path:** `studio/src/modules/bpmn-core/bpmn-js/behaviors/DrilldownBehavior.ts`

Registers an `element.dblclick` handler at priority 1500 (above LabelEditingProvider at 1000). On double-click of a collapsed subprocess, calls `canvas.setRootElement()` with the subprocess's plane and prevents the default label-editing behavior.

#### Studio Commands

| Command | Description |
|---------|-------------|
| `bpmn.editor.drillDown` | Drills into the currently selected collapsed subprocess |
| `bpmn.editor.drillUp` | Returns to the parent plane (no-op if already at top level) |

Both commands are registered in the command search for command palette access.

### Breadcrumb Navigation Toolbar

The native bpmn-js breadcrumbs (`.bjs-breadcrumbs`) are hidden via `display: none` in `extend.bpmnio.scss`. They are replaced by a Studio-built breadcrumb bar that sits between `EditorToolbar` and `EditorContent` in the BPMN editor layout, following the same structural pattern as the DMN editor's `.dmn-view-switcher`.

#### Rendering

`BpmnDocumentRenderer` renders the breadcrumb bar via `renderBreadcrumbBar()`. The bar is only shown when the canvas is on a subprocess plane (`isInsideSubprocessPlane()` returns `true`). It subscribes to `EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED` to re-render when the active plane changes.

#### Breadcrumb Chain

`buildBreadcrumbChain()` walks up the `businessObject.$parent` chain from the current canvas root, collecting every `bpmn:SubProcess` and the top-level `bpmn:Process`. The result is an ordered array from the root process to the deepest subprocess. For nested subprocesses, every intermediate level is included and clickable.

| Item | Appearance | Behavior |
|------|------------|----------|
| Root process | Arrow icon + process name, muted color | Clickable — navigates to the root process plane |
| Intermediate subprocess | Name, muted color | Clickable — navigates to that subprocess's plane |
| Current subprocess | Name, accent highlight | Not clickable (active indicator) |

#### Navigation

Clicking a breadcrumb calls `canvas.setRootElement()` with the target plane (same mechanism as the `bpmn.editor.drillUp` command). For the root process, it locates the process root element among `canvas.getRootElements()`.

#### Styling

Styles are in `studio/src/modules/bpmn-editor/styles/bpmn-breadcrumb-bar.scss`. The bar uses existing theme tokens (`--theme-border`, `--theme-surface-secondary`, `--theme-fg-muted`, `--theme-accent`, `--theme-fg-on-accent`) and follows the DMN view-switcher layout pattern.

#### Drill-Down Overlay Theming

The bpmn-js drill-down overlay button is styled in `extend.bpmnio.scss` using CSS custom properties mapped to Studio theme tokens:

| bpmn-js Variable | Studio Token |
|------------------|--------------|
| `--drilldown-fill-color` | `--theme-fg-on-accent` |
| `--drilldown-background-color` | `--theme-accent` |

### Metadata Persistence

The `currentRootId` is persisted alongside the `viewbox` in the document's metadata. When restoring state (tab switch, session restore), the adapter:

1. Sets the canvas root to the persisted `currentRootId` (if it exists)
2. Then restores the viewbox

### Subsystem / View Compatibility

#### BPMN-Rendering Views

| View | Subprocess Handling |
|------|-------------------|
| **BPMN Editor (Modeler)** | Full drill-down. `DrilldownBehavior`, `bpmn.editor.drillDown` / `drillUp` commands, breadcrumb bar, plane-scoped overlays. This is the reference implementation. |
| **Engine Model Viewer** | Full drill-down via `BpmnViewerComponentAdapter`. See §Engine Model Viewer Drill-Down below. |
| **Engine Debugger** | Full drill-down via `BpmnViewerComponentAdapter`. Breadcrumb bar (`DebuggerSubprocessBreadcrumbBar`), plane-scoped overlay refresh on `EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED`. Embedded subprocess FNIs are loaded recursively from child PIs and overlaid on the subprocess plane. See §Engine Debugger Subprocess Integration below. |
| **History Preview** | No drill-down. Displays the full diagram on a single plane. Subprocess shells render as collapsed shapes. |

#### Other Subsystems

| Subsystem | Behavior with drill-down |
|-----------|-------------------------|
| **Linter** | Walks `$parent` from root to `bpmn:Definitions` — works on any plane. Canvas markers are naturally plane-scoped. |
| **Sanitizer** | Same `$parent` walk — analyses the entire document regardless of active plane. |
| **Token Simulator** | Operates on logical business objects, not canvas planes. Independent of drill-down. |

---

## Engine Model Viewer Drill-Down

The Engine Model Viewer provides read-only subprocess drill-down, mirroring the BPMN editor pattern on the shared `BpmnViewerComponentAdapter`.

### Entry Points

1. **bpmn-js built-in drilldown overlay** — The `BpmnViewer` includes `DrilldownModule` natively, which renders a clickable overlay button (`.bjs-drilldown`) on collapsed subprocesses. Clicking it calls `canvas.setRootElement()`.
2. **Commands** — `engine.modelViewer.drillDown` (requires a selected collapsed subprocess) and `engine.modelViewer.drillUp` (returns to parent plane).

### BpmnViewerComponentAdapter

**Path:** `studio/src/modules/bpmn-core/BpmnViewerComponentAdapter.ts`

The viewer adapter now listens to `root.set` in its event map and emits `EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED`, mirroring the modeler adapter's `EVENT_BPMN_MODELER_ADAPTER_ROOT_CHANGED`. This event is consumed by `ModelViewerDocumentModel` and `SubprocessBreadcrumbBar`.

### ModelViewerDocumentModel

**Path:** `studio/src/modules/engine-model-viewer/models/ModelViewerDocumentModel.ts`

- Subscribes to `EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED` in `registerViewerAdapter()`
- On root change: calls `refreshOverlays()` (plane-scoped) and persists `currentRootId` in metadata
- `refreshOverlays()` uses `getVisibleElements()` which filters to elements on the current plane only (same algorithm as `BpmnDocumentElementAccess.getVisibleElements()`)
- `isInsideSubprocessPlane()` checks `businessObject.$instanceOf('bpmn:SubProcess')` (not a strict `$type` equality), so Transaction and Ad-hoc Sub-Process planes are recognized identically to plain embedded subprocesses
- `getCurrentRootElement()` returns the raw canvas root element

### Breadcrumb Bar

The breadcrumb bar is rendered inline in `ModelViewerRenderer` via the `SubprocessBreadcrumbBar` component. It is only visible when inside a subprocess plane. The breadcrumb chain is derived at render time by walking `businessObject.$parent` from the current canvas root — identical to the BPMN editor pattern. The bar reuses the shared `bpmn-breadcrumb-bar` CSS classes from `studio/src/modules/bpmn-editor/styles/bpmn-breadcrumb-bar.scss`.

`ModelViewerRenderer.tsx` defines a shared `isSubProcessBusinessObject(businessObject)` helper (`$instanceOf('bpmn:SubProcess')`) used by `buildBreadcrumbChain`, `navigateToPlane` (root-finding), and the `SubprocessBreadcrumbBar` visibility check, so Transaction and Ad-hoc Sub-Process planes participate in breadcrumbs/navigation exactly like plain embedded and event subprocesses.

### Subprocess Context Pane

**Path:** `studio/src/modules/engine-model-viewer/panes/SubprocessContextPane.tsx`

Shown in the inspector when inside a subprocess plane with no element selected. Displays:

- Subprocess ID
- Subprocess name
- Loop characteristics
- "Back to parent" button (executes `engine.modelViewer.drillUp`)

For an Ad-hoc Sub-Process context (`businessObject.$type === 'bpmn:AdHocSubProcess'`), the pane additionally shows the (read-only) `ordering` and `completionCondition`.

### Subprocess Element Pane

**Path:** `studio/src/modules/engine-model-viewer/panes/SubProcessPane.tsx`

Shown in the inspector when a `bpmn:SubProcess` (or subclass: Transaction, Event Subprocess, Ad-hoc Sub-Process) element is selected on the canvas (as opposed to the context-pane's "no selection inside the plane" state above). `shouldBeDisplayed` matches on `:SubProcess`, `:Transaction`, `:AdHocSubProcess`. For an Ad-hoc Sub-Process, `getPaneTitle` returns "Ad-hoc Sub-Process" and the content additionally renders: Type, Ordering, Completion Condition, Cancel Remaining Instances, Implementation, and Active Elements (`bfw:ActiveElements`) — all read-only, sourced directly from the deployed model's `businessObject`.

### Commands

| Command | Description |
|---------|-------------|
| `engine.modelViewer.drillDown` | Drills into the selected collapsed subprocess |
| `engine.modelViewer.drillUp` | Returns to the parent plane |

Registered in `studio/src/modules/engine-model-viewer/initializers/initializeCommands.ts`, both visible in command search.

---

## Engine Debugger Subprocess Integration

The Engine Debugger combines bpmn-js drill-down with recursive child-PI FNI loading. Users can drill down into subprocess planes to see inner flow node execution state, and drill back up to the parent canvas. A `DebuggerSubprocessBreadcrumbBar` provides navigation between planes (identical to the Model Viewer's breadcrumb pattern). Overlays are refreshed on every `EVENT_BPMN_VIEWER_ADAPTER_ROOT_CHANGED` event to ensure execution state is current on the active plane.

### Architecture

The Engine creates a child Process Instance for each embedded subprocess activation (same pattern as Call Activity). The child PI's FNIs have `flowNodeId` values that match inner subprocess flow nodes in the parent BPMN diagram. The debugger leverages this by:

1. Loading child-PI FNIs at startup (recursive, handles nested subprocesses)
2. Receiving child-PI FNI events in real time via root-PI WebSocket fan-out
3. Rendering execution overlays on inner subprocess flow nodes alongside parent flow nodes

### Data Flow

```
Initial load:
  EngineAdapter.loadProcessWithXml()
    → loadProcessWithModelGraph() — getProcessInstanceWithModel + queryDataObjectValues
    → loadEmbeddedSubprocessChildFnis() — recursive
      → Find subprocess FNIs with childProcessInstanceId in typeProperties
      → Batch-load child PI FNIs via queryFlowNodeInstances
      → Batch-load child PI DOVs via queryDataObjectValues
      → Recurse for nested subprocesses
    → Emit to document model

Real-time updates:
  Root PI WebSocket channel (root-PI fan-out)
    → SubscribeThenSnapshot receives child FNI events
    → handleFniStarted/handleFniFinished (ID-based, PI-agnostic)
    → SubProcessChildStarted → handleSubProcessChild()
      → Updates subprocess shell FNI typeProperties
      → EngineAdapter.handleSnapshotUpdate('subprocess-child')
        → loadNewSubprocessChildFnis() — loads the new child PI's FNIs
```

### Whitelist Mechanism

The document model uses `whitelistedProcessInstanceIds` to control which FNIs are visible. This list always includes the root PI ID and the `childProcessInstanceId` values from `selectedSubProcessInstances`. When a subprocess is executed multiple times (loops), the user can select which iteration to inspect via the property panel dropdown. `sanitizeSelectedSubProcessInstances()` auto-selects the first iteration for each subprocess.

### Overlay Behavior

| Overlay | Parent flow nodes | Inner subprocess flow nodes |
|---------|-------------------|-----------------------------|
| Execution state cover | Yes | Yes (when child PI FNIs loaded and whitelisted) |
| Execution count badge | Yes | Yes |
| Retry link | Yes | Yes (routes retry to the child PI) |
| "Open in new tab" link | Call Activity only | Not applicable |
| Sequence flow markers | Yes | Yes (via `executedSequenceFlows`) |

### Key Design Decisions

- **Full drill-down enabled**: bpmn-js drilldown overlays are active. Users click the drilldown button on collapsed subprocesses to navigate into the subprocess plane, where execution overlays show child-PI FNI state. The `DebuggerSubprocessBreadcrumbBar` provides the "back to parent" navigation, styled identically to the Model Viewer breadcrumb bar.
- **No "Open in new tab" for subprocesses**: Unlike Call Activity children (which have independent BPMN processes), subprocess children share the parent's BPMN. Opening a subprocess child PI in a separate tab would show the same BPMN with a synthetic model ID that doesn't resolve correctly.
- **Retry supported for inner nodes**: Inner subprocess flow nodes display retry overlays. Since the Engine creates a child PI for each embedded subprocess, the retry targets the child PI (not the root PI) with the inner FNI as the checkpoint. `RetryAtFlowNodeLink` detects subprocess children by comparing `flowNodeInstance.processInstanceId` against `model.processInstance.id` and passes the child PI ID as a `processInstanceId` override to `engine.debugger.retryWithConfirmation`.

### Files

| Component | Path |
|-----------|------|
| EngineAdapter (FNI loading) | `studio/src/modules/engine-debugger/libs/EngineAdapter.ts` |
| SubscribeThenSnapshot (WS events) | `studio/src/modules/engine-core/SubscribeThenSnapshot.ts` |
| Document model (whitelist + overlays + root change) | `studio/src/modules/engine-debugger/EngineBpmnDebuggerEditorDocumentModel.ts` |
| Renderer (breadcrumb bar) | `studio/src/modules/engine-debugger/EngineBpmnDebuggerRenderer.tsx` |
| Overlay factory (guards) | `studio/src/modules/engine-debugger/overlays/OverlayFactory.ts` |
| BpmnProcessHelpers | `studio/src/modules/engine-debugger/libs/BpmnProcessHelpers.ts` |

---

## File Path Reference

| Component | Path |
|-----------|------|
| BpmnModelerComponentAdapter | `studio/src/modules/bpmn-core/BpmnModelerComponentAdapter.ts` |
| BpmnViewerComponentAdapter | `studio/src/modules/bpmn-core/BpmnViewerComponentAdapter.ts` |
| BpmnDocumentModel | `studio/src/modules/bpmn-editor/BpmnDocumentModel.ts` |
| BpmnDocumentRenderer | `studio/src/modules/bpmn-editor/BpmnDocumentRenderer.tsx` |
| BpmnDocumentElementAccess | `studio/src/modules/bpmn-editor/BpmnDocumentElementAccess.ts` |
| DrilldownBehavior | `studio/src/modules/bpmn-core/bpmn-js/behaviors/DrilldownBehavior.ts` |
| PropertiesSubprocessContext (editor) | `studio/src/modules/bpmn-editor/panes/properties/PropertiesSubprocessContext.tsx` |
| ModelViewerDocumentModel | `studio/src/modules/engine-model-viewer/models/ModelViewerDocumentModel.ts` |
| ModelViewerRenderer | `studio/src/modules/engine-model-viewer/renderers/ModelViewerRenderer.tsx` |
| SubprocessContextPane (model viewer) | `studio/src/modules/engine-model-viewer/panes/SubprocessContextPane.tsx` |
| ModelViewerCommands | `studio/src/modules/engine-model-viewer/commands/ModelViewerCommands.ts` |
| EngineBpmnDebuggerEditorDocumentModel | `studio/src/modules/engine-debugger/EngineBpmnDebuggerEditorDocumentModel.ts` |
| EngineBpmnDebuggerRenderer | `studio/src/modules/engine-debugger/EngineBpmnDebuggerRenderer.tsx` |
| initializeBpmnCommands | `studio/src/modules/bpmn-editor/initializers/initializeBpmnCommands.ts` |
| initializeModelViewerCommands | `studio/src/modules/engine-model-viewer/initializers/initializeCommands.ts` |
| Breadcrumb bar styles | `studio/src/modules/bpmn-editor/styles/bpmn-breadcrumb-bar.scss` |
| bpmn-js style overrides | `studio/src/bifrost/styles/extend.bpmnio.scss` |
