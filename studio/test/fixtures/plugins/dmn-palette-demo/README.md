# DMN Palette & Modeling Demo

A fixture plugin that demonstrates the full range of DMN plugin APIs available in Bifrost Forge World. It serves as both a functional reference and as the integration test target for Batches 9.2 and 9.3 — the DMN parallel of `bpmn-palette-demo`.

## Required Permission

`dmn.modelling` — grants access to palette/context pad registration and all `api.dmn.modeling.*` operations.

## Activation

Activates on `onDocumentType:dmn` — the plugin starts when a DMN file is opened.

---

## Toggle Flag Feature (Coherent API Integration Demo)

Ties together a **context pad entry**, **overlays**, and **internal plugin state** into one coherent workflow, exactly like the BPMN counterpart:

1. **Toggle flag** — Click "Toggle Flag" in the context pad. If the element is unflagged, it becomes flagged; if already flagged, it becomes unflagged.
2. **Orange flag overlay** — A `status`-type overlay with a flag icon appears at the top-right corner of flagged DRD elements. It disappears when unflagged.
3. **Overlay factory** — The overlay is produced by a registered `registerOverlayFactory`, which reads the internal flagged state. After toggling, `requestOverlayRefresh()` triggers a factory re-run.

---

## Palette Entries

Palette entries appear in the DMN DRD editor's left-hand toolbar under the "Plugins" group.

| Entry               | Icon             | Behavior                                                                                                                                                         |
| ------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Run Analysis**    | Magnifying glass | Counts all decisions, input data, and BKMs in the open DRD. Displays the result as a notification.                                                               |
| **Insert Decision** | Plus circle      | Appends a new `dmn:Decision` (named "New Decision") after the currently selected element via `modeling.appendElement`. Requires an element to be selected first. |

## Context Pad Entries

Context pad entries appear when a DRD element is selected.

### Manifest-declared (static)

| Entry                 | Icon        | Appears on                                                   | Behavior                                                                       |
| --------------------- | ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Inspect Element**   | Info        | Decision, InputData, BusinessKnowledgeModel, KnowledgeSource | Reads the selected element's properties and displays them in a notification.   |
| **Rename Element**    | Pencil      | Decision, InputData, BusinessKnowledgeModel, KnowledgeSource | Sets the element's name via `modeling.updateProperties`. Undoable.             |
| **Delete Element**    | Trash       | All elements                                                 | Removes the element via `modeling.removeElement`. Undoable.                    |
| **Nudge Right**       | Arrow right | All elements                                                 | Moves the element 50px to the right via `modeling.moveElement`. Undoable.      |
| **Toggle Flag**       | Flag        | All elements                                                 | Toggles the flagged state — adds or removes the flag overlay.                  |
| **View Requirements** | Git branch  | Decision (dynamic)                                           | Shows a notification. Only visible on decisions with 2+ incoming requirements. |

### Runtime-registered (dynamic)

Registered at activation time via `api.dmn.registerContextPadEntry(...)`; see `index.js` for the exact filtering logic that drives `updateContextPadEntry` for **View Requirements**.

---

## API Capabilities Demonstrated

### Read-only DMN API

| API                                  | Used by                                |
| ------------------------------------ | -------------------------------------- |
| `api.dmn.getElements(uri)`           | Run Analysis, View Requirements filter |
| `api.dmn.getElement(uri, elementId)` | Inspect Element                        |

### Overlay API

| API                                       | Used by                                                               |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `api.dmn.requestOverlayRefresh()`         | Triggers factory re-run after toggle                                  |
| `api.dmn.registerOverlayFactory(factory)` | Produces flag overlays on document open/switch and on refresh request |

### Modeling API (undoable via Ctrl+Z)

| API                                                                 | Used by             |
| ------------------------------------------------------------------- | ------------------- |
| `api.dmn.modeling.updateProperties(uri, elementId, props)`          | Rename Element      |
| `api.dmn.modeling.removeElement(uri, elementId)`                    | Delete Element      |
| `api.dmn.modeling.appendElement(uri, sourceId, descriptor)`         | Insert Decision     |
| `api.dmn.modeling.createElement(uri, descriptor)`                   | (Test utility only) |
| `api.dmn.modeling.createConnection(uri, sourceId, targetId, type?)` | (Test utility only) |
| `api.dmn.modeling.moveElement(uri, elementId, delta)`               | Nudge Right         |

### Palette & Context Pad Registration API

| API                                              | Used for                                               |
| ------------------------------------------------ | ------------------------------------------------------ |
| `api.dmn.registerContextPadEntry(entry)`         | Runtime context pad entries                            |
| `api.dmn.unregisterContextPadEntry(entryId)`     | Removal (test utility)                                 |
| `api.dmn.updateContextPadEntry(entryId, update)` | View Requirements dynamic filter                       |
| `api.dmn.registerPaletteEntry(entry)`            | Available; manifest-declared entries used in this demo |
| `api.dmn.unregisterPaletteEntry(entryId)`        | Removal (test utility)                                 |

---

## Test Utility Commands

These commands exist solely as programmatic hooks for integration tests.

| Command                             | Purpose                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `test.isActivated`                  | Returns `true` — confirms activation                   |
| `test.tryUnregisterContextPadEntry` | Unregisters a context pad entry by ID                  |
| `test.tryUnregisterPaletteEntry`    | Unregisters a palette entry by ID                      |
| `test.updateContextPadEntry`        | Calls `updateContextPadEntry` with given ID and update |
| `test.modeling.updateProperties`    | Calls `modeling.updateProperties`                      |
| `test.modeling.removeElement`       | Calls `modeling.removeElement`                         |
| `test.modeling.createElement`       | Calls `modeling.createElement`                         |
| `test.modeling.appendElement`       | Calls `modeling.appendElement`                         |
| `test.modeling.createConnection`    | Calls `modeling.createConnection`                      |
| `test.modeling.moveElement`         | Calls `modeling.moveElement`                           |
| `test.getElement`                   | Calls `getElement`                                     |
| `test.getElements`                  | Calls `getElements`                                    |

---

## Manifest Structure

```json
{
  "permissions": ["dmn.modelling"],
  "activationEvents": ["onDocumentType:dmn"],
  "contributes": {
    "commands": [ ... ],
    "dmnPalette": [
      { "id": "run-analysis", "command": "runAnalysis" },
      { "id": "insert-decision-template", "command": "insertDecisionTemplate", "group": "modeling" }
    ],
    "dmnContextPad": [
      { "id": "inspect-element", "command": "inspectElement", "elementTypes": ["dmn:Decision", ...] }
    ]
  }
}
```
