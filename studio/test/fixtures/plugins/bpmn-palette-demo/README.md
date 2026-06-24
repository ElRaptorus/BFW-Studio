# BPMN Palette & Modeling Demo

A fixture plugin that demonstrates the full range of BPMN plugin APIs available in Bifrost Forge World. It serves as both a functional reference and as the integration test target for Batches 8.2 and 8.3.

## Required Permission

`bpmn.modelling` — grants access to palette/context pad registration and all modeling operations.

## Activation

Activates on `onDocumentType:bpmn` — the plugin starts when a BPMN file is opened.

---

## Toggle Flag Feature (Coherent API Integration Demo)

The flagship feature of this demo plugin. It ties together a **context pad entry**, **overlays**, and **internal plugin state** into one coherent workflow:

### How it works

1. **Toggle flag** — Click "Toggle Flag" in the context pad. If the element is unflagged, it becomes flagged; if already flagged, it becomes unflagged.
2. **Orange flag overlay** — A `status`-type overlay with a flag icon and tooltip ("This element is flagged!") appears at the top-right corner of flagged elements. It disappears when unflagged.
3. **Overlay factory** — The overlay is produced by a registered `registerOverlayFactory`, which reads the internal flagged state. After toggling, `requestOverlayRefresh()` triggers a factory re-run.

### Architecture

```
┌───────────────────────────────────────────────────────┐
│  Internal state: flaggedElements = Map<uri, Set<id>>  │
└──────────────────────┬────────────────────────────────┘
                       │
    ┌──────────────────┴──────────────────┐
    ▼                                     ▼
┌──────────────────┐            ┌───────────────────────┐
│ "Toggle Flag"    │            │ Overlay Factory       │
│ Context Pad      │            │ (status badge per     │
│ (always visible) │            │  flagged element)     │
└──────────────────┘            └───────────────────────┘
  toggles state +                 requestOverlayRefresh()
  calls refresh                   → factory re-runs
```

### APIs demonstrated

| API | Role in the Toggle Flag feature |
|-----|--------------------------------|
| `api.bpmn.requestOverlayRefresh()` | Triggers factory re-run after state change |
| `api.bpmn.registerOverlayFactory(factory)` | Produces flag overlays on document open and on refresh request |
| `api.bpmn.registerContextPadEntry(entry)` | Registers the "Toggle Flag" entry (always visible) |

### Why this matters for plugin developers

This pattern answers the question: "How do I build a context pad action that has visible side effects on the canvas?" — which is one of the most common real-world plugin scenarios (think: bookmarking, review markers, approval stamps, breakpoints).

---

## Palette Entries

Palette entries appear in the BPMN editor's left-hand toolbar under the "Plugins" group.

| Entry | Icon | Behavior |
|-------|------|----------|
| **Run Analysis** | Magnifying glass | Counts all tasks, gateways, and events in the open diagram. Displays the result as a notification. |
| **Insert Service Task** | Plus circle | Appends a new `bpmn:ServiceTask` (named "New Service Task") after the currently selected element, connected by a sequence flow. Requires an element to be selected first. |

## Context Pad Entries

Context pad entries appear when an element is selected on the canvas.

### Manifest-declared (static)

| Entry | Icon | Appears on | Behavior |
|-------|------|-----------|----------|
| **Inspect Element** | Info | Tasks and SubProcesses | Reads the selected element's properties and displays them in a notification. |

### Runtime-registered (dynamic)

| Entry | Icon | Appears on | Behavior |
|-------|------|-----------|----------|
| **Rename Element** | Pencil | Tasks and SubProcesses | Sets the element's name to "Renamed at HH:MM" using `modeling.updateProperties`. Undoable. |
| **Delete Element** | Trash | All elements | Removes the element from the diagram using `modeling.removeElement`. Undoable. |
| **Nudge Right** | Arrow right | All elements | Moves the element 50px to the right using `modeling.moveElement`. Undoable. |
| **Toggle Flag** | Flag | All elements | Toggles the flagged state — adds or removes the flag overlay. |
| **View Connections** | Git branch | Gateways and Tasks (dynamic) | Shows a notification. Only visible on elements with 2+ outgoing flows. |

---

## API Capabilities Demonstrated

### Read-only BPMN API

| API | Used by |
|-----|---------|
| `api.bpmn.getElements(uri)` | Run Analysis, Flag context pad refresh |
| `api.bpmn.getElement(uri, elementId)` | Inspect Element |
| `api.bpmn.onElementSelected(uri, callback)` | Selection tracking for "Insert Task Template" |

### Overlay API

| API | Used by |
|-----|---------|
| `api.bpmn.requestOverlayRefresh()` | Triggers factory re-run after toggle |
| `api.bpmn.registerOverlayFactory(factory)` | Produces flag overlays on document open/switch and on refresh |

### Modeling API (undoable via Ctrl+Z)

| API | Used by |
|-----|---------|
| `api.bpmn.modeling.updateProperties(uri, elementId, props)` | Rename Element |
| `api.bpmn.modeling.removeElement(uri, elementId)` | Delete Element |
| `api.bpmn.modeling.appendElement(uri, sourceId, descriptor)` | Insert Service Task |
| `api.bpmn.modeling.moveElement(uri, elementId, delta)` | Nudge Right |
| `api.bpmn.modeling.createConnection(uri, sourceId, targetId, type?)` | (Test utility only) |

### Palette & Context Pad Registration API

| API | Used for |
|-----|----------|
| `api.bpmn.registerContextPadEntry(entry)` | All runtime context pad entries |
| `api.bpmn.unregisterContextPadEntry(entryId)` | Removal (test utility) |
| `api.bpmn.updateContextPadEntry(entryId, update)` | View Connections dynamic filter |
| `api.bpmn.registerPaletteEntry(entry)` | Available; manifest-declared entries used in this demo |
| `api.bpmn.unregisterPaletteEntry(entryId)` | Removal (test utility) |

---

## Key Patterns

### Dynamic Context Pad with `elementIds` Allowlist

The "View Connections" entry demonstrates on-demand filtering:

1. Register with `elementIds: []` (starts hidden).
2. Observe diagram changes to determine qualifying elements.
3. Call `updateContextPadEntry('view-connections', { elementIds: qualifyingIds })`.
4. Pass `{ elementIds: null }` to show on all type-matching elements.

### State-Driven Overlay Refresh

The Toggle Flag feature demonstrates the `requestOverlayRefresh()` pattern:

1. Plugin maintains internal state (`flaggedElements` map).
2. A registered overlay factory reads that state and produces overlays.
3. After each state mutation, `requestOverlayRefresh()` invalidates the factory cache and triggers a re-run.

### Selection Tracking

1. `registerOverlayFactory` captures `currentUri` from the overlay context.
2. `onElementSelected(uri, callback)` tracks the selected element.
3. Palette commands check `selectedElementId` before operating.

---

## Test Utility Commands

These commands exist solely as programmatic hooks for integration tests.

| Command | Purpose |
|---------|---------|
| `test.isActivated` | Returns `true` — confirms activation |
| `test.tryUnregisterContextPadEntry` | Unregisters a context pad entry by ID |
| `test.tryUnregisterPaletteEntry` | Unregisters a palette entry by ID |
| `test.updateContextPadEntry` | Calls `updateContextPadEntry` with given ID and update |
| `test.modeling.updateProperties` | Calls `modeling.updateProperties` |
| `test.modeling.removeElement` | Calls `modeling.removeElement` |
| `test.modeling.appendElement` | Calls `modeling.appendElement` |
| `test.modeling.createConnection` | Calls `modeling.createConnection` |
| `test.modeling.moveElement` | Calls `modeling.moveElement` |

---

## Manifest Structure

```json
{
  "permissions": ["bpmn.modelling"],
  "activationEvents": ["onDocumentType:bpmn"],
  "contributes": {
    "commands": [ ... ],
    "bpmnPalette": [
      { "id": "run-analysis", "command": "runAnalysis" },
      { "id": "insert-task-template", "command": "insertTaskTemplate", "group": "modeling" }
    ],
    "bpmnContextPad": [
      { "id": "inspect-element", "command": "inspectElement", "elementTypes": ["bpmn:Task", ...] }
    ]
  }
}
```
