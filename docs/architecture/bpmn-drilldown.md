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

### Subsystem Compatibility

| Subsystem | Behavior with drill-down |
|-----------|-------------------------|
| **Linter** | Walks `$parent` from root to `bpmn:Definitions` — works on any plane. Canvas markers are naturally plane-scoped. |
| **Sanitizer** | Same `$parent` walk — analyses the entire document regardless of active plane. |
| **Token Simulator** | Operates on logical business objects, not canvas planes. Independent of drill-down. |
| **Engine viewers/debugger** | Drill-down is not enabled. `hideSubprocessDrilldown()` remains in engine document models. |

---

## File Path Reference

| Component | Path |
|-----------|------|
| BpmnModelerComponentAdapter | `studio/src/modules/bpmn-core/BpmnModelerComponentAdapter.ts` |
| BpmnDocumentModel | `studio/src/modules/bpmn-editor/BpmnDocumentModel.ts` |
| BpmnDocumentRenderer | `studio/src/modules/bpmn-editor/BpmnDocumentRenderer.tsx` |
| BpmnDocumentElementAccess | `studio/src/modules/bpmn-editor/BpmnDocumentElementAccess.ts` |
| DrilldownBehavior | `studio/src/modules/bpmn-core/bpmn-js/behaviors/DrilldownBehavior.ts` |
| PropertiesSubprocessContext | `studio/src/modules/bpmn-editor/panes/properties/PropertiesSubprocessContext.tsx` |
| initializeBpmnPanes | `studio/src/modules/bpmn-editor/initializers/initializeBpmnPanes.ts` |
| initializeBpmnCommands | `studio/src/modules/bpmn-editor/initializers/initializeBpmnCommands.ts` |
| Breadcrumb bar styles | `studio/src/modules/bpmn-editor/styles/bpmn-breadcrumb-bar.scss` |
| bpmn-js style overrides | `studio/src/bifrost/styles/extend.bpmnio.scss` |
