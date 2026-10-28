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
  <landscape:relationLayers signal="false" />
  <landscape:level id="level-domain" name="Domain" />
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
| foreign attributes and elements | Kept in `LandscapeMap.extensions` (`attributes`, `elements`) and written back on the root; elements follow the known children. Foreign attributes of a level, map element or connector are kept in its `extensionAttributes` (absent when there are none) and written back on it. |

Every element has `id`, `x`, `y`, `width` and `height` (both greater than 0), and optional `fill` and `stroke` (read as `style { fill, stroke }`, `null` when neither is set). A colour is a hex value, a colour name or an `rgb()` / `hsl()` function; anything else is rejected, because the renderer writes it into a `style` attribute. Containment is XML nesting: `parentId` is the enclosing band or group, `null` at the top level. When writing, an element whose `parentId` is not a band or group on the map goes to the top level.

New ids come from `createElementId(type, isTaken)` in `LandscapeMapFile.ts`, in the pattern bpmn-js uses: the type in PascalCase, an underscore and seven random base-36 characters (`Process_0k3x9vb`, `Group_…`, `Band_…`, `Placeholder_…`, `MapLink_…`, `Note_…`, `Connector_…`, `Level_…`). An id the diagram already uses is drawn again. The reader accepts any non-empty id, so older maps with UUIDs stay valid. The canvas element always has the id of its file element.

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

Validation also rejects: a missing or empty required attribute; a band inside a group or band; an id used twice across elements and connectors; a process id shown twice; a connector to a missing element, to a band or to its own source; an id that contains `:` (the canvas names planes `plane:…` and relation lines `relation:…`); a waypoint without numeric `x` and `y`; `fileHint` or `mapPath` that is absolute, a drive path or a URI.

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
| Menus | `bpmn-landscape/processes/process` ("Create Map from Process..."), `…/file` ("Create Map from File..."), `…/multi-selection` ("Create Map from Selection..."), the context menus of the Processes pane rows; each runs `bpmn.landscape.createMapFromProcesses` |
| Shared resource | `bpmn-landscape/solution-scan`: the `LandscapeSolutionScan` instance, created in `onLoad` |
| Plugin API | `bifrost.plugins.registerApiNamespace` registers `LandscapeApiBridge` (namespace `landscape`) as the first call of `onLoad` |
| Search | `LandscapeSearchIndexerClient` (`bifrost.searchIndex.registerSearchIndexerWorkerClient`) indexes every element: label (a note's first line), id, and the process id or map path; entries with an empty label are filtered. A result opens the map and `revealElement(elementId)` opens the collapsed groups on the way and selects it. |
| Setting | `bpmn.landscape.showGrid` (project scope, boolean, default `true`) |
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

`mapsExplorerDecorations.ts` registers a `TreeDecorationProvider` scoped to the `landscapes` explorer (`registerDecorationProvider(provider, ['landscapes'])`). `apply(snapshot)` runs whenever the shared scan publishes ([§Shared Solution Scan](#shared-solution-scan)): it puts a yellow `number` badge on a map for each process it shows that is missing or ambiguous, or a red `!` badge on a map that cannot be read. The badge's `tooltip` names the count or the parse error. `onDidChange` fires for the changed URIs only. Broken map links are not counted.

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

`scanSolutionLandscapeMaps(bifrost)` returns `LandscapeMapEntry { uri, name, error, processReferences }`, sorted by URI. It returns `[]` unless the gate is `ready` or when the folder does not exist yet. It lists the landscape folder with `files.traverseProject` on a project for that folder, with the Maps explorer's patterns (`**/*.bfwmap` included; `std.fileExplorer.exclude` and the solution's default excludes excluded), rather than `solution.listIncludedFileUris`, because the folder may lie outside every project. A map the explorer hides counts nowhere, even while the explorer shows hidden files greyed. An empty file reads as an empty map; a read or parse failure keeps the map in the list with `error` set and the file name as `name`. There is no cache; consumers read the result through `LandscapeSolutionScan` instead of calling the function.

### Shared Solution Scan

**Path:** `studio/src/modules/bpmn-landscape/LandscapeSolutionScan.ts`

One instance per window (`new LandscapeSolutionScan(bifrost)`, registered as the shared resource `bpmn-landscape/solution-scan` in `onLoad`) scans the BPMN catalog (`scanSolutionBpmnModels`) and the landscape maps (`scanSolutionLandscapeMaps`) in parallel, once at `start()` and once per `solutionChanged`. It publishes a `LandscapeSolutionSnapshot { catalog, maps, relations }` with `relations = buildProcessRelations(catalog)` computed once. `getSnapshot()` is `null` until the first scan finished; `onDidChange(listener)` returns a `{ dispose }`; `refresh()` scans on demand. Only the newest of overlapping scans publishes, a scan whose snapshot equals the previous one (compared as JSON) does not publish, and a failed scan keeps the previous snapshot (`console.warn`). A `ponytail:` note in the file names the ceiling: every change parses all maps on the main thread.

| Consumer | Reads the snapshot |
|---|---|
| `MapsDecorationProvider` | `apply(snapshot)` from the listener registered in `index.tsx` |
| Processes pane | `useSyncExternalStore` over `onDidChange` / `getSnapshot` |
| `LandscapeMapDocumentModel` | `applySnapshot` on creation and on every change; it keeps its own `catalog`, `maps` and `relations` copies. Focus does not rescan; `onEditorDocumentDidFocus` only runs `notifyBrokenProcesses`, so the Review warning appears when the map becomes the focused document. |
| `bpmn.landscape.createMapFromProcesses` | `getSnapshot()`, after `refresh()` when there is none yet |

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
| Catalog | `applySnapshot(snapshot)` takes `catalog`, `maps` and `relations` from the shared scan on create and on every change (not without a solution); `elements.changed` redraws the process and map link shapes, the relation lines are redrawn and `notifyBrokenProcesses` runs. Until the first snapshot arrived (`maps === null`) no reference counts as broken. |
| Process resolution | `resolveProcess(element)` delegates to `resolveProcessReference` and returns the process only for `resolved`; a missing or ambiguous reference gives no label, decision badge, relation line or details. `getProcessStatus(element)` returns the status for the renderer and the pane. |
| Process label | `getProcessLabel(element)`: the element label, else the resolved process name, else `processId`. |
| Relation lines | `showRelations()` after every import, command (including undo and redo) and catalog refresh: `buildRelationLines({ relations, placedProcesses, relationLayers, hiddenRelations })`, then `modeler.showRelationLines(lines)` and `updateFocus`. |
| Open in the Designer | `element.dblclick` on a process runs `std.editor.gotoSymbolInDocument(uri, processId)` for a resolved process, else an info notification that names the status (not found, or defined in several files). |
| Broken processes | `getBrokenProcessShapes` lists process shapes that are not `resolved` and not kept this session. `notifyBrokenProcesses` runs after each scan, only while this map is the focused document: it opens one warning ("N processes on this map are not found in the solution or defined in several files") with the action Review whenever a shape became broken that was not announced yet (`notifiedBrokenIds`; a shape that is repaired and breaks again is announced again), so the first scan of an open and later growth are covered and an unchanged set is not repeated. A new warning replaces the previous one (`brokenNotificationId`); the warning closes once no unkept broken shape is left (after a scan or a command-stack change) and when the map closes. Review runs `reviewBrokenProcesses`: select the first broken shape that is not kept and scroll to it. |
| Repairing a reference | `getReplacementOptions(element)` gives the status, the candidates (the files of an ambiguous id, or `replaceCandidates` for a missing one) and whether the shape is kept. `replaceSelectedProcess(candidate)` is one `updateSelectedElement({ processId, fileHint })`. `dropSelectedProcessReference()` replaces the shape through `modeler.replaceWithElement` by a placeholder with a new id, the same bounds, parent, style and shape, and the label `element.label ?? processId`; connectors are reconnected by `modeling.replaceShape` (the `connection.reconnect` rule allows connectors), relation lines are derived and are redrawn. `keepSelectedReference()` adds the shape to `keptElementIds` for the lifetime of the model; Review skips kept shapes. |
| Filling a placeholder | `getPlaceholder(id)`, `getFreeProcessCandidates()` (catalog processes not on the map) and `replacePlaceholderWithProcess(placeholderId, { processId, fileUri })`, which returns `false` for a vanished placeholder or a process already on the map. The replacement is `convertPlaceholderToProcess` (`modeler/LandscapeReplace.ts`: same parent, bounds, style and shape, label `null`) through `modeler.replaceWithElement`, so it is one undo step and connectors are reconnected. `addProcess` fills the placeholder under the drop point (`modeler.findPlaceholderShapeAt`, the smallest on the current plane) instead of adding a second shape, after its existing-process check. Workflows: [§Filling a Placeholder](#filling-a-placeholder). |
| Duplicate connectors | `updateConnectorDuplicates(modeler, lines)` runs inside `showRelations`: `findDuplicateConnectors(connectors, lines)` matches each connector's ends (mapped to their representatives on the current plane, so collapsed groups count) pair-wise and without direction against the visible relation lines, and `elements.changed` redraws the connectors whose result changed. `getConnectorDuplicateWarning(connectorId)` gives the sentence for the renderer glyph and the pane, or `null`. A hidden relation, a switched-off layer and a line without a visible process give no warning. Nothing is edited. |
| Map links | `addMapLink({ mapUri, x, y })` adds a `mapLink` element (140×60, label = the target map's name, `mapPath = relativeFileHint(this.uri, mapUri)`) through `modeler.addElementShape`; a link to the map itself, or (once the map scan finished) to a map outside the landscape folder, is refused with an info notification. `getMapLinkStatus(element)` is `missing` when `resolveRelativeUri(this.uri, mapPath)` is not among the scanned maps. `element.dblclick` on a link runs `std.editor.focusOrOpenDocument` for the target, or an info notification when it is missing. `getOtherMaps()` feeds the "Target map" select; `retargetSelectedMapLink(mapUri)` sets `mapPath`, and the label as well while it still equals the old target's name or file name. |
| Export | `exportSvg()` returns `replaceThemeColorsInSvg(modeler.exportSvg())`, or `null` for an unreadable map. |

Public methods used by the renderer, pane and commands: `getRelativePath(fileUri)`, `getParseErrors`, `attachTo(element)` / `detach()` (append the canvas, `canvas.resized()`, restore the viewbox or `fit-viewport` on first attach), `toCanvasPoint(clientX, clientY)`, `getProcessIdsOnMap`, `addProcess({ processId, fileUri, x, y })` (selects the existing shape when the process is on the map), `addMapLink({ mapUri, x, y })`, `exportSvg`, `isDirectEditingActive`, `hasClipboardContent`, `deleteSelection`, `copySelection`, `paste`, `moveSelection(direction, accelerated)`, `toggleFocusMode`.

Properties pane methods: `getProcessLabel`, `getMapProperties` (`null` while unreadable), `getSelectedElements`, `getProcessDetails(element)` (relative file, the scan entry, and each relation of the process as `ProcessRelationEntry { relation, direction, otherProcessLabel, otherOnMap, hidden }`; `null` when unresolved), `getHiddenRelationCount` (hidden relations between placed processes), `updateSelectedElement(properties)` (one non-relation selection), `updateMap(properties)` (both skip a change that sets only the current values, so it adds no undo step), `setRelationLayer(kind, visible)`, `setRelationsHidden(keys, hidden)`, `showAllRelations`. Every change is one command, so it is undoable.

### LandscapeModeler

**Path:** `studio/src/modules/bpmn-landscape/modeler/LandscapeModeler.ts`

`new Diagram({ canvas: { container }, keyboard: { bind: false }, landscape: config })`. The diagram-js keyboard is unbound; Studio keybindings drive the editor actions.

- **Module order:** diagram-js modules (selection, move, resize, auto-resize, modeling, create, connect, connection-preview, bendpoints, lasso, hand tool, align, distribute, copy-paste, keyboard, keyboard-move-selection, editor-actions, snapping, grid-snapping, space-tool, global-connect, root-elements, overlays, context-pad, palette, popup-menu, zoomscroll, movecanvas, `diagram-js-grid`, `diagram-js-minimap`, `diagram-js-direct-editing`, auto-scroll, keep-selection-visible), then the built-in feature modules of `modeler/features/` (table below), then `LANDSCAPE_MODULE`, then `additionalModules`. The model passes `landscapeModelerModuleRegistry.getAll()` as `additionalModules`, so plugins come last and can override a service (see [plugin-landscape-enrichment.md](plugin-landscape-enrichment.md) and the command `bpmn.landscape.modeler.registerModule`).
- **Icons:** context pad and palette use bpmn-font classes where bpmn-js has the same action (`bpmn-icon-trash`, `bpmn-icon-screw-wrench`, `bpmn-icon-connection-multi`, `bpmn-icon-subprocess-collapsed` / `-expanded`, `bpmn-icon-hand-tool`, `bpmn-icon-lasso-tool`, `bpmn-icon-space-tool`, `bpmn-icon-connection`); `LandscapeMapRenderer.tsx` imports `bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css`. Landscape-only actions (create band, group, placeholder, note; append; hide; open; placeholder actions) use Phosphor.
- **`importMap(map)`** clears the canvas, adds `mapToCanvasDescriptors(map)` shapes parent-first, bands and groups before their other siblings, and connectors as connections of type `connector` (laid out when they have fewer than two waypoints), sets the map properties on `landscapeUpdates`, then clears the command stack. **`exportMap(previousMap)`** walks the root depth-first, skips connections of type `relation`, and takes `name`, `relationLayers` and `hiddenRelations` from `landscapeUpdates`.
- **`showRelationLines(lines)`** delegates to `landscapeRelationLayer`. **`updateFocus(enabled)`** clears the `landscape-focused` markers; with focus on and a selection it puts the class `landscape-map--focus` on the container and marks the selected elements, their descendants, every connection touching them and the elements at the other end.
- **`addElementShape(element, center)`** creates the shape of any element inside the smallest open group or band on the root on screen under the point, else on that root. **`replaceWithElement(shape, element)`** is `modeling.replaceShape` at the same centre: one undo step, connectors reconnected.
- **`exportSvg()`** returns a standalone SVG of the root on screen: the clone of the content layer (`canvas.getActiveLayer()`) without `.djs-hit`, `.djs-outline`, `.djs-selection-outline` and `.djs-resizer`, the `<defs>` of the canvas (arrow markers), and a `viewBox` from the bounds of all shapes, line bends and the measured boxes of the line labels (`.landscape-line-label`, `getBBox` shifted by the label's own `translate`, empty boxes of a detached canvas skipped) plus 10 px (integer width and height, as `getSvgSize` expects). The grid and minimap are outside the content layer. The colours are still theme variables; the caller maps them with `replaceThemeColorsInSvg`. The bounds come from the registry and the line labels, not from `getBBox` of the layer, so selection outlines cannot widen the image.

Every shape's `businessObject` is the file element (`landscapeCanvasMapping.ts`); geometry comes from the shape, everything else from the business object.

| Service | Path | Role |
|---|---|---|
| `landscapeRenderer` | `modeler/LandscapeRenderer.ts` | Priority 1500. Rounded boxes for process and placeholder (placeholder dashed), a box with the title at the top for a group, a box for a band with a left strip (`BAND_HEADER_WIDTH`) holding its label turned upwards, a folded-corner note, a chevron path (with matching `getShapePath`) for `shape: 'chevron'`. A collapsed group gets an inner border and a plus glyph in the top right corner, with its label centred. Group and band fills are at opacity 0.6. A `mapLink` is a rounded box with an inner border and a folded-map glyph in the top right corner. A process or map link that is not `resolved` (`config.getProcessStatus` / `getMapLinkStatus`) is drawn dashed at opacity 0.45 with the amber warning glyph `g.landscape-reference-warning` and a `<title>` naming the problem. A connector for which `config.getConnectorWarning(connector)` returns text carries the same glyph next to its label point, with the text as `<title>`. Fill and stroke from `style`, else the theme variables `--color-bpmn-defaultFillColor/StrokeColor`. A process with decisions gets the badge `g.landscape-decision-badge` (top right, count, tooltip) from `config.getDecisionCount`. Lines: see the table below; arrow markers live in `<defs>` with ids unique per diagram. A relation line has a `<title>` tooltip and the label of its visible names, a connector its `label` at `connectorLabelPoint(waypoints)` (middle of the longest segment); a line label has a 4 px halo in the default fill colour. Every style is inline, not in `landscape.scss`, so an exported image looks like the canvas. `canRender` also accepts a `connector` without business object: the line the connection preview draws while a connector is dragged. |
| `landscapeRules` | `modeler/LandscapeRules.ts` | A process at most once (`shape.create`, `elements.create`); the main root holds anything, a plane and a group or band hold anything except a band, a collapsed group holds nothing; no resize, auto-resize or copy of a collapsed group; groups alone may be created or moved with the cursor on an element that holds nothing (a collapsed group included), the element's parent is checked instead. `connection.create` / `connection.reconnect` between two different shapes that are not bands, returning `{ type: 'connector', id: createElementId('connector', …) }`. Relation lines: no solo move, no copy, no reconnect, no waypoint update (segment moves do not ask that rule, so `connectionSegment.move.init` returns `false` for them); `elements.delete` returns the selection without them and without hidden connectors. Processes and hidden connectors are not copied. |
| `landscapeConnectors` | `modeler/LandscapeModeler.ts` | `connection.create` preExecute: a new connector gets the business object `{ id, sourceId, targetId, label: '', waypoints: [] }` |
| `landscapeRelationLayer` | `modeler/LandscapeRelationLayer.ts` | Shows the derived lines outside the command stack (see Relation Lines) |
| `snapping` | `modeler/LandscapeSnapping.ts` | `CreateMoveSnapping` that leaves relation lines out of the snap targets, so a shape never snaps to the bend of a derived line. |
| `spaceTool`, `globalConnect` | diagram-js | Palette entries `space-tool` (make or remove space) and `global-connect-tool` (click two shapes to draw a connector). The rule `connection.start` allows a start at every element that can be a connector end (no band, no line). |
| `landscapeReplaceMenu` | `modeler/LandscapeReplaceMenuProvider.ts` | The "Change element" popup (`popupMenu` provider `landscape-replace`, title "Change element", search, width 300): group Type — a process becomes a placeholder or a note, a placeholder a note, a note a placeholder; group Shape — a process or placeholder gets the other shape (box or chevron) through `landscape.updateElement`. Every entry has a description and a Phosphor icon in `imageHtml` (`popupEntry`). `convertLandscapeElement` (`modeler/LandscapeReplace.ts`) builds the new element with the same place, size, group and colours and the name carried over; picking a type is one `modeling.replaceShape` (one undo step, connectors reconnected, the new shape selected). `popupPositionOf(element, contextPad, elementRegistry, cursor?)` opens it below the element's context pad (else below the element) in viewport coordinates; the placeholder menu reuses both helpers. Opened from the context pad (`replace`) or by `bpmn.landscape.changeElementType`. |
| `landscapePluginPalette`, `landscapePluginContextPad` | `modeler/LandscapePluginEntries.ts` | Priority 600 providers that append the entries plugins contribute (manifest and runtime) to the palette (group `z-plugins`) and the context pad, under the ids `plugin.<plugin>.<entry>`. See [plugin-landscape-enrichment.md](plugin-landscape-enrichment.md). |
| `landscapeUpdates` | `modeler/LandscapeUpdates.ts` | Command handlers `landscape.updateElement` (`{ element, properties }`, `Object.assign` on the business object, changed element redrawn) and `landscape.updateMap` (`{ properties }` on the held map properties); both keep the old values for undo. `getMapProperties()`, `setMapProperties()` (import only, not undoable). |
| `orderingProvider` | `modeler/LandscapeOrdering.ts` | `OrderingProvider` on `shape.create` / `shape.move`. A parent that holds nothing (a collapsed group included) is replaced by its nearest open group, band or root. Index by level: bands and groups first, other shapes next, connections last, so a group is drawn behind the elements beside it. |
| `landscapeGroupMembership` | `modeler/LandscapeGroupMembership.ts` | `CommandInterceptor`, `postExecuted` of `shape.create` and `shape.resize` of a group or band (a collapsed group holds nothing by enclosure; enclosure counts only on the shape's own root) and `elements.move` for every moved group or band, including auto-resize. A child the group no longer fully encloses moves to the smallest group or band outside the group that encloses it, else the root; then every non-band sibling the group fully encloses moves in. Moves use `moveElements` with delta 0 and `autoResize: false` inside the triggering command, so one undo reverts the whole action. |
| `layouter` | `modeler/LandscapeLayouter.ts` | `repairConnection` with `h:h`, cropped by `CroppingConnectionDocking` |
| `landscapeLabelEditing` | `modeler/LandscapeLabelEditing.ts` | Direct editing on double-click for an open group, band, placeholder, connector (`label`) and note (`text`); a connector edits in a 140×40 box at its label point; a band edits in a box laid flat (band height × `BAND_HEADER_WIDTH`) and turned with `rotate(-90deg)` over its left strip; a group edits in its top 30 px. Commits through `landscape.updateElement`. Processes and map links are left out, because their double-click opens the Designer or the target map; their label is edited in the properties pane. |
| `landscapeCopyPaste` | `modeler/LandscapeModeler.ts` | Copies a structured clone of the business object; paste gives it a new id from `createElementId`. Copy-paste creates elements without an id, so a `shape.create` / `connection.create` preExecute sets the element id to its business object's id. The clipboard lives in the diagram instance, so it is per map. |
| `paletteProvider` | `modeler/LandscapePaletteProvider.ts` | Hand, lasso, band (1200×240), group (400×240), placeholder (140×60), note (160×80). The band entry is left out while a plane is on screen; the palette is rebuilt (`palette._rebuild()`, which diagram-js also runs on provider registration) on every `root.set`. |
| `contextPadProvider` | `modeler/LandscapeContextPadProvider.ts` | A relation line: Hide (`landscape.updateMap` adds its visible keys to `hiddenRelations`). Other elements: Delete; process, placeholder and note also Change element; shapes other than bands also Connect (`connect.start` on click and drag start). A group also Collapse or Expand (`toggleCollapse`), a collapsed group Open. A multi-selection gets Delete (`getMultiElementContextPadEntries`), filtered through the `elements.delete` rule like the Delete key. |
| `landscapeCollapse` | `modeler/LandscapeCollapse.ts` | Planes and crossing connectors, see Hierarchy |
| `landscapeDrilldown` | `modeler/LandscapeDrilldown.ts` | Opening a plane, breadcrumbs, viewbox per plane, see Hierarchy |

**Feature modules (`modeler/features/`).** Each file default-exports one didi module. They hold editor features that bpmn-js ships for BPMN and that the landscape needs in its own form.

| Module file | Services | Role |
|---|---|---|
| `LandscapeTextRenderer.ts` | `landscapeTextRenderer` | One diagram-js `Text` (Arial 12 px, line height 1.2) for every label of `landscapeRenderer`, and `getEditingStyle(zoom)` for `landscapeLabelEditing` (font, size times zoom, centred). Colours go in through `options.style` (see [common-pitfalls.md](common-pitfalls.md)). Label editing uses `autoResize` for connectors and the default box. |
| `LandscapeOutline.ts` | `landscapeOutline` | `outline.registerProvider`: one `path` per shape, 5 px outside the border: rounded (radius 15) for process, placeholder and map link, radius 9 for group and band, the chevron or folded-note path for chevrons and notes. `updateOutline` recomputes `d`, so a box/chevron change keeps the outline in shape. Lines keep the default outline. |
| `LandscapeAlignDistribute.ts` | `landscapeDistributeRules`, `distributeElementsMenuProvider` | Depends on bpmn-js `align-elements` (multi-selection pad entry `align-elements` and its popup, generic rule) and adds bpmn-js's `DistributeElementsMenuProvider` with an own `elements.distribute` rule (no lines, no children of selected elements, at least 3 shapes), because `BpmnDistributeElements` checks BPMN types. |
| `LandscapePlaceholderMenu.ts` | `landscapePlaceholderMenu` | Context pad entry `placeholder-actions` (`ph ph-link`, "Model or link a process") on placeholders, opening the popup `landscape-placeholder` (title "Placeholder"): Model this process… and Link to existing process… (disabled with the description "Every process of the solution is already on this map" while `config.hasFreeProcesses()` is false). Both call `config.runPlaceholderAction('model' \| 'link', id)`, which runs `bpmn.landscape.modelPlaceholder` / `linkPlaceholder`. |
| `LandscapeAppend.ts` | `landscapeAppend` (+ diagram-js `autoPlace`) | Context pad entries `append.placeholder` and `append.note` on process, placeholder, map link and note. Click: `autoPlace.append(source, shape, { connection: { type: 'connector', id } })`; drag: `create.start(event, shape, { source })`, whose connector type comes from the `connection.create` rule. One undo step each. |
| `LandscapeModelingFeedback.ts` | `landscapeModelingFeedback` (+ diagram-js `tooltips`) | On `shape.move.rejected` and `create.rejected`, an error tooltip at the mouse for 2 s when the reason is known: a band off the main root, or a drop on a collapsed group. |
| `LandscapeColorPad.ts` | `colorContextPadProvider` | Subclass of bpmn-core's `ColorContextPadProvider` (entry `custom-color-picker`, same panel and colours as the BPMN editor; the panel goes into the `.editor__content` around the canvas and closes on `selection.changed` and `canvas.viewbox.changing`). Shapes only; `applyColor` writes `style` (`null` for No Color) through `landscape.updateElement`. The model calls `setSettings(studio.settings, () => uri)` for the custom colours. |
| `LandscapeSearch.ts` | `landscapeSearch` (+ diagram-js `searchPad`, `search`) | Search pad provider over label (process: `config.getProcessLabel`, note: text), id and process id of the shapes and visible connectors of the plane on screen (`canvas.findRoot`). Other planes are left out: a root switch re-lays the relation lines, whose `elements.changed` closes the search pad. Opened by `bpmn.landscape.find` (`model.toggleSearch()`). |

`LandscapeRendererConfig` (`modeler/LandscapeRenderer.ts`) is the bridge from the modeler to the model; besides the label and status callbacks it carries `executePluginCommand`, `runPlaceholderAction` and `hasFreeProcesses`.

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

1. A connection of type `relation` whose id is no longer wanted, whose line ends are no longer registered, or whose parent is not the root on screen (undoing a collapse removes the plane it was drawn on) is removed with `canvas.removeConnection`. A kept one gets the new line as `businessObject` and its ends refreshed.
2. A missing line is added with `elementFactory.createConnection({ id, type: 'relation', businessObject: line })` and `canvas.addConnection(connection, root)`.
3. Every line is laid out again; lines between the same pair are spread 12 px apart. Then `elements.changed` fires.

A relation line is **unbound**: it has no `source` and `target`, so it is never in the `incoming` / `outgoing` lists that diagram-js follows when a shape moves or is deleted, and no command ever holds it. The shapes it joins are `connection.relationSource` and `connection.relationTarget`; `updateFocus`, `LandscapeRenderer` and the properties pane read those. A line follows its shapes because the model lays all lines out again after every command. Relation lines are dropped from every move: `shape.move.start` (priority 1400) and `commandStack.elements.move.preExecute` (priority 2000) filter them out of the moved shapes, so a selection that contains a line moves only its shapes. Relation connections are never saved.

### Hierarchy

**Path:** `modeler/landscapeHierarchy.ts`, `LandscapeCollapse.ts`, `LandscapeDrilldown.ts`; the `.bfwmap` format is unchanged (`levels`, `Group.collapsed`, `band`, and `parentId` already describe it).

- **Levels:** `levels` is part of `LandscapeMapProperties` (`landscape.updateMap`, so undoable). The model adds, renames and removes them (`addLevel`, `renameLevel`, `removeLevel`, ids from `createElementId('level')`). `getGroupLevelName(group)` is `levels[levelDepthOf(group)]?.name`; `levelDepthOf` counts group ancestors, bands excluded. The pane shows it read only on a group.
- **Bands** are top-level containers drawn with a left header strip and a vertical label. A plane refuses them (`canContain`).
- **Planes:** a collapsed group owns a root element `{ id: 'plane:<groupId>', group }` (`group.plane` links back) created with `canvas.addRootElement`. The main root is the one without `group`. `landscape.toggleCollapse` is one undoable command composed of nested commands: collapse runs `landscape.addPlane`, moves the group's children onto the plane (`moveElements`, delta 0, no auto-resize), sets `businessObject.collapsed` and `expandedBounds`, resizes to `COLLAPSED_SIZE` (200×80) and syncs the connectors; expand clears the flag first, then (in `postExecute`, so ordering and membership see an open group) lays the contents out with `expandedLayoutOf`: the contents are one block, which moves by the smallest shift that brings it inside the stored size (10 px left, right and bottom, 30 px at the top for the title; no shift when it is inside already); a block larger than that area is put on its top-left corner and the group grows right and down by the excess only, never left or up. The group is resized (which pulls in the siblings it now encloses), the contents move back with that shift, the connectors sync and the plane is removed. `landscape.removePlane` switches the root away when the plane is current. `canvasToMap` writes a collapsed group with `expandedBounds` as its size, followed by its plane's contents with `parentId` the group. `importMap` creates the plane with `createPlane` (not undoable). Moving a collapsed group moves its plane's contents by the same delta (`postExecuted` of `shape.move`, so once per move even when the selection names the group and its parent); deleting it removes the plane and contents.
- **Crossing connectors:** the real ends are `businessObject.sourceId` / `targetId`; the canvas ends are the representatives from `placeConnection(source, target)`: the lowest common plane, each end replaced by its outermost collapsed ancestor below it (`representativeOf`). Equal representatives hide the connector. `landscape.rewireConnector` re-attaches and re-parents a connector after every toggle (`syncConnectors`), re-laying it out when the ends change. The real bends stay in the connector's file element (`businessObject.waypoints`) while the line is drawn to something other than its real ends: `landscape.rewireConnector` copies the canvas waypoints there in `execute` when the line was drawn at its real ends (the old value goes to `context.previous` and back on revert), and `canvasToMap` writes `businessObject.waypoints` for such a line, the canvas waypoints otherwise. When a rewire brings the line back to its real ends and at least two bends are stored, `layouter.layoutConnection` repairs those bends instead of laying out afresh. A user reconnect that leaves the line not drawn at its real ends clears the stored bends in the same `landscape.updateElement`, because they belonged to the old end. Deleting a shape removes every connector whose real end it is. Reconnecting updates the real end only on the side that changed (`context.oldSource` / `oldTarget`), so the other side keeps a real end hidden in a collapsed group; replacing a shape updates the real ends that name it. A hidden connector can be lassoed but is never deleted or copied on its own.
- **Drill-down:** `landscapeDrilldown` puts an overlay button `data-test--landscape-drilldown` on collapsed groups and opens `group.plane` with `canvas.setRootElement` on the button, on double-click (`element.dblclick`, before the model's handler; label editing skips collapsed groups) and from the context pad. `ul.landscape-breadcrumbs` (map name › collapsed ancestors › current group) is rebuilt on `root.set` and hidden on the main root. The viewbox is stored per root in a `WeakMap`, so a removed plane can be collected, and restored on `root.set`; a plane without one is fitted. Only the main root's viewbox goes into the document metadata. `root.set` clears selection and overlays, so reveals scroll before they select. Undo of a command whose root differs from the current one switches back through `RootElementsBehavior`.
- **Aggregated relations:** the model shows the lines for the plane on screen: `visiblePlacedProcesses()` replaces each placed process by `representativeOnCurrentPlane(shape)` (`null` when it belongs to another plane), so a process inside a collapsed group is its group. `buildRelationLines` drops lines whose two ends are the same element. A line that ends at a group is labelled with its number of visible relations. `showRelations` also runs after `root.set` (in a microtask). `getHiddenRelationCount` stays map-wide. The properties pane names a group end by its label, and each switch of such a line by its two process ids.
- **Export:** `exportSvg` covers the plane on screen only.

### Filling a Placeholder

**Path:** `studio/src/modules/bpmn-landscape/fillPlaceholder.ts`. Both workflows end in `model.replacePlaceholderWithProcess`; a drop of a Processes pane row on a placeholder does the same through `addProcess`.

- **Link (`linkPlaceholderToProcess`):** a `select` dialog over `getFreeProcessCandidates()` (values are indexes into that list). An info notification replaces the dialog when no process is free.
- **Model (`modelPlaceholderAsProcess`):** one dialog with `text_input` `name` (default: the placeholder label), `select` `folder` and `path_picker` `otherFolder` (replaces the select when filled). The folders are the solution's project folders outside the landscape folder plus `processes/` next to the solution file; the last is the only entry of a solution without project folders. The dialog's validation callback (`validateModelForm`) answers with errors at the fields and keeps the dialog open for: an empty name, a name with characters that are invalid in a file name, a folder inside the landscape folder, an existing `<name>.bpmn` in the folder, and a process id that the catalog already has. The process text and id come from `bpmn.diagram.getNewUniqueXml(name)` (id `<name>_Process`) and `parseSolutionBpmnModel`; `bpmn-landscape` does not import `bpmn-editor`.
- **After the dialog:** `saveProcessFile` creates the folder, writes the file, and, when no project folder holds it, calls `addFolderToSolution` and `saveSolutionFile` before `onElementAdded`. `waitForProcess` then waits (at most 10 s) until the shared scan lists the process in that file, because a shape for an unknown process would show as broken. Only then is the placeholder replaced and `std.editor.gotoSymbolInDocument(fileUri, processId)` opens the Designer; the map stays open and unsaved. Failures (write, solution file, scan timeout) are error notifications with source "Landscapes", and the placeholder stays.

### Renderer, Pane and Commands

- **`LandscapeMapRenderer.tsx`:** shows `EditorLoadingError` while the map is unreadable, otherwise the watcher title warnings, an `EditorToolbar` with the Focus button (`bpmn.landscape.toggleFocusMode`, active class from metadata `focusMode`, `data-test--landscape-focus-mode`) and the canvas host (`data-test--landscape-canvas`). The toolbar also has Export (`std.editor.showExportDialog.bpmn-landscape-map`, `data-test--landscape-export`), Show Changes (`git.showGitDiff`, a text diff of the map file, `data-test--landscape-show-changes`) and History (`git.showFileHistory`, `data-test--landscape-history`), both only while the git commands are registered, and, on the right, the Show Grid checkbox (`data-test--landscape-show-grid`) and Zoom to viewport (`std.editor.zoomToViewport`, `data-test--landscape-zoom-to-viewport`). The host opens the context menu `bpmn/landscape/element` on `contextmenu`: `selectForContextMenu(elementId)` selects the clicked element first and the menu receives its id and type (`null` on the empty canvas, which offers only Paste). The entries are Copy, Paste, Delete, then Open (process, map link), Model this process… and Link to existing process… (placeholder only), Change element (process, placeholder, note) and Open element in text editor (everything except relation lines, which are not in the file).  The host is a `useDropTarget` for `tree_item` subjects with `metadata.processId` (a drop calls `bpmn.landscape.addProcessToMap`) or a `.bfwmap` file row of the Maps explorer (`bpmn.landscape.addMapLinkToMap`), both with `toCanvasPoint(event)`. Styles: `styles/landscape.scss`; focus mode dims `.landscape-map--focus .djs-element:not(.landscape-focused) > .djs-visual`, so the children of a dimmed group keep their own look.
- **Properties pane (`panes/LandscapePropertiesPane.tsx`):** shown for a readable `bpmn-landscape-map`. It reads the model through its getters and re-renders on `selectionRevision`.

  | Selection | View |
  |---|---|
  | None | Map name, a switch per relation layer, "Show N hidden relations", Levels (a name per depth with remove, Add level) |
  | Process | Label (empty shows the process name), shape Box / Chevron, colour (`BpmnElementColorPicker` mapped to `style { fill, stroke }`), file, process id, version, executable flag, relations by kind with direction and the other process (a Show switch when the other process is on the map), decisions with Open (`bpmn.businessRuleTask.openTargetDecision`); an unresolved process gets the next row instead |
  | Placeholder | Label, shape, colour. Model and Link are on the context pad (`placeholder-actions`) and in the right-click menu, not in the pane |
  | Process that is missing or ambiguous (`data-test--landscape-broken-process=<status>`) | The status sentence; Replace with (the candidate files for an ambiguous id, labelled File; the processes not yet on the map for a missing one, or a disabled hint when there are none); Drop reference and Keep (`data-test--landscape-drop-reference`, `data-test--landscape-keep-reference`) |
  | Map link | Target (the relative path, read only), a message when the target is missing (`data-test--landscape-broken-map-link`), Target map select (`htmlId landscape-map-link-target`, `retargetSelectedMapLink`; keyed on `mapPath`, so it follows undo), label, colour |
  | Group, band, note | Label (note: text), colour; a group also the read-only Level name of its depth |
  | Relation line | Kind, from, to, a switch per relation, Hide |
  | Connector | Label; the sentence `data-test--landscape-duplicate-connector` while `getConnectorDuplicateWarning` is set |
  | Several | "N elements selected" |

- **Processes pane (`panes/ProcessesPane.tsx`):** one collapsed row per BPMN file (sorted by name, `!` badge for an invalid file), process rows with `metadata.processId` and `fileUri`, a map-pin badge when the process is on the focused map, and a number badge and an "on N maps" tooltip with the count of saved maps whose reference resolves to that file and process (the snapshot's maps plus `resolveProcessReference`). The rows are `draggable` (source only). Process rows have `menuId` `bpmn-landscape/processes/process`, valid file rows `…/file` (an invalid file has no menu), and the `Tree` has `multiSelectionMenuId` `…/multi-selection`, which also makes the tree multi-selectable. The filter matches file name, process name and id and expands matching files. The pane is shown only while the landscape gate is `ready`; it carries `app-layout__solution-pane`, so it takes the remaining height and scrolls itself, while `landscape.scss` keeps the Maps pane above it from shrinking (at most 40% of the column). Rows carry no `uri`, so nothing can be dropped inside the tree.

| Command | Behaviour |
|---|---|
| `bpmn.landscape.newMap(directoryUri?)` | Asks for a path with `askForNewMapUri` (below), writes an empty map via `editors.createNewEditorDocument` and calls `solution.onElementAdded`. |
| `bpmn.landscape.createMapFromProcesses(rows?)` | In the command search ("Landscapes: Create Map from Processes..."). See [§Automatic Map Creation](#automatic-map-creation). |
| `bpmn.landscape.setUpLandscapeFolder` | In the command search. Creates the declared landscape folder, or `landscapes/` next to the `.bfwsln` when none is declared, and writes it with `solution.setViewFolder('landscapes', …)`. Also the "Create Folder" action for a missing folder. Enabled with a saved solution |
| `bpmn.landscape.setUpNewSolution(folderUri?)` | Called by the Solution Wizard (`std.solution.createSolution`) after it opened the new solution, with the folder picked in its "Landscape folder" field (default as `setUpLandscapeFolder`). Creates and declares that folder, then opens `<solution file name>.bfwmap` in it, creating an empty map when the file does not exist. Not in the command search |
| `bpmn.landscape.chooseLandscapeFolder` | In the command search. Native directory dialog, then `setViewFolder`. A folder at or above a root folder of the solution is refused with a warning, since it would turn that root read-only in the Designer. Maps in the previous folder stay where they are. Enabled with a saved solution |
| `bpmn.landscape.addMapLinkToMap` | `{ mapUri, x, y }` in canvas coordinates, on the focused map |
| `std.editor.showExportDialog.bpmn-landscape-map`, `std.editor.exportDocumentAs.bpmn-landscape-map` | `exportCommands.ts`. The dialog asks for a path (default `<map>.png` next to the map; filters from `IMAGE_SAVE_DIALOG_FILTERS`), checks the extension with `getImageFormatForFilename` and calls `std.editor.exportDocumentAs`. The export reads `model.exportSvg()` (a warning notification when null); svg is saved as is, png, jpeg and webp go through `renderSvgToRasterImage` inside `runWithExportHint`, then `files.save`; a failed render or write gives an error notification. The dialog command is enabled only while the focused map is readable. |
| `bpmn.landscape.modelPlaceholder(elementId?)`, `bpmn.landscape.linkPlaceholder(elementId?)` | Targets of the placeholder entries of the right-click menu and the context pad popup; without an id they act on the selected placeholder. Model needs the ready landscape gate; Link is enabled while `getFreeProcessCandidates()` is not empty. Both in the command search. |
| `bpmn.landscape.addProcessToMap` | `{ processId, fileUri, x, y }` in canvas coordinates, on the focused map |
| `bpmn.landscape.deleteSelection`, `copySelection`, `paste` | Editor actions on the focused map; enabled with a selection (paste: the clipboard tree has elements; copying only processes or relation lines stores an empty tree) |
| `bpmn.landscape.moveSelection{Left,Right,Up,Down}[Accelerated]` | `keyboardMoveSelection.moveSelection` |
| `bpmn.landscape.toggleFocusMode` | In the command search ("Landscapes: Toggle Focus Mode"); enabled for a focused readable map |
| `bpmn.landscape.find` | Cmd/Ctrl+F and the command search ("Landscapes: Find Element"): `model.toggleSearch()` opens or closes the diagram-js search pad; enabled for a focused readable map without active direct editing |
| `bpmn.landscape.copySelection`, `bpmn.landscape.paste` | Ctrl/Cmd+C and V and the element context menu. Paste is diagram-js's `copyPaste.paste()` without a position: the copies hang on the mouse until a click drops them (Esc cancels), under new ids with the file element of the originals. |
| `bpmn.landscape.toggleShowGrid` | In the command search ("Landscapes: Toggle Show Grid"), the View menu ("Landscape Map Editor › Show Grid", `view/landscape-editor/show-grid`) and the toolbar checkbox: flips the project setting `bpmn.landscape.showGrid` (default `true`); the model shows or hides the diagram-js grid from the setting. |
| `bpmn.landscape.openSelectedElement`, `changeElementType`, `openElementInTextEditor` | Targets of the element context menu. `openElement(id)` does what a double click does; `openChangeTypeMenu(id)` opens the Change element popup; the text editor command opens `std.shell.openDocumentInTextEditor` at the line and column of the element's `id="…"` in the saved text (at the top for an element not saved yet). |
| `bpmn.landscape.modeler.registerModule` | Registers a diagram-js module with `landscapeModelerModuleRegistry`; every map opened afterwards gets it (see [plugin-landscape-enrichment.md](plugin-landscape-enrichment.md)). |
| `std.editor.zoomToViewport.bpmn-landscape-map`, `zoomToActualSize.…`, `zoomToSelectedElement.…` | Targets of the View menu and Ctrl+1/2/3: `canvas.zoom('fit-viewport')`, `canvas.zoom(1)`, and 100 % scrolled to the first selected element |

`askForNewMapUri(bifrost, defaultName, directoryUri?)` in `commands.ts` serves `newMap` and the wizard. With the gate closed (`getReadyGateOrExplain`) it activates the Landscapes page, shows an info notice and returns `null`. Otherwise it creates the landscape folder if missing, asks for a path with the native save dialog (starting in `directoryUri` when it lies in the landscape folder, else in the folder itself; the dialog can create subfolders; default file name `<defaultName>.bfwmap`), appends `.bfwmap` when missing (and stops with a warning when that file exists, because the dialog only checked the name without the extension) and refuses a path outside the landscape folder with a warning. It returns the chosen URI.

The selection commands do nothing while direct editing is active, so the keys reach the text box. Keybindings are scoped to `.kbm-editor[data-editor-document-type=bpmn-landscape-map]`: Backspace (macOS) / Delete, Cmd/Ctrl+C, Cmd/Ctrl+V, Cmd/Ctrl+F (search pad, more specific than the global inline search binding), F (focus mode), the arrow keys and Shift+arrow keys. `KeybindingsManager` ignores single-character keys in inputs, so F still types in the properties pane. Undo, redo and save use the global `std.editor.*` bindings.

---

## Automatic Map Creation

### layoutLandscape

**Path:** `studio/src/modules/bpmn-landscape/layoutLandscape.ts`

An adapter from processes and relations to the layered algorithm of the Eclipse Layout Kernel (`elkjs`, EPL-2.0; [decisions.md](../decisions.md) §elkjs for the landscape layout) and back. `layoutLandscape({ nodes, edges, options })` resolves to `{ nodes: Map<key, { x, y }>, groups: { key, label, x, y, width, height }[] }` in map coordinates.

| Part | Behaviour |
|---|---|
| Nodes | `{ key, groupKey, groupLabel }`, 140×60 (`PROCESS_SHAPE_WIDTH` / `HEIGHT`) |
| Edges | `{ sourceKey, targetKey, kind }`. With `options.callHierarchy` only `callActivity` edges count, so rows are the call depth; otherwise every kind counts, so processes that talk to each other sit near each other and a receiver sits below its sender. Several edges between two processes become one; self-edges and edges to unknown keys are dropped. |
| Graph | A root with `elk.algorithm: layered`, `elk.direction: DOWN`, `elk.hierarchyHandling: INCLUDE_CHILDREN`, `elk.layered.cycleBreaking.strategy: DEPTH_FIRST`, node spacing 40, layer spacing 60 and component spacing 60. A group is a compound child with `elk.padding` top 60 (a 40 px header plus the 20 px inset), left, bottom and right 20, holding its processes. Edges sit on the root. |
| Result | Positions of grouped processes are relative to their group in ELK; the adapter adds the group's position. |
| Determinism | Nodes, edges and groups are sorted by key before the graph is built, and ELK uses a fixed random seed: the same sets give the same layout in any input order. |
| Failure | A rejected layout throws "The layout of N processes failed: <reason>". After 30 seconds the worker is terminated (`terminateWorker`, the next layout starts a fresh one) and the layout fails the same way. |

The engine is `new ELK({ workerUrl: new URL('out/elk-worker.min.js', document.baseURI).href })` from `elkjs/lib/elk-api`, created on first use. The 1.6 MB worker script is copied from the package to `out/` unchanged ([build.md](build.md) §Third-party Worker Script) and loaded only when a layout starts; the renderer bundle gains the 10 KB `elk-api`. Unit tests mock `elkjs/lib/elk-api` with the class from `elkjs/lib/elk.bundled.js` and stub `document.baseURI`; the real worker runs in the integration block `assistance`. A `ponytail:` note in the file: one group level only.

### createLandscapeMap

**Path:** `studio/src/modules/bpmn-landscape/createLandscapeMap.ts`

`createLandscapeMap({ catalog, relations, seeds, neighbourSteps, grouping, callHierarchy, name, mapUri })` returns a `LandscapeMap`:

- **Selection:** the seeds that exist in the catalog, plus everything within `neighbourSteps` (0–3) relations of them, breadth-first over every relation kind in both directions and independent of a map's relation toggles.
- **One shape per process id:** the seed's file wins, else the file the first relation names. `fileHint = relativeFileHint(mapUri, uri)`, so the shape resolves.
- **Grouping:** `none`, `folder` (group per BPMN file folder, label = the folder name) or `file` (group per file, label = the file name). With grouping, `levels[0]` is named "Folder" or "File".
- **Elements:** groups first, then processes (`shape: 'box'`, label `null`) with `parentId` the group; ids from `createElementId` with a local taken set; no connectors, because relations are derived; all relation layers on. Positions come from `layoutLandscape`, so the editor zooms to fit on the first open.

### Wizard

`bpmn.landscape.createMapFromProcesses(rows?)` in `commands.ts`. `rows` are `{ fileUri, processId? }` from the Processes pane (a file row without `processId` means all its processes); without rows, every process of the solution is selected.

1. **Gate:** the same refusal as `newMap`.
2. **Seeds:** `collectSeeds(catalog, rows)`; with none, an info notice ("There are no processes to put on a map.").
3. **Dialog** (`bifrost.dialog.open`): "N processes selected", Name (the single process's name, else "New Landscape"; a blank name is refused), Add related processes (None, 1–3 steps; default None for the whole solution, 1 for a selection), Group processes (None, By folder, By file; default By file) and the checkbox "Arrange by call hierarchy" (default on).
4. **File:** `askForNewMapUri(bifrost, name)`. The save dialog comes before the layout because every `fileHint` is relative to the chosen file.
5. **Layout and write:** `createLandscapeMap`, then `editors.createNewEditorDocument` and `solution.onElementAdded`. A failing layout shows an error notification (source "Landscapes") and writes no file.

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
| Shared scan | `studio/src/modules/bpmn-landscape/LandscapeSolutionScan.ts` |
| Placeholder workflows, duplicate connectors | `studio/src/modules/bpmn-landscape/fillPlaceholder.ts`, `findDuplicateConnectors.ts` |
| Auto-layout, map creation | `studio/src/modules/bpmn-landscape/layoutLandscape.ts`, `createLandscapeMap.ts` |
| Maps explorer badges, export | `studio/src/modules/bpmn-landscape/mapsExplorerDecorations.ts`, `exportCommands.ts` |
| Styles, help text | `studio/src/modules/bpmn-landscape/styles/landscape.scss`, `texts/landscapes.md` |
| Relation derivation | `studio/src/modules/bpmn-landscape/buildProcessRelations.ts` |
| Map file format | `studio/src/modules/bpmn-landscape/LandscapeMapFile.ts` |
| Solution scan | `studio/src/modules/bpmn-core/scanSolutionBpmnModels.ts` |
| Scan parsing (worker side) | `studio/src/modules/bpmn-core/parseSolutionBpmnModel.ts`, `bpmn-model-scan-worker.ts` |
| Unit tests | `studio/test/unit/bpmn-landscape/`, `studio/test/unit/bpmn-core/scanSolutionBpmnModels.test.ts` |
| Integration tests | `studio/test/integration/bpmn-landscape/` (`npm run test:integration:bpmn-landscape`) |
