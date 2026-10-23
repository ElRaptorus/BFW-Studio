# BPMN Process Landscape

---

## Overview

`studio/src/modules/bpmn-landscape/` holds process landscape maps: `.bfwmap` files in the landscape folder of a saved solution that place processes, groups and notes on a canvas and show how the processes relate. A map stores which processes it shows and where; relations between processes are derived from the solution scan and never stored. The process catalog is `scanSolutionBpmnModels` in `bpmn-core` ([modules.md](modules.md) §bpmn-core). The editor is a plain diagram-js `Diagram` with landscape-specific services, opened on the page Discover › Landscapes ([workbench-categories.md](workbench-categories.md)).

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

New ids come from `createElementId(type, isTaken)` in `LandscapeMapFile.ts`, in the pattern bpmn-js uses: the type in PascalCase, an underscore and seven random base-36 characters (`Process_0k3x9vb`, `Group_…`, `Band_…`, `Placeholder_…`, `MapLink_…`, `Note_…`, `Connector_…`). An id the diagram already uses is drawn again. The reader accepts any non-empty id, so older maps with UUIDs stay valid. The canvas element always has the id of its file element.

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

Validation also rejects: a missing or empty required attribute; a band inside a group or band; an id used twice across elements and connectors; a process id shown twice; a connector to a missing element, to a band or to its own source; a waypoint without numeric `x` and `y`; `fileHint` or `mapPath` that is absolute, a drive path or a URI.

`relativeFileHint(mapUri, fileUri)` builds `fileHint`: the path of `fileUri` relative to the map's folder, with `/` separators and `..` segments.

---

## Map Editor

### Registration

**Path:** `studio/src/modules/bpmn-landscape/index.tsx`, loaded after `bpmn-diff` in `createAndInitializeBifrost.ts`.

| Registration | Value |
|---|---|
| Page | `discover/landscapes` ("Landscapes", `paneAreas: ['left', 'right']`, editor tabs visible, `order: 0`) |
| Document type | `bpmn-landscape-map`: `uriMatch /\.bfwmap$/`, `page: 'discover/landscapes'`, model `LandscapeMapDocumentModel`, renderer `LandscapeMapRenderer`, `canOpen` = the landscape folder gate |
| Included files | `**/*.bfwmap` |
| Left pane group | `landscapes`: the Maps explorer (`discover/landscapes/maps`) above the Processes pane (`discover/landscapes/landscapes`) |
| Menu modifiers | `std/file-explorer/directory` and `std/file-explorer/project`: "New Landscape Map..." (`bpmn.landscape.newMap` with the row's URI), only on rows of the Maps explorer |
| Right pane | `discover/landscapes/properties` (Properties), prepended to the `property` group |
| Icons | `bpmn-landscape/page/landscapes`, `bpmn-landscape/document-type/map` |
| Help text | `discover/landscapes` (`texts/landscapes.md`) |

### Landscape Folder

**Path:** `studio/src/modules/bpmn-landscape/landscapeFolder.ts`

Maps resolve their processes against the whole solution, so they need a saved solution with a declared landscape folder: `views.landscapes` in the `.bfwsln` ([workspace.md](workspace.md) §`.bfwsln` Solution File Format). `getLandscapeGate(bifrost)` returns the first missing step:

| State | Condition | Hint (`panes/LandscapeFolderHint.tsx`) |
|---|---|---|
| `no-solution` | No solution open | "Landscape maps live in a solution." — Open Solution… |
| `unsaved` | Folder solution, or explicit solution without a `.bfwsln` | "Save it as a solution to use landscape maps." — Convert to Solution… (folder) or Save Solution As… |
| `no-folder` | Saved solution without `views.landscapes` | Set Up Landscape Folder, Choose Folder… |
| `ready`, folder missing on disk | `doesFileOrDirectoryExist` is false | "The landscape folder <path> does not exist." — Create Folder, Choose Another Folder… |
| `ready`, no maps | The Maps explorer has no files | "No landscape maps yet." — New Landscape Map |

The hint is the Maps explorer's `emptyState`; the Processes pane is hidden (`shouldBeDisplayed`) while the state is not `ready`. It re-checks the folder on `EVENT_EXPLORER_VIEW_UPDATED`. `describeLandscapeFolder` names the folder relative to the `.bfwsln` when below it, else by its local path.

`getMapOpenRefusal(bifrost, uri)` backs `canOpen`: a map opens only when the gate is `ready` and the map lies in the landscape folder (at any depth). Outside it, the refusal reads "Landscape maps open only from the landscape folder of the open solution (<path>). Move this map there or open its solution."

On every `solutionChanged` the module closes the open maps that `getMapOpenRefusal` would now refuse (closing or switching the solution, moving the landscape folder), asking about unsaved changes as usual. A map with unsaved changes whose prompt the user cancels stays open and is not asked about again until another solution (by `solutionFileUri ?? baseUri`) opens. Editor restore at startup does not check `canOpen`; without a stored solution no `solutionChanged` follows, so the same check runs once on the `ready` event.

### Maps Explorer

Registered with `bifrost.explorers.register` ([workspace.md](workspace.md) §Explorers): id `landscapes`, label "Maps", page `discover/landscapes`, source `{ kind: 'view', viewId: 'landscapes', includedFiles: ['**/*.bfwmap'] }`, empty directories hidden, no structural operations, header action New Landscape Map (`data-test--landscape-new-map`). Single maps can be renamed, duplicated and deleted here; folders are shaped in the Designer, where the landscape folder shows greyed and read-only.

Map rows can be dragged (`draggable` on `Tree`, see [tree.md](tree.md)) but not dropped on: the explorer is not structural, so dropping a row on another row does nothing, and the Designer's `std.fileExplorer.dropItems` refuses sources inside a view folder. The canvas of an open map accepts a row as a map link.

`mapsExplorerDecorations.ts` registers a `TreeDecorationProvider` scoped to the `landscapes` explorer (`registerDecorationProvider(provider, ['landscapes'])`). `refresh` runs on load and on every `solutionChanged`: it scans the maps and, when there are any, the BPMN catalog, and puts a yellow `number` badge on a map for each process it shows that is missing or ambiguous, or a red `!` badge on a map that cannot be read. The badge's `tooltip` names the count or the parse error. Only the newest of overlapping scans applies and `onDidChange` fires for the changed URIs only. Broken map links are not counted.

### Reference Resolution and Map Scan

**Path:** `studio/src/modules/bpmn-landscape/resolveProcessReference.ts`, `scanSolutionLandscapeMaps.ts`

`resolveProcessReference(catalog, mapUri, { processId, fileHint })` is the only place that decides which solution process a map shape stands for:

| Candidates with the id | Result |
|---|---|
| none | `missing` |
| exactly one | `resolved`, even when `fileHint` is stale after a rename or move |
| several, one at `relativeFileHint(mapUri, uri) === fileHint` | `resolved` with that file |
| several, no hint match | `ambiguous` with the candidates; the first file is never guessed |

`replaceCandidates(catalog, processIdsOnMap)` lists every catalog process whose id is not on the map, which is what Replace offers for a missing process. `resolveRelativeUri(mapUri, relativePath)` in `LandscapeMapFile.ts` is the inverse of `relativeFileHint` and names the target of a map link.

`scanSolutionLandscapeMaps(bifrost)` returns `LandscapeMapEntry { uri, name, error, processReferences }`, sorted by URI. It returns `[]` unless the gate is `ready` or when the folder does not exist yet. It lists the landscape folder with `files.traverseProject` on a project for that folder, with the Maps explorer's patterns (`**/*.bfwmap` included; `std.fileExplorer.exclude` and the solution's default excludes excluded), rather than `solution.listIncludedFileUris`, because the folder may lie outside every project. A map the explorer hides counts nowhere, even while the explorer shows hidden files greyed. An empty file reads as an empty map; a read or parse failure keeps the map in the list with `error` set and the file name as `name`. There is no cache (`ponytail:` note in the file).

### LandscapeMapDocumentModel

**Path:** `studio/src/modules/bpmn-landscape/LandscapeMapDocumentModel.ts`

| Concern | Behaviour |
|---|---|
| Create | `static create` reads an empty file as `createEmptyLandscapeMap(<basename>)`. The document opens clean; the first edit makes it dirty and saving writes the whole map. |
| Load | `create` and the watcher's reload await `parseLandscapeMap`; `applyParseResult(result)` shows the map and returns the parse errors. A modeler exists only after the first successful parse; metadata `readable` tells the renderer which view to show. |
| Save gate | `saveEditorDocument` returns `null` (default save) when a modeler exists; otherwise it shows a warning and returns `false`, so an unreadable file is never written. |
| Dirty tracking | `commandStack.changed` (not trigger `clear`) exports the canvas with `exportMap(previousMap)`, serializes it and calls `updateCurrentData`, then redraws the relation lines and bumps `selectionRevision`. A Studio-written file returns to clean after undo. |
| Undo / redo | `commandStack.undo()` / `redo()` |
| Watcher | DMN pattern. A readable external change reloads; text equal to the current data only clears the flags and keeps undo history and selection; an unreadable change while a modeler exists keeps the last good map and sets `errorOnReloadingFile`; `unlink` / `add` set `removedFromFileSystem`. |
| Metadata | `readable`, `viewbox`, `hasSelection`, `selectionRevision`, `focusMode`, the watcher flags. Nothing else is persisted. |
| Catalog | `scanSolutionBpmnModels` and `scanSolutionLandscapeMaps` together on create, focus and `solutionChanged`; only the newest of overlapping scans is applied (`latestCatalogScan`); afterwards `relations = buildProcessRelations(catalog)`, `elements.changed` redraws the process and map link shapes, the relation lines are redrawn and `notifyBrokenProcesses` runs. Until the first scan finished (`maps === null`) no reference counts as broken. |
| Process resolution | `resolveProcess(element)` delegates to `resolveProcessReference` and returns the process only for `resolved`; a missing or ambiguous reference gives no label, decision badge, relation line or details. `getProcessStatus(element)` returns the status for the renderer and the pane. |
| Process label | `getProcessLabel(element)`: the element label, else the resolved process name, else `processId`. |
| Relation lines | `showRelations()` after every import, command (including undo and redo) and catalog refresh: `buildRelationLines({ relations, placedProcesses, relationLayers, hiddenRelations })`, then `modeler.showRelationLines(lines)` and `updateFocus`. |
| Open in the Designer | `element.dblclick` on a process runs `std.editor.gotoSymbolInDocument(uri, processId)` for a resolved process, else an info notification that names the status (not found, or defined in several files). |
| Broken processes | `getBrokenProcessShapes` lists process shapes that are not `resolved` and not kept this session. `notifyBrokenProcesses` runs after each scan, only while this map is the focused document: it opens one warning ("N processes on this map are not found in the solution or defined in several files") with the action Review whenever a shape became broken that was not announced yet (`notifiedBrokenIds`; a shape that is repaired and breaks again is announced again), so the first scan of an open and later growth are covered and an unchanged set is not repeated. A new warning replaces the previous one (`brokenNotificationId`); the warning closes once no unkept broken shape is left (after a scan or a command-stack change) and when the map closes. Review runs `reviewBrokenProcesses`: select the first broken shape that is not kept and scroll to it. |
| Repairing a reference | `getReplacementOptions(element)` gives the status, the candidates (the files of an ambiguous id, or `replaceCandidates` for a missing one) and whether the shape is kept. `replaceSelectedProcess(candidate)` is one `updateSelectedElement({ processId, fileHint })`. `dropSelectedProcessReference()` replaces the shape through `modeler.replaceWithElement` by a placeholder with a new id, the same bounds, parent, style and shape, and the label `element.label ?? processId`; connectors are reconnected by `modeling.replaceShape` (the `connection.reconnect` rule allows connectors), relation lines are derived and are redrawn. `keepSelectedReference()` adds the shape to `keptElementIds` for the lifetime of the model; Review skips kept shapes. |
| Map links | `addMapLink({ mapUri, x, y })` adds a `mapLink` element (140×60, label = the target map's name, `mapPath = relativeFileHint(this.uri, mapUri)`) through `modeler.addElementShape`; a link to the map itself, or (once the map scan finished) to a map outside the landscape folder, is refused with an info notification. `getMapLinkStatus(element)` is `missing` when `resolveRelativeUri(this.uri, mapPath)` is not among the scanned maps. `element.dblclick` on a link runs `std.editor.focusOrOpenDocument` for the target, or an info notification when it is missing. `getOtherMaps()` feeds the "Target map" select; `retargetSelectedMapLink(mapUri)` sets `mapPath`, and the label as well while it still equals the old target's name or file name. |
| Export | `exportSvg()` returns `replaceThemeColorsInSvg(modeler.exportSvg())`, or `null` for an unreadable map. |

Public methods used by the renderer, pane and commands: `getRelativePath(fileUri)`, `getParseErrors`, `attachTo(element)` / `detach()` (append the canvas, `canvas.resized()`, restore the viewbox or `fit-viewport` on first attach), `toCanvasPoint(clientX, clientY)`, `getProcessIdsOnMap`, `addProcess({ processId, fileUri, x, y })` (selects the existing shape when the process is on the map), `addMapLink({ mapUri, x, y })`, `exportSvg`, `isDirectEditingActive`, `hasClipboardContent`, `deleteSelection`, `copySelection`, `paste`, `moveSelection(direction, accelerated)`, `toggleFocusMode`.

Properties pane methods: `getProcessLabel`, `getMapProperties` (`null` while unreadable), `getSelectedElements`, `getProcessDetails(element)` (relative file, the scan entry, and each relation of the process as `ProcessRelationEntry { relation, direction, otherProcessLabel, otherOnMap, hidden }`; `null` when unresolved), `getHiddenRelationCount` (hidden relations between placed processes), `updateSelectedElement(properties)` (one non-relation selection), `updateMap(properties)`, `setRelationLayer(kind, visible)`, `setRelationsHidden(keys, hidden)`, `showAllRelations`. Every change is one command, so it is undoable.

### LandscapeModeler

**Path:** `studio/src/modules/bpmn-landscape/modeler/LandscapeModeler.ts`

`new Diagram({ canvas: { container }, keyboard: { bind: false }, landscape: config })`. The diagram-js keyboard is unbound; Studio keybindings drive the editor actions.

- **diagram-js modules:** selection, move, resize, auto-resize, modeling, create, connect, bendpoints, lasso, hand tool, align, distribute, copy-paste, keyboard, keyboard-move-selection, editor-actions, grid-snapping, root-elements, overlays, context-pad, palette, zoomscroll, movecanvas, plus `diagram-js-grid`, `diagram-js-minimap` and `diagram-js-direct-editing`.
- **`importMap(map)`** clears the canvas, adds `mapToCanvasDescriptors(map)` shapes parent-first, bands and groups before their other siblings, and connectors as connections of type `connector` (laid out when they have fewer than two waypoints), sets the map properties on `landscapeUpdates`, then clears the command stack. **`exportMap(previousMap)`** walks the root depth-first, skips connections of type `relation`, and takes `name`, `relationLayers` and `hiddenRelations` from `landscapeUpdates`.
- **`showRelationLines(lines)`** delegates to `landscapeRelationLayer`. **`updateFocus(enabled)`** clears the `landscape-focused` markers; with focus on and a selection it puts the class `landscape-map--focus` on the container and marks the selected elements, their descendants, every connection touching them and the elements at the other end.
- **`addElementShape(element, center)`** creates the shape of any element inside the smallest group or band under the point, else on the root. **`replaceWithElement(shape, element)`** is `modeling.replaceShape` at the same centre: one undo step, connectors reconnected.
- **`exportSvg()`** returns a standalone SVG: the clone of the content layer (`canvas.getActiveLayer()`) without `.djs-hit`, `.djs-outline`, `.djs-selection-outline` and `.djs-resizer`, the `<defs>` of the canvas (arrow markers), and a `viewBox` from the bounds of all shapes, line bends and the measured boxes of the line labels (`.landscape-line-label`, empty boxes of a detached canvas skipped) plus 10 px (integer width and height, as `getSvgSize` expects). The grid and minimap are outside the content layer. The colours are still theme variables; the caller maps them with `replaceThemeColorsInSvg`. The bounds come from the registry and the line labels, not from `getBBox` of the layer, so selection outlines cannot widen the image.

Every shape's `businessObject` is the file element (`landscapeCanvasMapping.ts`); geometry comes from the shape, everything else from the business object.

| Service | Path | Role |
|---|---|---|
| `landscapeRenderer` | `modeler/LandscapeRenderer.ts` | Priority 1500. Rounded boxes for process and placeholder (placeholder dashed), boxes for group and band with the title at the top, a folded-corner note, a chevron path (with matching `getShapePath`) for `shape: 'chevron'`; a band uses the box as fallback. A `mapLink` is a rounded box with an inner border and a folded-map glyph in the top right corner. A process or map link that is not `resolved` (`config.getProcessStatus` / `getMapLinkStatus`) is drawn dashed at opacity 0.45 with the amber warning glyph `g.landscape-reference-warning` and a `<title>` naming the problem. Fill and stroke from `style`, else the theme variables `--color-bpmn-defaultFillColor/StrokeColor`. A process with decisions gets the badge `g.landscape-decision-badge` (top right, count, tooltip) from `config.getDecisionCount`. Lines: see the table below; arrow markers live in `<defs>` with ids unique per diagram. A relation line has a `<title>` tooltip and the label of its visible names, a connector its `label` at `connectorLabelPoint(waypoints)` (middle of the longest segment). |
| `landscapeRules` | `modeler/LandscapeRules.ts` | A process at most once (`shape.create`, `elements.create`); the root holds anything, a group or band holds anything except a band; groups alone may be created or moved with the cursor on an element that holds nothing, the element's parent is checked instead. `connection.create` / `connection.reconnect` between two different shapes that are not bands, returning `{ type: 'connector', id: createElementId('connector', …) }`. Relation lines: no solo move, no copy, no reconnect, no waypoint update (segment moves do not ask that rule, so `connectionSegment.move.init` returns `false` for them); `elements.delete` returns the selection without them. Processes are not copied. |
| `landscapeConnectors` | `modeler/LandscapeModeler.ts` | `connection.create` preExecute: a new connector gets the business object `{ id, sourceId, targetId, label: '', waypoints: [] }` |
| `landscapeRelationLayer` | `modeler/LandscapeRelationLayer.ts` | Shows the derived lines outside the command stack (see Relation Lines) |
| `landscapeUpdates` | `modeler/LandscapeUpdates.ts` | Command handlers `landscape.updateElement` (`{ element, properties }`, `Object.assign` on the business object, changed element redrawn) and `landscape.updateMap` (`{ properties }` on the held map properties); both keep the old values for undo. `getMapProperties()`, `setMapProperties()` (import only, not undoable). |
| `orderingProvider` | `modeler/LandscapeOrdering.ts` | `OrderingProvider` on `shape.create` / `shape.move`. A parent that holds nothing is replaced by its nearest group, band or the root. Index by level: bands and groups first, other shapes next, connections last, so a group is drawn behind the elements beside it. |
| `landscapeGroupMembership` | `modeler/LandscapeGroupMembership.ts` | `CommandInterceptor`, `postExecuted` of `shape.create` and `shape.resize` of a group and `elements.move` for every moved group, including auto-resize. A child the group no longer fully encloses moves to the smallest group or band outside the group that encloses it, else the root; then every non-band sibling the group fully encloses moves in. Moves use `moveElements` with delta 0 and `autoResize: false` inside the triggering command, so one undo reverts the whole action. |
| `layouter` | `modeler/LandscapeLayouter.ts` | `repairConnection` with `h:h`, cropped by `CroppingConnectionDocking` |
| `landscapeLabelEditing` | `modeler/LandscapeLabelEditing.ts` | Direct editing on double-click for group, band, placeholder, connector (`label`) and note (`text`); a connector edits in a 140×40 box at its label point. Commits through `landscape.updateElement`. Processes and map links are left out, because their double-click opens the Designer or the target map; their label is edited in the properties pane. |
| `landscapeCopyPaste` | `modeler/LandscapeModeler.ts` | Copies a structured clone of the business object; paste gives it a new id from `createElementId`. Copy-paste creates elements without an id, so a `shape.create` / `connection.create` preExecute sets the element id to its business object's id. The clipboard lives in the diagram instance, so it is per map. |
| `paletteProvider` | `modeler/LandscapePaletteProvider.ts` | Hand, lasso, group (400×240), placeholder (140×60), note (160×80) |
| `contextPadProvider` | `modeler/LandscapeContextPadProvider.ts` | A relation line: Hide (`landscape.updateMap` adds its visible keys to `hiddenRelations`). Other elements: Delete; shapes other than bands also Connect (`connect.start` on click and drag start). |

| Line | Width | Dash | Arrow |
|---|---|---|---|
| `callActivity` | 2 | none | filled |
| `message` | 1.5 | `8 4` | open |
| `signal` | 1.5 | `2 4` | open |
| connector | 1.5 | none | filled |

### Relation Lines

**Path:** `studio/src/modules/bpmn-landscape/buildRelationLines.ts`, `modeler/LandscapeRelationLayer.ts`

`buildRelationLines({ relations, placedProcesses, relationLayers, hiddenRelations })` keeps relations whose two processes are on the map (`PlacedProcess { elementId, reference }`) and whose layer is on, and groups them by kind and the two element ids into `RelationLine { id: 'relation:<kind>:<source element>:<target element>', kind, sourceElementId, targetElementId, relations, hiddenKeys }`. Relations are sorted by key; a line whose relations are all hidden is dropped; the lines are sorted by id. Both directions between one pair are two lines.

`LandscapeRelationLayer.show(lines)` reconciles the canvas with the lines, without commands:

1. A connection of type `relation` whose id is no longer wanted, or whose source or target is no longer registered, is removed with `canvas.removeConnection` and its `source` / `target` set to `null`. A kept one gets the new line as `businessObject`.
2. A missing line is added with `elementFactory.createConnection({ id, type: 'relation', source, target, businessObject: line })` and `canvas.addConnection(connection, root)`; it is attached to its shapes, so it follows a drag.
3. Every line is laid out again; lines between the same pair are spread 12 px apart. Then `elements.changed` fires.

Commands may still hold a relation connection (deleting a process takes its lines along, and undo restores the same object), so lines are kept by id rather than rebuilt. Relation connections are never saved.

### Renderer, Pane and Commands

- **`LandscapeMapRenderer.tsx`:** shows `EditorLoadingError` while the map is unreadable, otherwise the watcher title warnings, an `EditorToolbar` with the Focus button (`bpmn.landscape.toggleFocusMode`, active class from metadata `focusMode`, `data-test--landscape-focus-mode`) and the canvas host (`data-test--landscape-canvas`). The toolbar also has Export (`std.editor.showExportDialog.bpmn-landscape-map`, `data-test--landscape-export`). The host is a `useDropTarget` for `tree_item` subjects with `metadata.processId` (a drop calls `bpmn.landscape.addProcessToMap`) or a `.bfwmap` file row of the Maps explorer (`bpmn.landscape.addMapLinkToMap`), both with `toCanvasPoint(event)`. Styles: `styles/landscape.scss`; focus mode dims `.landscape-map--focus .djs-element:not(.landscape-focused) > .djs-visual`, so the children of a dimmed group keep their own look.
- **Properties pane (`panes/LandscapePropertiesPane.tsx`):** shown for a readable `bpmn-landscape-map`. It reads the model through its getters and re-renders on `selectionRevision`.

  | Selection | View |
  |---|---|
  | None | Map name, a switch per relation layer, "Show N hidden relations" |
  | Process | Label (empty shows the process name), shape Box / Chevron, colour (`BpmnElementColorPicker` mapped to `style { fill, stroke }`), file, process id, version, executable flag, relations by kind with direction and the other process (a Show switch when the other process is on the map), decisions with Open (`bpmn.businessRuleTask.openTargetDecision`); an unresolved process gets the next row instead |
  | Placeholder | Label, shape, colour |
  | Process that is missing or ambiguous (`data-test--landscape-broken-process=<status>`) | The status sentence; Replace with (the candidate files for an ambiguous id, labelled File; the processes not yet on the map for a missing one, or a disabled hint when there are none); Drop reference and Keep (`data-test--landscape-drop-reference`, `data-test--landscape-keep-reference`) |
  | Map link | Target (the relative path, read only), a message when the target is missing (`data-test--landscape-broken-map-link`), Target map select (`htmlId landscape-map-link-target`, `retargetSelectedMapLink`; keyed on `mapPath`, so it follows undo), label, colour |
  | Group, band, note | Label (note: text), colour |
  | Relation line | Kind, from, to, a switch per relation, Hide |
  | Connector | Label |
  | Several | "N elements selected" |

- **Processes pane (`panes/ProcessesPane.tsx`):** one collapsed row per BPMN file (sorted by name, `!` badge for an invalid file), process rows with `metadata.processId` and `fileUri`, a map-pin badge when the process is on the focused map, and a number badge and an "on N maps" tooltip with the count of saved maps whose reference resolves to that file and process (`scanSolutionLandscapeMaps` plus `resolveProcessReference`). The rows are `draggable` (source only). The filter matches file name, process name and id and expands matching files. The pane is shown only while the landscape gate is `ready`; it carries `app-layout__solution-pane`, so it takes the remaining height and scrolls itself, while `landscape.scss` keeps the Maps pane above it from shrinking (at most 40% of the column). The pane scans on mount and on every `solutionChanged` (the solution object stays the same when files change); only the newest scan is shown. Rows carry no `uri`, so nothing can be dropped inside the tree.

| Command | Behaviour |
|---|---|
| `bpmn.landscape.newMap(directoryUri?)` | With the gate closed, activates the Landscapes page and shows an info notice instead. Otherwise creates the landscape folder if missing, asks for a path with the native save dialog (starting in `directoryUri` when it lies in the landscape folder, else in the folder itself; the dialog can create subfolders), appends `.bfwmap` when missing (and stops with a warning when that file exists, because the dialog only checked the name without the extension), writes an empty map via `editors.createNewEditorDocument` and calls `solution.onElementAdded`. A path outside the landscape folder is refused with a warning. |
| `bpmn.landscape.setUpLandscapeFolder` | In the command search. Creates the declared landscape folder, or `landscapes/` next to the `.bfwsln` when none is declared, and writes it with `solution.setViewFolder('landscapes', …)`. Also the "Create Folder" action for a missing folder. Enabled with a saved solution |
| `bpmn.landscape.chooseLandscapeFolder` | In the command search. Native directory dialog, then `setViewFolder`. A folder at or above a root folder of the solution is refused with a warning, since it would turn that root read-only in the Designer. Maps in the previous folder stay where they are. Enabled with a saved solution |
| `bpmn.landscape.addMapLinkToMap` | `{ mapUri, x, y }` in canvas coordinates, on the focused map |
| `std.editor.showExportDialog.bpmn-landscape-map`, `std.editor.exportDocumentAs.bpmn-landscape-map` | `exportCommands.ts`. The dialog asks for a path (default `<map>.png` next to the map; filters from `IMAGE_SAVE_DIALOG_FILTERS`), checks the extension with `getImageFormatForFilename` and calls `std.editor.exportDocumentAs`. The export reads `model.exportSvg()` (a warning notification when null); svg is saved as is, png, jpeg and webp go through `renderSvgToRasterImage` inside `runWithExportHint`, then `files.save`; a failed write gives an error notification. The dialog command is enabled only while the focused map is readable. |
| `bpmn.landscape.addProcessToMap` | `{ processId, fileUri, x, y }` in canvas coordinates, on the focused map |
| `bpmn.landscape.deleteSelection`, `copySelection`, `paste` | Editor actions on the focused map; enabled with a selection (paste: the clipboard tree has elements; copying only processes or relation lines stores an empty tree) |
| `bpmn.landscape.moveSelection{Left,Right,Up,Down}[Accelerated]` | `keyboardMoveSelection.moveSelection` |
| `bpmn.landscape.toggleFocusMode` | In the command search ("Landscapes: Toggle Focus Mode"); enabled for a focused readable map |

The selection commands do nothing while direct editing is active, so the keys reach the text box. Keybindings are scoped to `.kbm-editor[data-editor-document-type=bpmn-landscape-map]`: Backspace (macOS) / Delete, Cmd/Ctrl+C, Cmd/Ctrl+V, F (focus mode), the arrow keys and Shift+arrow keys. `KeybindingsManager` ignores single-character keys in inputs, so F still types in the properties pane. Undo, redo and save use the global `std.editor.*` bindings.

---

## File Path Reference

| Component | Path |
|---|---|
| Module entry, commands | `studio/src/modules/bpmn-landscape/index.tsx`, `commands.ts` |
| Document model, renderer | `studio/src/modules/bpmn-landscape/LandscapeMapDocumentModel.ts`, `LandscapeMapRenderer.tsx` |
| Modeler and services | `studio/src/modules/bpmn-landscape/modeler/` |
| Landscape folder gate, hint | `studio/src/modules/bpmn-landscape/landscapeFolder.ts`, `panes/LandscapeFolderHint.tsx` |
| Processes pane, properties pane | `studio/src/modules/bpmn-landscape/panes/ProcessesPane.tsx`, `LandscapePropertiesPane.tsx` |
| Relation lines | `studio/src/modules/bpmn-landscape/buildRelationLines.ts`, `modeler/LandscapeRelationLayer.ts` |
| Reference resolution, map scan | `studio/src/modules/bpmn-landscape/resolveProcessReference.ts`, `scanSolutionLandscapeMaps.ts` |
| Maps explorer badges, export | `studio/src/modules/bpmn-landscape/mapsExplorerDecorations.ts`, `exportCommands.ts` |
| Styles, help text | `studio/src/modules/bpmn-landscape/styles/landscape.scss`, `texts/landscapes.md` |
| Relation derivation | `studio/src/modules/bpmn-landscape/buildProcessRelations.ts` |
| Map file format | `studio/src/modules/bpmn-landscape/LandscapeMapFile.ts` |
| Solution scan | `studio/src/modules/bpmn-core/scanSolutionBpmnModels.ts` |
| Scan parsing (worker side) | `studio/src/modules/bpmn-core/parseSolutionBpmnModel.ts`, `bpmn-model-scan-worker.ts` |
| Unit tests | `studio/test/unit/bpmn-landscape/`, `studio/test/unit/bpmn-core/scanSolutionBpmnModels.test.ts` |
| Integration tests | `studio/test/integration/bpmn-landscape/` (`npm run test:integration:bpmn-landscape`) |
