# BPMN Process Landscape

---

## Overview

`studio/src/modules/bpmn-landscape/` holds process landscape maps: `.bfwmap` files in the solution that place processes, groups and notes on a canvas and show how the processes relate. A map stores which processes it shows and where; relations between processes are derived from the solution scan and never stored. The process catalog is `scanSolutionBpmnModels` in `bpmn-core` ([modules.md](modules.md) §bpmn-core). The editor is a plain diagram-js `Diagram` with landscape-specific services, opened on the page Discover › Landscapes ([workbench-categories.md](workbench-categories.md)).

---

## Architecture

```
scanSolutionBpmnModels (bpmn-core, cached, worker)
        │ SolutionBpmnModelEntry[]
        ▼
buildProcessRelations ──► ProcessRelation[]   (derived, never saved)
                                │ key
.bfwmap ◄─► LandscapeMapFile ──►│ hiddenRelations, relationLayers
```

### Process Relations

#### buildProcessRelations

**Path:** `studio/src/modules/bpmn-landscape/buildProcessRelations.ts`

`buildProcessRelations(entries)` turns the processes of every `bpmn` scan entry into directed relations. A process is a `LandscapeProcessReference` `{ uri, processId }`, so the same id in two files stays two processes.

| Kind | Source → target | Rule |
|---|---|---|
| `callActivity` | caller → called process | A call activity's `calledElement` equals the process id; one relation per process pair, with every call activity id in `sourceFlowNodeIds`. An id defined in several files yields one relation per file; an unknown id yields none. |
| `message` | sender → receiver | A name in `thrownMessages` of one process equals a name in `caughtMessages` of another; one relation per pair and name. |
| `signal` | thrower → catcher | Same as `message` with `thrownSignals` / `caughtSignals`; a signal and a message of the same name never match. |

- **Name matching:** by the resolved `<bpmn:message>` / `<bpmn:signal>` name, the routing key the Engine uses. A message relation means "can send"; correlation is not known at design time.
- **Self-relations** are left out, because they never connect two map elements.
- **`key`:** `<kind>:<source process id>:<target process id>` plus `:<name>` for messages and signals. `hiddenRelations` stores it. Processes with the same id in different files share a key.
- **Order:** by key, then source and target URI.

### Map File Format

#### LandscapeMapFile

**Path:** `studio/src/modules/bpmn-landscape/LandscapeMapFile.ts`

`.bfwmap` is XML in the namespace `https://bifrostforge.world/schema/landscape` (prefix `landscape`), read and written with `moddle` / `moddle-xml` like BPMN and DMN. `LANDSCAPE_PACKAGE` is the moddle package descriptor (`xml.tagAlias: 'lowerCase'`, so the type `MapLink` is the tag `<landscape:mapLink>`). `parseLandscapeMap(text)` is async and resolves to `{ ok: true, map }` or `{ ok: false, errors }` with every problem as a diagnostic sentence naming the element; it never rejects. `serializeLandscapeMap(map)` is synchronous and writes the XML preamble, two-space indentation, a fixed attribute order (id and geometry first, from the abstract `MapElement`) and a trailing newline. Default values are omitted: empty labels, `collapsed="false"`, `shape="box"`, relation layers that are on. `createEmptyLandscapeMap(name)` returns a map without levels, elements or connectors and every relation layer on.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<landscape:map xmlns:landscape="https://bifrostforge.world/schema/landscape" version="1" name="Order to Cash">
  <landscape:level id="level-domain" name="Domain" />
  <landscape:relationLayers signal="false" />
  <landscape:group id="sales" x="0" y="0" width="400" height="200" label="Sales">
    <landscape:process id="order" x="20" y="40" width="160" height="60" processId="order-process" fileHint="processes/order.bpmn" />
    <landscape:note id="todo" x="200" y="40" width="160" height="80">Check the
returns process</landscape:note>
  </landscape:group>
  <landscape:connector id="link" sourceId="order" targetId="todo" label="Invoice">
    <landscape:waypoint x="180" y="70" />
  </landscape:connector>
  <landscape:hiddenRelation key="message:order-process:billing-process:InvoiceRequested" />
</landscape:map>
```

| Element of `<landscape:map>` | Meaning |
|---|---|
| attributes `version`, `name` | `version` must be `1`; a higher version is rejected with a hint to update the Studio, a missing one with "The map needs version 1." `name` is the map title. |
| `<landscape:level id name>` | `levels[depth]` names the groups at that nesting depth |
| `<landscape:relationLayers callActivity message signal>` | Visibility of the relation kinds, each `true` by default; written only when a layer is off |
| `<landscape:band>`, `group`, `process`, `placeholder`, `mapLink`, `note` | Map elements, see below |
| `<landscape:connector id sourceId targetId label>` | Manual link between two different elements, with `<landscape:waypoint x y>` children |
| `<landscape:hiddenRelation key>` | A `ProcessRelation.key` the user hid |
| foreign attributes and elements | Kept in `LandscapeMap.extensions` (`attributes`, `elements`) and written back on the root; elements follow the known children |

Every element has `id`, `x`, `y`, `width` and `height` (both greater than 0), and optional `fill` and `stroke` (read as `style { fill, stroke }`, `null` when neither is set). Containment is XML nesting: `parentId` is the enclosing band or group, `null` at the top level. When writing, an element whose `parentId` is not a band or group on the map goes to the top level.

| Element | Attributes and content |
|---|---|
| `band` | `label`; always top level; contains elements |
| `group` | `label`, `collapsed` (default `false`); contains elements |
| `process` | `processId`, `fileHint` (BPMN file relative to the map; absent is `null`), `label` (absent shows the process name), `shape` (`box` or `chevron`, default `box`) |
| `placeholder` | `label`, `shape`; a process that is not modelled |
| `mapLink` | `label`, `mapPath` (`.bfwmap` relative to the map) |
| `note` | The element body is the text, kept verbatim with line breaks |

Labels are attributes; line breaks in them are written as `&#10;` and read back.

The reader runs with `lax: true` and turns every moddle warning into an error, so the parse reports everything in one pass:

| Problem | Message |
|---|---|
| Not well-formed XML, including a JSON map | `The file is not well-formed XML. Line n, column n: <reason>.` (1-based) |
| Another root element or another namespace | `The file is not a landscape map: the root element must be <landscape:map> in the namespace …` |
| Unknown element or attribute of the landscape namespace | `Line n, column n: unknown type <landscape:X>.` / `Unknown attribute <x> on <landscape:tag> 'id'.` |
| Foreign element below the root | `Line n, column n: unrecognized element <foo:bar>.` |

Validation also rejects: a missing or empty required attribute; a band inside a group or band; an id used twice across elements and connectors; a process id shown twice; a connector to a missing element or to its own source; a waypoint without numeric `x` and `y`; `fileHint` or `mapPath` that is absolute, a drive path or a URI.

`relativeFileHint(mapUri, fileUri)` builds `fileHint`: the path of `fileUri` relative to the map's folder, with `/` separators and `..` segments.

---

## Map Editor

### Registration

**Path:** `studio/src/modules/bpmn-landscape/index.tsx`, loaded after `bpmn-diff` in `createAndInitializeBifrost.ts`.

| Registration | Value |
|---|---|
| Page | `discover/landscapes` ("Landscapes", `paneAreas: ['left']`, editor tabs visible, `order: 0`) |
| Document type | `bpmn-landscape-map`: `uriMatch /\.bfwmap$/`, `page: 'discover/landscapes'`, model `LandscapeMapDocumentModel`, renderer `LandscapeMapRenderer` |
| Included files | `**/*.bfwmap` |
| Left pane group | `landscapes` with the pane `discover/landscapes/landscapes` (Processes) |
| Icons | `bpmn-landscape/page/landscapes`, `bpmn-landscape/document-type/map` |
| Help text | `discover/landscapes` (`texts/landscapes.md`) |

### LandscapeMapDocumentModel

**Path:** `studio/src/modules/bpmn-landscape/LandscapeMapDocumentModel.ts`

| Concern | Behaviour |
|---|---|
| Create | `static create` reads an empty file as `createEmptyLandscapeMap(<basename>)`. The document opens clean; the first edit makes it dirty and saving writes the whole map. |
| Load | `create` and the watcher's reload await `parseLandscapeMap`; `applyParseResult(result)` shows the map and returns the parse errors. A modeler exists only after the first successful parse; metadata `readable` tells the renderer which view to show. |
| Save gate | `saveEditorDocument` returns `null` (default save) when a modeler exists; otherwise it shows a warning and returns `false`, so an unreadable file is never written. |
| Dirty tracking | `commandStack.changed` (not trigger `clear`) exports the canvas with `canvasToMap(root, previousMap)`, serializes it and calls `updateCurrentData`. A Studio-written file returns to clean after undo. |
| Undo / redo | `commandStack.undo()` / `redo()` |
| Watcher | DMN pattern. A readable external change reloads; text equal to the current data only clears the flags and keeps undo history and selection; an unreadable change while a modeler exists keeps the last good map and sets `errorOnReloadingFile`; `unlink` / `add` set `removedFromFileSystem`. |
| Metadata | `readable`, `viewbox`, `hasSelection`, `selectionRevision`, the watcher flags. Nothing else is persisted. |
| Catalog | `scanSolutionBpmnModels` on create, focus and `solutionChanged`; afterwards `elements.changed` redraws the process shapes. |
| Process label | The element label, else the name of the catalog process whose file matches `fileHint`, else the first catalog match, else `processId`. |

Public methods used by the renderer, pane and commands: `getParseErrors`, `attachTo(element)` / `detach()` (append the canvas, `canvas.resized()`, restore the viewbox or `fit-viewport` on first attach), `toCanvasPoint(clientX, clientY)`, `getProcessIdsOnMap`, `addProcess({ processId, fileUri, x, y })` (selects the existing shape when the process is on the map), `isDirectEditingActive`, `hasClipboardContent`, `deleteSelection`, `copySelection`, `paste`, `moveSelection(direction, accelerated)`.

### LandscapeModeler

**Path:** `studio/src/modules/bpmn-landscape/modeler/LandscapeModeler.ts`

`new Diagram({ canvas: { container }, keyboard: { bind: false }, landscape: config })`. The diagram-js keyboard is unbound; Studio keybindings drive the editor actions.

- **diagram-js modules:** selection, move, resize, auto-resize, modeling, create, connect, bendpoints, lasso, hand tool, align, distribute, copy-paste, keyboard, keyboard-move-selection, editor-actions, grid-snapping, root-elements, overlays, context-pad, palette, zoomscroll, movecanvas, plus `diagram-js-grid`, `diagram-js-minimap` and `diagram-js-direct-editing`.
- **`importMap(map)`** clears the canvas, adds `mapToCanvasDescriptors(map)` shapes parent-first, bands and groups before their other siblings, and connections (laid out when they have fewer than two waypoints), then clears the command stack. **`exportMap(previousMap)`** walks the root depth-first.
- **`addProcessShape(element, center)`** creates the shape inside the smallest group or band under the point, else on the root.

Every shape's `businessObject` is the file element (`landscapeCanvasMapping.ts`); geometry comes from the shape, everything else from the business object.

| Service | Path | Role |
|---|---|---|
| `landscapeRenderer` | `modeler/LandscapeRenderer.ts` | Priority 1500. Rounded boxes for process and placeholder (placeholder dashed), boxes for group and band with the title at the top, a folded-corner note; `mapLink` and band use the box as fallback, `chevron` is drawn as a box. Fill and stroke from `style`, else the theme variables `--color-bpmn-defaultFillColor/StrokeColor`. |
| `landscapeRules` | `modeler/LandscapeRules.ts` | A process at most once (`shape.create`, `elements.create`); the root holds anything, a group or band holds anything except a band; groups alone may be created or moved with the cursor on an element that holds nothing, the element's parent is checked instead; no connector creation or reconnection; processes are not copied. |
| `orderingProvider` | `modeler/LandscapeOrdering.ts` | `OrderingProvider` on `shape.create` / `shape.move`. A parent that holds nothing is replaced by its nearest group, band or the root. Index by level: bands and groups first, other shapes next, connections last, so a group is drawn behind the elements beside it. |
| `landscapeGroupMembership` | `modeler/LandscapeGroupMembership.ts` | `CommandInterceptor`, `postExecuted` of `shape.create` and `shape.resize` of a group and `elements.move` for every moved group, including auto-resize. A child the group no longer fully encloses moves to the smallest group or band outside the group that encloses it, else the root; then every non-band sibling the group fully encloses moves in. Moves use `moveElements` with delta 0 and `autoResize: false` inside the triggering command, so one undo reverts the whole action. |
| `layouter` | `modeler/LandscapeLayouter.ts` | `repairConnection` with `h:h`, cropped by `CroppingConnectionDocking` |
| `landscapeLabelEditing` | `modeler/LandscapeLabelEditing.ts` | Direct editing on double-click for group, band, placeholder, map link and note; command `landscape.updateLabel`. Processes are left out. |
| `landscapeCopyPaste` | `modeler/LandscapeModeler.ts` | Copies a structured clone of the business object; paste gives it a new id. The clipboard lives in the diagram instance, so it is per map. |
| `paletteProvider` | `modeler/LandscapePaletteProvider.ts` | Hand, lasso, group (400×240), placeholder (140×60), note (160×80) |
| `contextPadProvider` | `modeler/LandscapeContextPadProvider.ts` | Delete |

### Renderer, Pane and Commands

- **`LandscapeMapRenderer.tsx`:** shows `EditorLoadingError` while the map is unreadable, otherwise the watcher title warnings and the canvas host (`data-test--landscape-canvas`). The host is a `useDropTarget` for `tree_item` subjects with `metadata.processId`; a drop calls `bpmn.landscape.addProcessToMap` with `toCanvasPoint(event)`. Styles: `styles/landscape.scss`.
- **Processes pane (`panes/ProcessesPane.tsx`):** one collapsed row per BPMN file (sorted by name, `!` badge for an invalid file), process rows with `metadata.processId` and `fileUri` and a map-pin badge when the process is on the focused map. The filter matches file name, process name and id and expands matching files. The header has a "New Map" icon for `bpmn.landscape.newMap`. Rows carry no `uri`, so nothing can be dropped inside the tree.

| Command | Behaviour |
|---|---|
| `bpmn.landscape.newMap` | Needs an open solution. Creates `<first project>/landscapes/` if missing, asks for a path with the native save dialog, appends `.bfwmap` when missing (and stops with a warning when that file exists, because the dialog only checked the name without the extension), writes an empty map via `editors.createNewEditorDocument` and calls `solution.onElementAdded`. Cancel, or a path outside the folder, removes the folder only if this command created it. |
| `bpmn.landscape.addProcessToMap` | `{ processId, fileUri, x, y }` in canvas coordinates, on the focused map |
| `bpmn.landscape.deleteSelection`, `copySelection`, `paste` | Editor actions on the focused map; enabled with a selection (paste: clipboard not empty) |
| `bpmn.landscape.moveSelection{Left,Right,Up,Down}[Accelerated]` | `keyboardMoveSelection.moveSelection` |

The selection commands do nothing while direct editing is active, so the keys reach the text box. Keybindings are scoped to `.kbm-editor[data-editor-document-type=bpmn-landscape-map]`: Backspace (macOS) / Delete, Cmd/Ctrl+C, Cmd/Ctrl+V, the arrow keys and Shift+arrow keys. Undo, redo and save use the global `std.editor.*` bindings.

---

## File Path Reference

| Component | Path |
|---|---|
| Module entry, commands | `studio/src/modules/bpmn-landscape/index.tsx`, `commands.ts` |
| Document model, renderer | `studio/src/modules/bpmn-landscape/LandscapeMapDocumentModel.ts`, `LandscapeMapRenderer.tsx` |
| Modeler and services | `studio/src/modules/bpmn-landscape/modeler/` |
| Processes pane | `studio/src/modules/bpmn-landscape/panes/ProcessesPane.tsx` |
| Styles, help text | `studio/src/modules/bpmn-landscape/styles/landscape.scss`, `texts/landscapes.md` |
| Relation derivation | `studio/src/modules/bpmn-landscape/buildProcessRelations.ts` |
| Map file format | `studio/src/modules/bpmn-landscape/LandscapeMapFile.ts` |
| Solution scan | `studio/src/modules/bpmn-core/scanSolutionBpmnModels.ts` |
| Scan parsing (worker side) | `studio/src/modules/bpmn-core/parseSolutionBpmnModel.ts`, `bpmn-model-scan-worker.ts` |
| Unit tests | `studio/test/unit/bpmn-landscape/`, `studio/test/unit/bpmn-core/scanSolutionBpmnModels.test.ts` |
| Integration tests | `studio/test/integration/bpmn-landscape/` (`npm run test:integration:bpmn-landscape`) |
