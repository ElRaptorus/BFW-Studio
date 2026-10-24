---
name: Process landscape map (Discover)
overview: Add the first Discover page to the Studio, an editor for process landscape maps stored as .bfwmap files, with process and map lists, derived call, message and signal relations, free hierarchies, auto-creation and image export, without a new third-party package. Delivered in six milestones, each ending in a review stop.
todos:
  - id: m1-catalog-relations
    content: "M1 Data foundation: add message and signal throw and catch names to SolutionProcessEntry, tests"
    status: completed
  - id: m1-catalog-cache-worker
    content: "M1: cache the solution scan per file hash and parse in a web worker, tests"
    status: completed
  - id: m1-relations-function
    content: "M1: pure buildProcessRelations (call, message, signal), tests"
    status: completed
  - id: m1-file-format
    content: "M1: .bfwmap format v1 with read, validate and stable serialise, tests"
    status: completed
  - id: m1-declare-diagram-js
    content: "M1: declare the installed diagram-js in package.json, keep the bpmnlint change"
    status: completed
  - id: m1-docs
    content: "M1: document the scan changes, start bpmn-landscape.md with format and relations"
    status: completed
  - id: m1-gate-review
    content: "M1: Studio gate, ask before running the deploy integration suite, stop for review"
    status: completed
  - id: m2-module-skeleton
    content: "M2 Draw, save, reopen: module bpmn-landscape with page, document type, included files, icons, help text"
    status: completed
  - id: m2-document-model
    content: "M2: LandscapeMapDocumentModel with dirty tracking, undo, redo, selection revision"
    status: completed
  - id: m2-modeler
    content: "M2: diagram-js modeler with renderer (process, group, placeholder, note), rules, importer, exporter, layouter, palette"
    status: completed
  - id: m2-renderer-component
    content: "M2: React renderer with theme tokens, viewbox in metadata, read-only error state for unreadable files"
    status: completed
  - id: m2-processes-pane
    content: "M2: Processes pane grouped by file with filter, on-map marker, drag onto canvas"
    status: completed
  - id: m2-new-map-keybindings
    content: "M2: New Map command and editor keybindings"
    status: completed
  - id: m2-docs
    content: "M2: workbench categories, modules, editor documents, bpmn-landscape.md, decisions"
    status: completed
  - id: m2-integration-suite
    content: "M2: landscape integration suite with npm script and testing rule entry (create, drag, save, reopen)"
    status: completed
  - id: m2-gate-review
    content: "M2: Studio gate, ask before running the landscape suite, stop for review"
    status: completed
  - id: m3-relation-layer
    content: "M3 Relations and properties: derived relation connections refreshed on solution change"
    status: completed
  - id: m3-relation-controls
    content: "M3: relation type toggles, hidden single relations, manual connectors"
    status: completed
  - id: m3-properties-pane
    content: "M3: properties pane for map and element, chevron shape, decision badge and list"
    status: completed
  - id: m3-designer-focus
    content: "M3: open process in the Designer, focus mode"
    status: completed
  - id: m3-tests-docs
    content: "M3: unit tests, docs, integration tests for relations"
    status: completed
  - id: m3-gate-review
    content: "M3: Studio gate, ask before running the landscape suite, stop for review"
    status: completed
  - id: m4-resolution
    content: "M4 Solution integration: resolveProcessReference (resolved, missing, ambiguous, replace candidates) against the saved solution and scanSolutionLandscapeMaps over the landscape folder; the document model uses the resolver; unit tests"
    status: completed
  - id: m4-maps-pane
    content: "M4: missing-process badges through a scoped decoration provider, and dragging maps from the Maps explorer onto the canvas; on-N-maps badge in the Processes pane"
    status: completed
  - id: m4-missing-processes
    content: "M4: missing and ambiguous processes - greyed drawing, Review notification, Replace, Drop to placeholder, session Keep"
    status: completed
  - id: m4-map-links
    content: "M4: map links - drop from the Maps explorer, own look, greyed when the target is missing, double-click opens, Target map picker"
    status: completed
  - id: m4-explorer-menu
    content: "M4: New Landscape Map... in the Maps explorer (done by the explorer perspectives plan)"
    status: completed
  - id: m4-image-export
    content: "M4: image export as PNG, JPG, WebP and SVG through the std export commands and a toolbar button"
    status: completed
  - id: m4-tests-docs
    content: "M4: docs and integration tests (missing-process flow, map link, export)"
    status: completed
  - id: m4-gate-review
    content: "M4: Studio gate, copy this plan to docs/, ask before running the landscape suite, stop for review"
    status: completed
  - id: m5-levels
    content: "M5 Hierarchy: levels in map properties, import and export; levels editor; computed level for groups"
    status: completed
  - id: m5-bands
    content: "M5: band palette entry, rules, distinct look, membership for bands"
    status: completed
  - id: m5-planes
    content: "M5: LandscapeCollapse toggle command, interceptors, rules, root-aware placement, import and export with planes"
    status: completed
  - id: m5-crossing-connectors
    content: "M5: crossing connectors drawn to collapsed groups with hidden real ends (decision 11)"
    status: completed
  - id: m5-drilldown-ui
    content: "M5: LandscapeDrilldown overlay, context pad, double-click drill-down, breadcrumbs, viewbox per root, exportSvg per root"
    status: completed
  - id: m5-aggregated-relations
    content: "M5: relations aggregated onto collapsed groups with a count"
    status: completed
  - id: m5-tests-docs
    content: "M5: unit tests, docs, integration tests for hierarchy"
    status: completed
  - id: m5-gate-review
    content: "M5: Studio gate, copy plan to docs/, ask before running the landscape suite, stop for review"
    status: completed
  - id: m6-layout-function
    content: "M6 Assistance: pure layoutLandscape, tests"
    status: pending
  - id: m6-wizard
    content: "M6: auto-create wizard and Create Map from Selection"
    status: pending
  - id: m6-scan-cost
    content: "M6: one shared map and catalog scan per solution change instead of one per consumer (decorations, Processes pane, each open map)"
    status: pending
  - id: m6-tests-docs
    content: "M6: docs, decisions, help text, integration tests for the wizard"
    status: pending
  - id: m6-gate-review
    content: "M6: Studio gate, ask before running the full integration run, final review"
    status: pending
isProject: false
---

# Process landscape map (Discover)

**Ziel:** Die Discover-Kategorie erhält ihre erste Seite: einen Editor für Prozesslandkarten, die als `.bfwmap`-Dateien in der Solution liegen, mit Prozess- und Kartenliste, abgeleiteten Beziehungen (Call Activity, Message, Signal), frei definierbaren Hierarchien, Auto-Erstellung und Bildexport – ohne neues Fremdpaket.

## Decisions (from `do inn`)

| # | Decision |
|---|---|
| 1 | One `.bfwmap` file per map. It references processes by process id with the BPMN file as a hint; relations are computed live. A missing process is drawn greyed out and disabled; the user may replace it with a process not yet on the map (if any), drop the reference, or keep the break. |
| 2 | The user picks the folder on creation; the default is `landscapes/` in the first project. Maps are found by extension. |
| 3 | One page `discover/landscapes`, a left group with two stacked panes (Maps, Processes), properties on the right. |
| 4 | diagram-js (already installed) as canvas. |
| 5 | Own layout code; elkjs stays the reserve if dense message networks stay tangled. |
| 6 | Nested groups with collapse and drill-down, plus map-link nodes between maps. |
| 7 | No DMN nodes; a process shows a decision badge and lists its decisions in the properties pane. |
| 8 | (M4) "Drop reference" turns the broken process shape into a placeholder in the same place; it keeps its label (defaulting to the old process id) and its connectors. Undoable. |
| 9 | (M4) "Keep" lasts for the session only: the shape stays greyed, Review skips it, and the next opening lists it again. The file format does not change. |
| 10 | (M4) A map link's target is changed with a "Target map" picker in the properties pane. |
| 11 | (M5) A connector between an element inside a collapsed group and one outside is drawn to the collapsed group while it is collapsed; the file keeps the real end and expanding restores it. It is not visible inside the group's plane. |
| 12 | (M5) Double-click on a collapsed group drills down; its label is edited in the properties pane, and the drill-down button stays. |

## Eingaben-Nachweis

- **User decisions 1–7 and the missing-process rule** (previous message): the three actions replace, drop and keep, greyed-out and disabled drawing, extension `.bfwmap`, elkjs only as reserve.
- **`docs/architecture/workbench-categories.md`:** `discover` is registered by `std` and hidden until a page exists; pages are `<categoryId>/<name>` with `icon`, `paneAreas`, `defaultDocumentUri`; R1 routes a document to its type's page, so a `.bfwmap` opened from the Designer's Explorer activates Discover.
- **`studio/src/modules/engine-deploy/index.tsx`:** template for a module that registers a page, a document type with model and renderer, a left pane group with `pages`, a pane prepended to the right `property` group, menus and keybindings.
- **`studio/src/modules/bpmn-editor/index.tsx`:** file-backed type via `uriMatch: /\.bpmn$/`, `registerDefaultIncludedFiles`, keybindings on `.kbm-editor[data-editor-document-type=…]`, `createNewEditorDocumentAsBuffer` for new BPMN files.
- **`docs/architecture/editor-documents.md`:** model `static create(uri, restoredCurrentData, restoredMetadata, fileLoader, bifrost)`, `canUndo` / `undo` / `redo`, `updateCurrentData` drives the dirty dot, `saveEditorDocument` returning `null` lets the Studio write the file; data placement: file text in `data`, view state in `metadata`, selection behind a `selectionRevision` counter.
- **`studio/src/modules/bpmn-core/scanSolutionBpmnModels.ts`:** lists included `.bpmn` files, parses each with the SDK `parseBpmn`, returns processes with call activities and decision refs; no cache (ponytail note); callers `engine-deploy` and `engine-workspace`; unit test `test/unit/bpmn-core/scanSolutionBpmnModels.test.ts`.
- **SDK `dist/bpmn/model.d.ts`:** `BpmnDefinitions.messages` / `signals` (`id`, `name`); `eventDefinition` on start, end, intermediate catch and throw, and boundary events (`MessageEventDefinition.messageRef`, `SignalEventDefinition.signalRef`); `SendTaskTypeData` / `ReceiveTaskTypeData.messageRef`.
- **`studio/src/modules/bpmn-core/ImageExportFunctions.ts`:** `IMAGE_SAVE_DIALOG_FILTERS`, `getImageFormatForFilename`, `runWithExportHint`, `renderSvgToRasterImage`, `replaceThemeColorsInSvg` (maps `--color-bpmn-defaultFillColor` / `StrokeColor` to white and black); `engine-model-viewer` already exports from an SVG string this way.
- **diagram-js 15.28.1 in `studio/node_modules`:** features include `modeling`, `create`, `connect`, `move`, `resize`, `auto-resize`, `lasso-tool`, `align-elements`, `distribute-elements`, `copy-paste`, `keyboard`, `keyboard-move-selection`, `grid-snapping`, `root-elements`, `context-pad`, `palette`, `overlays`, `search-pad`; `layout/ManhattanLayout`. Runtime imports of `diagram-js/lib/...` already exist in `bpmn-core`, but `diagram-js` is not declared in `package.json`.
- **`SolutionMediator`:** every watched file change (debounced), add, remove, rename and move emits `EVENT_SOLUTION_CHANGED` (global `solutionChanged`); `listIncludedFileUris(pattern)`.
- **Worker pattern:** `BpmnSymbolIndexerWorkerClient` extends `AbstractWorkerClient` with `new Worker(new URL('../webworker/….ts', import.meta.url))`.
- **Module boundaries:** `.oxlintrc.json` zones cover `src/modules/bpmn-*/**`, so `bpmn-landscape` may import `bpmn-core` and `dmn-core`, not `engine-*`.
- **Studio tree:** `c31fd40` with the user's uncommitted `bpmnlint ^12.0.0` bump in `package.json` and `package-lock.json`.

## Approach

A new module `bpmn-landscape` (bpmn family) owns everything except the solution scan, which `bpmn-core` extends because `engine-deploy` and `engine-workspace` use it too.

**Process catalog.** `scanSolutionBpmnModels` gains, per process, the message names it throws (message throw and end events, send tasks) and catches (message start, catch and boundary events, receive tasks), and the signal names it throws and catches. Names are resolved through `definitions.messages` / `signals`; a blank name is skipped, as the Engine never routes it. The scan keeps a per-URI cache keyed by the SHA-256 it already computes, so an unchanged file is not parsed again, and parsing runs in a new `BpmnModelScanWorker` built on `AbstractWorkerClient`. Files are still read on every scan; the landscape re-scans on `solutionChanged`. The catalog reflects saved files; unsaved editor changes appear after saving.

**Relations.** `buildProcessRelations(entries)` returns call relations (call activity `calledElement` equals a process id), message relations (process A throws a name that process B catches; direction A → B) and signal relations (thrower → each catcher), each with the element ids and names involved. A message relation means "can send"; correlation is not known at design time.

**File format** (`.bfwmap`, XML in the namespace `https://bifrostforge.world/schema/landscape`, read and written through `moddle` / `moddle-xml`; nesting is containment, labels are attributes, note text is the body, foreign root content preserved; full reference in `docs/architecture/bpmn-landscape.md` §Map File Format):

```xml
<landscape:map xmlns:landscape="https://bifrostforge.world/schema/landscape" version="1" name="Order to Cash">
  <landscape:level id="…" name="Domain" />
  <landscape:band id="…" x="0" y="0" width="1200" height="300" label="Core processes">
    <landscape:group id="…" x="20" y="40" width="400" height="200" label="Sales">
      <landscape:process id="…" x="40" y="80" width="160" height="60" processId="order-process" fileHint="processes/order.bpmn" />
    </landscape:group>
  </landscape:band>
  <landscape:placeholder id="…" x="0" y="400" width="140" height="60" label="Returns (not modelled)" />
  <landscape:mapLink id="…" x="200" y="400" width="140" height="60" label="Finance" mapPath="finance.bfwmap" />
  <landscape:note id="…" x="400" y="400" width="160" height="80">…</landscape:note>
  <landscape:connector id="…" sourceId="…" targetId="…" label="Invoice" />
  <landscape:hiddenRelation key="message:order-process:billing-process:InvoiceRequested" />
</landscape:map>
```

Every element may carry `fill` and `stroke`. Paths are relative to the map file. A process id appears at most once per map. A group's level is its nesting depth, named by `levels[depth]`; levels are edited per map.

**Editor.** `LandscapeMapDocumentModel` holds the parsed file and a diagram-js instance built from: core, selection, move, resize, auto-resize, modeling, create, connect, bendpoints, lasso, align and distribute, copy-paste, keyboard, keyboard-move-selection, grid-snapping, root-elements, overlays, context pad, palette, zoom and move canvas, `diagram-js-minimap`, `diagram-js-grid`. Custom parts: `LandscapeRenderer` (box, chevron, group, band, placeholder, map link, note, greyed and disabled state), `LandscapeRules` (a process at most once; bands only at top level; connectors only between map elements), importer and exporter between file and canvas, and a layouter on `ManhattanLayout`. Every command-stack change serialises the file into `data.current`; undo and redo delegate to the command stack. Default colours use `--color-bpmn-defaultFillColor` / `StrokeColor`, so the existing export colour replacement applies and no theme file changes.

**Hierarchy.** A collapsed group keeps its children on its own plane (`<groupId>_plane`, diagram-js root elements), the mechanism bpmn-js uses for collapsed subprocesses; drill-down overlay and breadcrumbs open the plane, expanding moves the children back into the group. Relations to processes inside a collapsed group are drawn to the group with a count.

**Relations on the canvas.** Derived relations are connections that are rebuilt outside the command stack whenever the catalog or the map changes; they are not saved. Toggling a relation type and hiding one relation are undoable commands that change `relationLayers` / `hiddenRelations`. Manual connectors are ordinary saved connections.

**Panes.** Left group `landscapes` on `discover/landscapes`: **Maps** (every `.bfwmap` of the solution, open on click, "New Map", a badge with the number of missing processes) and **Processes** (the shared `Tree` component, grouped by file and collapsed by default, filter box, marker for processes on the open map, "on N maps" badge from a reverse index over all map files, native drag onto the canvas, multi-selection menu "Create Map from Selection"). Right: properties of the map (name, levels, relation toggles) or the selected element (label, shape, colours, computed level; for processes file, version, executable flag, relations and the decision list with "Open").

**Missing and ambiguous processes.** A process reference without a matching process id is missing; an id defined in several files is resolved by `fileHint`, otherwise ambiguous. Both are drawn greyed out and cannot be opened. Opening a map with such references shows one notification with "Review", which selects the first one. The properties pane offers Replace (a picker of solution processes not on the map; disabled with a hint when there are none; for ambiguous ids it lists the candidates), Drop reference (turns the shape into a placeholder, decision 8), and Keep (session only, decision 9). Replace and Drop are undoable.

**Commands** (`bpmn.landscape.*`): new map (save dialog defaulting to `<first project>/landscapes/<name>.bfwmap`, creates the folder, writes an empty map, opens it), Explorer directory menu "New Landscape Map…", open process in the Designer (double-click), open map link, export as image (serialise the canvas SVG, replace theme colours, `renderSvgToRasterImage` under `runWithExportHint`, same filters and errors as BPMN), focus mode (dim everything except the selection and its direct relations), relation toggles, keybindings for delete, copy, paste and arrow moves scoped to the landscape editor.

**Auto-create.** `layoutLandscape` is a pure function: optional grouping (none, folder, file), call depth as rows (cycles broken by depth-first order), two barycenter sweeps to reduce crossings, shelf packing of groups, fixed spacing. The wizard is a custom dialog: processes preselected from the Processes pane, neighbours within 0–3 relation steps, grouping, call hierarchy as levels on or off, name and folder; it writes the file and opens it.

## Pre-conditions

- Studio at `c31fd40`; the user's uncommitted `bpmnlint ^12.0.0` change in `package.json` / `package-lock.json` stays untouched apart from the one added `diagram-js` line.
- `npm ci` state in `studio/` matches the lock file.

## Scope

- New: `studio/src/modules/bpmn-landscape/**`, `studio/test/unit/bpmn-landscape/**`, `studio/test/integration/bpmn-landscape/**`, `docs/architecture/bpmn-landscape.md`.
- Changed: `studio/src/modules/bpmn-core/scanSolutionBpmnModels.ts` plus a worker and its client, `studio/src/createAndInitializeBifrost.ts`, `studio/package.json` (`diagram-js` declared, script `test:integration:bpmn-landscape`), existing scan tests, docs listed in step 20, `.cursor/rules/studio-testing.mdc` (script table).
- Out of scope: Studio SDK and plugin API, Git Cruiser merge resolver for maps, overlays (linter score, engine status), owner and status attributes, presentation mode, elkjs, the Engine and Lite.

## Assumptions

- The process id is the key of a process, as the Engine deploys by process id.
- Message and signal relations come from event semantics (names), not from collaboration message flows; message flows between participants of one file are not drawn separately.
- The shared `Tree` component has no virtualisation; grouping by file, collapsed by default, keeps the row count at the Explorer's scale. `ponytail:` note naming `@tanstack/react-virtual` as the upgrade.
- SVG rendering of diagram-js stays responsive for a few thousand shapes; collapsed groups keep larger maps below that.

## Risks

- **Size:** the largest Studio feature so far; six milestones with a review stop each, and from Milestone 2 on every milestone leaves a usable editor.
- **Shared scan:** the cache and worker change affects Deploy and the Engine workspace; their existing unit tests and the deploy integration suite must stay green.
- **Planes for collapse:** moving children between planes must keep ids and relations stable; unit tests round-trip collapse, expand and save.
- **Data integrity:** a `.bfwmap` that fails to parse is never overwritten; the editor shows the parse error and stays read-only until the file is fixed.
- **Concurrency:** two windows editing one map overwrite each other, as for every other file type.
- **Stale relations:** relations reflect saved BPMN files only; stated in the help text.

## Definition of Done

- Discover shows the Landscapes page; maps can be created, drawn, nested, collapsed, linked, saved, reopened, auto-created and exported as PNG, JPG, WebP and SVG.
- Missing and ambiguous processes behave as decided.
- No new third-party package in `package-lock.json`.
- `npm run build`, `npm run lint:fix`, `npm run format`, `npm run test:unit` green; the integration suite written and run after the user's approval.
- Architecture docs updated.

## Milestones

The work runs in six milestones. Each one leaves the Studio buildable and every earlier feature working, ends with the Studio gate (`npm run build`, `npm run lint:fix`, `npm run format`, `npm run test:unit`), and stops for your review. At the stop I ask before running any integration suite. Each `do exe` runs the next open milestone; the plan is consumed after Milestone 6. If a review changes the plan, this file is edited before the next milestone starts.

Docs grow with each milestone instead of in one batch at the end, so they always describe what exists.

| Milestone | What you can do afterwards | What to review |
|---|---|---|
| M1 Data foundation | Nothing visible yet; Deploy and the Engine workspace use the cached scan | Relation semantics and the `.bfwmap` format, while they are still cheap to change |
| M2 Draw, save, reopen | Create a map, drag processes and groups onto it, save, reopen, undo | Look and feel of the canvas, file content after save |
| M3 Relations and properties | See call, message and signal links, edit properties, jump to the Designer | Whether the derived relations match your mental model on a real solution |
| M4 Solution integration | Maps list, missing-process mitigation, map links, image export | The rename and delete walk-through, export quality |
| M5 Hierarchy | Levels, bands, collapse and drill-down | Whether the two-level hierarchy is user-friendly |
| M6 Assistance | Auto-create maps from a selection | Layout quality on a large solution, and whether elkjs is needed |

## Checklist

### Milestone 1 — Data foundation

1. Extend `SolutionProcessEntry` with message and signal throw and catch names; tests in `scanSolutionBpmnModels.test.ts`.
2. Cache the scan per URI and SHA-256 and parse in `BpmnModelScanWorker`; existing callers unchanged; tests with a module mock of the worker client.
3. `buildProcessRelations` in `bpmn-landscape`; tests for call, message, signal, blank names and self-relations.
4. `.bfwmap` format v1: read, validate with diagnostic messages, stable serialise; tests.
5. Declare `diagram-js` `^15.28.1` in `package.json`; `npm install`; confirm the lock adds no package and the `bpmnlint` change is intact.
6. Docs: the scan sections in `modules.md` and `deploy.md` (new fields, cache, worker); new `docs/architecture/bpmn-landscape.md` with format and relation rules; `index.md`.
7. Studio gate. Ask before running `npm run test:integration:deploy`, which uses the shared scan. **Stop for review.**

### Milestone 2 — Draw, save, reopen

8. Module skeleton: load after `bpmn-diff`, page `discover/landscapes` ("Landscapes"), document type `bpmn-landscape-map` (`/\.bfwmap$/`), `registerDefaultIncludedFiles(['**/*.bfwmap'])`, icons, help text.
9. `LandscapeMapDocumentModel`: create, dirty tracking, undo and redo through the command stack, selection revision.
10. Modeler: module list, renderer for process box, group, placeholder and note, rules (a process at most once), importer, exporter, `ManhattanLayout` layouter, palette and context pad.
11. React renderer: mount, theme tokens, viewbox in metadata; an unreadable file shows the parse error and is never overwritten.
12. Processes pane: grouped by file and collapsed by default, filter box, marker for processes on the open map, drag onto the canvas.
13. New Map command (save dialog defaulting to `<first project>/landscapes/<name>.bfwmap`) and editor keybindings (delete, copy, paste, arrow moves).
14. Docs: `workbench-categories.md` (built-in pages), `modules.md` (catalog, load order, dependency graph), `editor-documents.md` (registered types), editor section in `bpmn-landscape.md`, `docs/decisions.md` (diagram-js over React Flow; membership in map files by process id).
15. Integration suite `test/integration/bpmn-landscape/` (create, drag, save, reopen), script `test:integration:bpmn-landscape`, entry in the `studio-testing.mdc` script table.
16. Studio gate. Ask before running the landscape suite. **Stop for review.**

### Milestone 3 — Relations and properties

17. Derived relation connections (call, message, signal), rebuilt outside the command stack when the map or the catalog changes; catalog refresh on `solutionChanged`.
18. Undoable relation type toggles and hidden single relations; manual connectors with labels.
19. Properties pane: map (name, relation toggles) and element (label, shape box or chevron, colours; for processes file, version, executable flag, relations, decision list with "Open"); decision badge on the process shape.
20. Double-click opens the process in the Designer; focus mode.
21. Unit tests (relation rebuild, hidden relation round trip), `bpmn-landscape.md`, integration tests (relation drawn between two fixture processes).
22. Studio gate. Ask before running the landscape suite. **Stop for review.**

### Review of Milestones 2 and 3

Checked against the code at `896a7f2` (steps 8–22). Unit tests pass (114 files, 917 tests) and `npm run lint` reports no findings. Integration suites were not run in this review.

- **Done as planned:** module, page, document type, included files, help text; document model with dirty tracking, undo, redo, selection revision, viewbox, unreadable-file gate and watcher; modeler with renderer, rules, layouter, palette, context pad, label editing, copy and paste; Processes pane; New Map and keybindings; relation lines outside the command stack; relation toggles and hidden relations; connectors; properties pane; Designer jump; focus mode; docs, decisions and integration suite.
- **Deliberate deviation, recorded in `docs/decisions.md`:** `.bfwmap` is XML read and written through `moddle` / `moddle-xml` (already in the lock file through bpmn-js), not JSON. The Approach section above is updated.
- **Gaps Milestone 4 closes:**
  - `resolveProcess` falls back to the first candidate when an id is defined in several files without a matching hint, so ambiguous ids are silently resolved.
  - A map link is drawn as a plain box and has no open behaviour.
  - The "New Map" icon sits in the Processes pane header because the Maps pane does not exist yet. Done by the explorer perspectives plan: the icon is a header action of the Maps explorer.
- **Plan copy:** the other agent kept the plan status in `docs/process_landscape_map_3b8e61d4.plan.md`. Both copies were brought in step when the explorer perspectives plan revised Milestone 4; step 30 copies this file there again.

### Milestone 4 — Solution integration and robustness

**Ziel (M4):** Landscape maps become part of the solution: badges on the Maps explorer, process references that survive renames and deletions visibly and fixably, links between maps, and image export.

#### Eingaben-Nachweis (M4)

- **Decisions 1, 3 and 8–10, and step 25 as reworded by the other agent.**
  - A missing process is greyed out and cannot be opened. Replace offers only processes not yet on the map, Drop turns the shape into a placeholder, and Keep lasts for the session.
  - The left group holds Maps and Processes stacked (the Maps explorer and the Processes pane, since the explorer perspectives plan).
  - A map link is created by dragging a map from the Maps explorer. Double-click opens it, its label is edited in the properties pane, and its target is changed with a picker.
- **Explorer perspectives plan (`explorer_perspectives_c71d9a42.plan.md`, landed before this milestone).**
  - The `.bfwsln` declares the landscape folder in `views.landscapes.path`. `landscapeFolder.ts` exports `getLandscapeGate` (`no-solution`, `unsaved`, `no-folder`, `ready` with `folderUri`), `isInLandscapeFolder` and `getMapOpenRefusal`; `canOpen` refuses maps outside the folder of a saved solution.
  - The Maps explorer (`bifrost.explorers`, id `landscapes`, pane `discover/landscapes/maps`, view source `landscapes`, `**/*.bfwmap`) sits first in the `landscapes` group with the New Map header action, "New Landscape Map..." in its folder menus and `LandscapeFolderHint` as empty state.
  - `bifrost.explorers.registerDecorationProvider(provider, explorerIds?)` scopes a decoration provider to explorers.
  - Tree rows drag only where `onDragAndDropItem` is set (`HeadlessTreeItem` `enableDragAndDrop`), and `ExplorerPane` sets it only for the Designer, so Maps explorer rows do not drag yet.
- **`LandscapeMapDocumentModel.ts` (616 lines).** `resolveProcess` filters the catalog by process id and returns the candidate whose `relativeFileHint` matches, else `candidates[0]`, else `null`. It feeds `getProcessLabel`, `getProcessDetails`, `placedProcesses` (relation lines) and `openProcess`, which shows an info notification for an unresolved process. `refreshCatalog` runs on create, on focus and on `solutionChanged`, keeps only the newest scan, then fires `elements.changed` for all process shapes. Double-click handling only covers `type === 'process'`.
- **`modeler/LandscapeRenderer.ts`.**
  - All shapes are drawn from `businessObject` with inline styles, using `var(--color-bpmn-default…)` for default colours. The config passes in `getProcessLabel` and `getDecisionCount`.
  - Placeholders are dashed. A map link falls through to the generic rounded `rect`.
  - Arrow markers live in a `defs` element appended to `canvas._svg`.
- **`modeler/LandscapeModeler.ts`.** It builds a diagram-js `Diagram` with `ModelingModule`, so `modeling.replaceShape` is available, and `GridModule`, which draws on its own layer outside the active layer. It also provides `addProcessShape` (smallest containing group or band) and `findProcessShape(processId)`. There is no SVG export yet.
- **`panes/ProcessesPane.tsx`.**
  - Builds one tree row per BPMN file and lets the shared `Tree` drag process rows with `metadata {processId, fileUri}`.
  - Badges processes on the open map with `ph-map-pin`. Invalid files get a `'!'` character badge. The header has no icon; `LandscapeFolderHint` replaces the list while the gate is not `ready`.
  - It rescans on `solutionChanged` and drops results from an older scan (common pitfall "`getSolution()` keeps its identity").
  - `TreeBadge` supports `character`, `icon` and `number`.
- **`LandscapeMapRenderer.tsx`.** `useDropTarget` accepts `tree_item` only when `metadata.processId` is set and calls `bpmn.landscape.addProcessToMap` at the canvas point. The toolbar has only the Focus button.
- **`panes/LandscapePropertiesPane.tsx`.** For one selected shape it shows `ShapeProperties`, with `LabelProperty` (process label placeholder) and `ProcessDetailsView`. That view shows only "Not found in the solution." when `getProcessDetails` returns `null`. Map links get only the generic Label field.
- **`commands.ts`.** `newMap(bifrost, directoryUri?)` saves inside the landscape folder only (creating it when missing), appends `.bfwmap`, refuses an existing name, then calls `createNewEditorDocument` and `solution.onElementAdded`. `setUpLandscapeFolder` and `chooseLandscapeFolder` write `views.landscapes`.
- **Export plumbing.**
  - `std.editor.showExportDialog` and `std.editor.exportDocumentAs` forward to `….${documentType}` (common pitfall "Document-type export uses a suffixed command").
  - `engine-model-viewer` implements an image-only export:
    1. save dialog with `IMAGE_SAVE_DIALOG_FILTERS`;
    2. `getImageFormatForFilename`, with the `SUPPORTED_IMAGE_EXTENSIONS_TEXT` error;
    3. `renderSvgToRasterImage` under `runWithExportHint`;
    4. `files.save`.
  - `replaceThemeColorsInSvg` maps the two default colour variables to white and black. `getSvgSize` reads integer `width` / `height` from the root tag.
- **bpmn-js `BaseViewer.saveSVG`.** It serialises `canvas.getActiveLayer()` plus `:scope > defs` of `canvas._svg`. It measures `getBBox()` while the container carries `djs-outline-hidden`, pads the box and writes `width`, `height` and `viewBox`.
- **`NotificationManager.open(options, responseCallbackFn)`.** `actions: [{ action, label }]` call back with the chosen action.
- **`SolutionMediator.listIncludedFileUris(pattern)`.** Lists included files, for example `/\.bpmn$/i` in the scans.
- **Unit tests** run in Node without a DOM (`vitest.config.mts` sets no environment), so `getBBox` and SVG serialisation can only be tested in the integration suite.

#### Approach (M4)

**Resolution.** A new pure module `resolveProcessReference.ts` serves the document model, the Maps explorer badges and the Processes pane. It exports:
- `resolveProcessReference(catalog, mapUri, { processId, fileHint })`, which returns one of:
  - `{ status: 'resolved', uri, process }` when exactly one candidate matches the hint, or when the id exists in only one file (a stale hint after a rename or move resolves; the hint is not rewritten, so the map does not turn dirty);
  - `{ status: 'ambiguous', candidates }` when there are several candidates and none matches the hint;
  - `{ status: 'missing' }` when there is no candidate.
- `replaceCandidates(catalog, processIdsOnMap)`, which returns every solution process whose id is not on the map.

`LandscapeMapDocumentModel.resolveProcess` delegates to the resolver, so ambiguous ids no longer resolve to the first file. Resolution runs against the saved solution only: the catalog is the open `.bfwsln`'s, and a map opens only from its landscape folder, so there is no folder-solution or foreign-solution case. Processes outside the solution count as missing.

**Map scan.** A new module `scanSolutionLandscapeMaps.ts` returns nothing unless `getLandscapeGate` is `ready`, lists `/\.bfwmap$/i` and keeps the files `isInLandscapeFolder`, loads and parses each file with `parseLandscapeMap`, and returns `{ uri, name, readable, processReferences: { processId, fileHint }[] }` per map, with `name` falling back to the file's base name. It reads saved files only, like the BPMN catalog. There is no cache; maps are small and parsing runs on the main thread. `ponytail:` note: cache by text hash like the BPMN scan if solutions grow to hundreds of maps.

**Maps explorer badges** (`mapsExplorerDecorations.ts`, registered in `index.tsx` with `bifrost.explorers.registerDecorationProvider(provider, ['landscapes'])`, so git, Open Editors and the Designer are unaffected):
- **Badges:** a `number` badge on a map file counts references that are missing or ambiguous; an unreadable map gets a `'!'` badge with the parse error as tooltip. Both scans re-run on `solutionChanged`, late results are dropped, and the provider fires its change event after each scan.
- **Drag:** Maps explorer rows become drag sources (`tree_item` with `metadata.uri`) while dropping to move stays Designer-only. `Tree` / `HeadlessTreeItem` get a drag-source switch separate from `onDragAndDropItem`, and `ExplorerPane` turns it on for every explorer. Opening and the New Map action already exist.

The Processes pane additionally shows a `number` badge "on N maps", counting saved maps whose reference resolves to that file and process. The pin for the open map stays.

**Broken processes on the canvas.** The renderer config gains `getProcessStatus(element)`, which returns `resolved`, `missing` or `ambiguous`.
- **Drawing:** a missing or ambiguous process is drawn with an inline `opacity: 0.45` and a dashed stroke, plus a small warning glyph (a `<title>` says "Not found in the solution" or "Defined in several files"). Inline styles keep the greyed state in exported images.
- **Opening:** double-click keeps the existing info notification, worded per status.
- **Review notification:** after the first catalog scan of a newly opened map, and again whenever the set of broken references grows during the session, one notification says "N processes on this map are not found or are defined in several files". Its action "Review" selects the first broken shape not kept this session and scrolls to it.

The properties pane, for a broken process, shows the status sentence and three actions:
- **Replace:** a select of `replaceCandidates`, or for an ambiguous id its candidate files. It is disabled with the hint "Every process of the solution is already on this map" when the list is empty. One `UPDATE_ELEMENT_COMMAND` sets `processId` and `fileHint`.
- **Drop reference:** one `modeling.replaceShape` to a placeholder with a new id, the same bounds, the label `element.label ?? processId`, the same style and shape, and the connectors reconnected. `LandscapeRules` must allow `connection.reconnect` for connectors.
- **Keep:** adds the element id to a session set in the model; Review then moves on to the next broken shape.

**Map links.**
- **Creating:** the canvas drop target also accepts a `tree_item` whose `metadata.uri` ends in `.bfwmap` and calls a new command, `bpmn.landscape.addMapLinkToMap({ mapUri, x, y })`. The command refuses a link to the map itself with an info notification. It creates a `mapLink` element with `mapPath = relativeFileHint(this.uri, mapUri)` and the target map's name as label, in the smallest containing group or band (the existing `addProcessShape` placement, generalised to any element).
- **Opening:** the target URI is `new URL(mapPath, this.uri).href`. Double-click opens it with `std.editor.focusOrOpenDocument`, or shows an info notification when the target is not among the solution's maps.
- **Drawing:** a map link is a rounded rect with a double border and a map glyph in the top-right corner. It is greyed like a broken process when its target is missing; the model keeps the URIs from the map scan for this.
- **Properties:** a disabled "Target" field shows `mapPath`, and a "Target map" select lists the other maps of the landscape folder. Choosing one runs `UPDATE_ELEMENT_COMMAND` on `mapPath`.

**Explorer.** Done by the explorer perspectives plan: `newMap(bifrost, directoryUri?)`, the New Map header action and "New Landscape Map..." in the Maps explorer's folder menus. The Designer gets no landscape entry.

**Image export.**
- **SVG:** `LandscapeModeler.exportSvg()` follows bpmn-js `saveSVG`: active layer plus `defs`, `getBBox()` measured under `djs-outline-hidden`, 10 px padding, and `width` / `height` rounded up to integers for `getSvgSize`. It returns the result through `replaceThemeColorsInSvg`. Grid, minimap, selection outlines and focus dimming are not part of the result.
- **Commands:**
  - `std.editor.showExportDialog.bpmn-landscape-map` opens the save dialog directly (images only), defaulting to `<map file name>.png` next to the map, with the same filters and error as BPMN.
  - `std.editor.exportDocumentAs.bpmn-landscape-map(editorDocument, format, filename)` renders `svg`, `png`, `jpeg` or `webp`, rasters under `runWithExportHint`, and saves with `files.save`.
- **UI:** a toolbar button "Export" calls the dialog command; File › Export works through `std`.

#### Pre-conditions (M4)

- Studio at the commit that lands the explorer perspectives plan, on top of `896a7f2` (check `git log` before starting). The only uncommitted change, `studio/test/integration/plugins/plugin-host.test.ts`, is the user's and stays untouched.
- Unit tests and lint are green, and the core, landscape, git-cruiser and deploy suites passed at the end of the explorer perspectives plan.

#### Scope (M4)

- **New:**
  - `studio/src/modules/bpmn-landscape/resolveProcessReference.ts`, `scanSolutionLandscapeMaps.ts`, `mapsExplorerDecorations.ts`;
  - unit tests `test/unit/bpmn-landscape/resolveProcessReference.test.ts` and `scanSolutionLandscapeMaps.test.ts`;
  - integration test `test/integration/bpmn-landscape/landscape-solution.test.ts`.
- **Changed:**
  - `studio/src/components/Tree/` and `components/panes/activities/files/ExplorerPane.tsx` (drag source without drop);
  - in `bpmn-landscape`: `index.tsx` (decoration provider), `commands.ts`, `LandscapeMapDocumentModel.ts`, `LandscapeMapRenderer.tsx` (drop, toolbar), `modeler/LandscapeModeler.ts`, `modeler/LandscapeRenderer.ts`, `modeler/LandscapeRules.ts` (reconnect), `panes/ProcessesPane.tsx`, `panes/LandscapePropertiesPane.tsx`, `styles/landscape.scss`, `texts/landscapes.md`;
  - fixtures under `test/integration/bpmn-landscape/`;
  - `docs/architecture/bpmn-landscape.md`;
  - `docs/process_landscape_map_3b8e61d4.plan.md` (copy of this file).
- **Not touched:** the `.bfwmap` format, the `views` block, `bpmn-core`, other modules' menus, the SDK, the Engine and Lite.

#### Assumptions (M4)

- Renaming a BPMN file without changing process ids keeps every reference resolved: the id is unique, so the stale hint does no harm. Only ids defined in several files need the hint.
- A renamed or deleted `.bfwmap` breaks links to it; the Target map picker fixes them. The Studio does not rewrite other maps on rename.
- The badges and the "on N maps" count reflect saved files, like the BPMN catalog.

#### Risks (M4)

- **`replaceShape` and connectors:** a reconnect the rules forbid drops the connector. Allowing `connection.reconnect` for connectors only (never relation lines) and an integration check after Drop cover this.
- **Notification noise:** scans run on focus and on every solution change. The notification therefore fires only on the first scan of an open and when the broken set grows; covered by a test.
- **Export measurement:** `getBBox` needs the canvas in the DOM. The export commands run on the focused, attached map, and a detached model returns `null` with a warning notification, as the model viewer does.
- **Extra scan cost:** the decoration provider and the Processes pane add a map scan per solution change; this is bounded by the `ponytail:` note above.
- **Dragging out of view explorers:** a drag source without a drop target must not let a row be dropped onto another explorer row; the drop side keeps its `structural` check, covered by a test.

#### Definition of Done (M4)

- The Maps explorer badges broken and unreadable maps, and its rows create map links by drag. The Processes pane shows "on N maps".
- Broken processes are greyed, reported once with Review, and can be replaced, dropped to a placeholder or kept for the session, with undo.
- Map links open their target, are greyed when the target is missing, and can be retargeted.
- Export writes PNG, JPG, WebP and SVG with theme colours replaced.
- The Studio gate is green, the landscape suite has been run after your approval, `bpmn-landscape.md` and the help text are updated, and the plan copy in `docs/` is current.

#### Checklist (M4)

23. `resolveProcessReference` and `replaceCandidates`; `scanSolutionLandscapeMaps`. `LandscapeMapDocumentModel.resolveProcess` delegates to the resolver (ambiguous no longer falls back to the first file). Unit tests:
    - resolved by hint, resolved with a stale but unique hint, ambiguous, missing;
    - candidates exclude ids on the map;
    - map scan with an unreadable file and the name fallback.
24. Missing-process badges through a scoped decoration provider, and dragging maps from the Maps explorer onto the canvas:
    - `mapsExplorerDecorations.ts` registered for `['landscapes']`: missing badge (`number`) and unreadable badge (`'!'` with tooltip);
    - drag source switch in `Tree` / `HeadlessTreeItem`, on in every explorer; dropping to move stays Designer-only.

    The Processes pane gets the "on N maps" `number` badge.
25. Broken processes:
    - **Drawing:** `getProcessStatus` in the renderer config; greyed inline style and warning glyph with title.
    - **Notification:** the Review notification fires on the first scan of an open and when the broken set grows.
    - **Properties pane:** Replace select (disabled with a hint when empty; candidate files for ambiguous ids); Drop reference through `modeling.replaceShape` to a placeholder (decision 8; `LandscapeRules` allows `connection.reconnect` for connectors); Keep as a session set skipped by Review (decision 9).
26. Map links:
    - `bpmn.landscape.addMapLinkToMap` and canvas drop of a Maps explorer row (`metadata.uri` ending in `.bfwmap`); a self-link is refused; the label defaults to the target map's name; placement in the smallest containing group or band.
    - Renderer look (double border, map glyph) and greyed state for a missing target.
    - Double-click opens via `std.editor.focusOrOpenDocument`.
    - Properties: disabled Target field and "Target map" select (decision 10).
27. Done by the explorer perspectives plan (`newMap(bifrost, directoryUri?)`, New Map header action, "New Landscape Map..." in the Maps explorer menus).
28. `LandscapeModeler.exportSvg()` (bpmn-js `saveSVG` pattern, `djs-outline-hidden`, padding, integer size, `replaceThemeColorsInSvg`). Commands `std.editor.showExportDialog.bpmn-landscape-map` and `std.editor.exportDocumentAs.bpmn-landscape-map`; Export toolbar button.
29. Docs: `bpmn-landscape.md` (resolution rule, map scan, Maps explorer badges and drag, broken-process handling, map links, export, file paths), `tree.md` (drag source) and `texts/landscapes.md`. Integration tests in `landscape-solution.test.ts`:
    - a fixture map with a missing process is greyed, Review selects it, and Replace fixes it;
    - Drop yields a placeholder that keeps its connector;
    - a map link dragged from the Maps explorer opens its target;
    - a Maps explorer row dropped on another row does not move it;
    - SVG export writes a file with the process label and no `var(--`;
    - PNG export writes a non-empty file.
30. Studio gate (`npm run build`, `npm run lint:fix`, `npm run format`, `npm run test:unit`). Copy this plan file to `docs/process_landscape_map_3b8e61d4.plan.md`. Ask before running `npm run test:integration:bpmn-landscape`. **Stop for review** (focus: the rename and delete walk-through, export quality).

### Milestone 5 — Hierarchy

**Ziel (M5):** Maps gain hierarchy: named levels, top-level bands, nested groups that collapse into a box and open as their own plane with breadcrumbs, relation lines aggregated onto collapsed groups, all undoable and saved in the existing `.bfwmap` format.

#### Eingaben-Nachweis (M5)

- **Decision 6 and the user's answers in this planning session.**
  - Decision 6 asks for nested groups with collapse and drill-down.
  - **Decision 11:** a manual connector between an element inside a collapsed group and one outside is drawn to the collapsed group while the group is collapsed. The file keeps the real end, and expanding restores it. The connector is not visible inside the group's plane.
  - **Decision 12:** double-click on a collapsed group drills down. Its label is then edited in the properties pane, and the drill-down button stays as well.
- **`LandscapeMapFile.ts`.**
  - The format already carries everything M5 needs, so the format does not change:
    - `levels: { id, name }[]`, where `levels[0]` names top-level groups and `levels[1]` the groups inside them;
    - `Group.collapsed` (moddle default `false`, written only when true);
    - `band`, which the reader refuses inside a container ("bands stay at the top level") and as a connector end.
  - `createElementId(type, isTaken)` accepts element types and `'connector'` only.
- **`modeler/LandscapeModeler.ts` (353 lines).**
  - The module wires `RootElementsModule`, `OverlaysModule` and `AutoResizeModule`.
  - `importMap` calls `diagram.clear()`, adds every shape to the canvas root or to its parent shape, adds connectors to the root, and sets `name`, `relationLayers` and `hiddenRelations`.
  - `exportMap` walks `canvas.getRootElement()`, which is the current plane, not the map, once drill-down exists.
  - `addElementShape` picks the smallest container from the whole registry and falls back to `canvas.getRootElement()`.
- **`modeler/LandscapeRules.ts` and `LandscapeGroupMembership.ts`.**
  - A root without a businessObject holds anything; group and band hold anything except a band.
  - `shape.resize` is always allowed, and `element.autoResize` is allowed for group and band, so nested groups already grow with their content.
  - Membership runs after `shape.create` and `shape.resize` of a group and after `elements.move` of groups. Children no longer enclosed move to `enclosingContainerOutside` (whole registry, else `canvas.getRootElement()`), and fully enclosed non-band siblings move in, using `moveElements(…, {x:0,y:0}, target, {autoResize:false})`. Bands get no membership.
- **`modeler/landscapeCanvasMapping.ts`.**
  - `mapToCanvasDescriptors` orders parents first.
  - `canvasToMap(root, base)` walks canvas children depth-first, derives `parentId` from the canvas parent's businessObject, rounds the geometry and skips relation lines.
- **`LandscapeUpdates.ts`.** `LandscapeMapProperties` is `name | relationLayers | hiddenRelations`; `levels` is missing. `UPDATE_MAP_COMMAND` and `UPDATE_ELEMENT_COMMAND` undo through `pickOld`.
- **Relation pipeline.**
  - `buildRelationLines(PlacedProcess[])` groups relations into `relation:<kind>:<source>:<target>` lines and drops a line whose relations are all hidden. It has no self-line filter.
  - `LandscapeRelationLayer.show` adds relation connections to `canvas.getRootElement()` and removes stale ones.
  - The model's `placedProcesses()` and `showRelations()` feed it, then call `updateFocus`.
- **UI pieces.**
  - **Palette:** hand, lasso, group (400×240), placeholder, note; no band entry.
  - **Context pad:** Delete and Connect (not for bands); Hide relation for relation lines.
  - **Properties pane:** `MapProperties` shows Name, the relation switches and "Show N hidden relations". `ShapeProperties` shows Label, Shape, colour and the process and map-link details.
  - **Renderer:** draws groups and bands as the same 4 px rounded rect with a top-centred label.
- **diagram-js 15.28.1 `Canvas`** has the plane API:
  - `addRootElement` creates a hidden layer;
  - `setRootElement` fires `root.set`, on which selection and overlays clear;
  - `removeRootElement`, `findRoot` and `getRootElements`;
  - `scrollToElement` switches to the element's root on its own.
  
  `MoveHelper` re-parents an enclosed connection only when the connection itself is in the moved list (`topLevel[c.id]`).
- **bpmn-js drilldown (reference only, not a dependency).**
  - `DrilldownBreadcrumbs` rebuilds a `ul` on `root.set`; `DrilldownCentering` keeps one viewbox per root; `DrilldownOverlayBehavior` adds a `drilldown` overlay button.
  - `SubProcessPlaneBehavior` adds and removes the plane root in `executed` / `reverted`, moves children with `modeling.moveElements(children, offset, target, {autoResize:false})` and deletes plane children with the shape.

#### Approach (M5)

**Levels.**
- **Properties:** `LandscapeMapProperties` gains `levels`; `importMap` sets it and `exportMap` writes it back, with undo through `UPDATE_MAP_COMMAND`.
- **Editor:** `MapProperties` gets a "Levels" section with one text field per depth ("Level 1", "Level 2", … as placeholder), a remove button per row and "Add level". Levels are positional: removing a level shifts the deeper names up, which the remove button's title says.
- **Ids:** `createElementId` accepts `'level'` (prefix `Level`), and `isTaken` checks the registry and the existing levels.
- **Computed level:** a group's depth is the number of enclosing groups across planes; bands do not count. `ShapeProperties` shows a read-only "Level" field for groups: `levels[depth].name`, or "Level N (unnamed)".

**Bands.**
- **Palette:** "Create band", 1200×240. The rules refuse a band on a plane and inside a container (the latter exists already).
- **Look:** a light fill and a 32 px header strip on the left with the label written vertically, so a band reads differently from a group.
- **Membership:** the existing logic is generalised from groups to groups and bands. A band adopts the top-level non-band shapes it fully encloses and releases the ones it no longer encloses.

**Planes for collapsed groups.** A collapsed group is a shape of fixed size, 200×80 at the same top-left. Its expanded width and height are kept on the shape as `expandedBounds`. Its plane is a root element `{ id: '<groupId>_plane', groupId }` without a businessObject. Contents keep their absolute coordinates on the plane, so expanding restores the layout exactly.
- **Command:** a new handler `landscape.toggleCollapse` (in a new service `LandscapeCollapse`) composes modeling operations so undo works.
  - **Collapse:**
    1. store `expandedBounds`;
    2. resize to the collapsed size;
    3. add the plane root;
    4. move the group's children, plus every connector whose ends are both inside, onto the plane;
    5. sync crossing connectors;
    6. set `collapsed` on the businessObject.
  - **Expand:**
    1. resize to `expandedBounds` grown to enclose the plane contents plus padding;
    2. move the contents back under the group (connectors to the group's root);
    3. remove the plane root;
    4. sync connectors;
    5. clear `collapsed`.
  - Expanding never pushes neighbours: membership skips this resize through a hint, so siblings under the expanded area stay where they are, overlap visibly and are not swallowed.
- **Follow-up behaviours** (CommandInterceptor in `LandscapeCollapse`):
  - moving a collapsed group moves its plane contents by the same delta;
  - deleting a collapsed group deletes its plane contents and removes the plane root;
  - deleting an element on a plane also deletes connectors whose hidden end is that element;
  - undo removing the current plane first switches to the group's root.
- **Rules:** a collapsed group cannot be resized or auto-resized and is not copyable; copying stays possible after expanding. Membership skips collapsed groups.
- **Root-aware placement:** a helper `logicalParent(shape)` (the plane's group for a shape on a plane) serves depth, export and representatives. `addElementShape`, `enclosingContainerOutside` and the membership fallback only consider shapes on the target's own root.
- **Import and export:**
  - The importer creates a collapsed group at the collapsed size with `expandedBounds` from the file, adds its plane root and places descendants on it.
  - `exportMap` always starts from the map root, stored at import, and `canvasToMap` descends into planes (`collapsed` from the businessObject, width and height from `expandedBounds`).
  - Both functions take plain element objects, so they stay unit-testable.

**Crossing connectors (decision 11).**
- **Drawing:** a connector whose ends lie on different planes is drawn on their lowest common plane, between each end's representative there: the end itself, or its outermost collapsed ancestor.
- **Hidden end:** when a representative differs from the real end, the connection records `hiddenSourceId` / `hiddenTargetId`, set inside the toggle command so undo restores it. A user reconnect of that side clears it.
- **Export:** `sourceId = hiddenSourceId ?? source.businessObject.id`, and the same for the target.
- **Sync:** one `syncConnectors(affected)` step recomputes parent, ends and hidden ids after every collapse and expand, which also covers nested collapses (the hidden end stays the deepest real element).

**Drill-down UI** (new service `LandscapeDrilldown`):
- **Entry points:** a `drilldown` overlay button on every collapsed group; context-pad entries "Collapse" and "Expand" on groups and "Open" on collapsed groups; double-click on a collapsed group drills down (decision 12, wired where the model handles double-click; `LandscapeLabelEditing` skips collapsed groups).
- **Breadcrumbs:** `ul.landscape-breadcrumbs` in the canvas container, rebuilt on `root.set` and hidden on the map root. It shows map name › ancestor groups › current group, each crumb clickable.
- **Viewbox:** one viewbox per root, restored when a plane is entered again; a plane entered for the first time is zoomed to fit its contents.
- **Elsewhere:** focus, Review and `findProcessShape` keep working across planes, because `scrollToElement` switches roots. `exportSvg` measures only the elements of the current root, so the image shows the plane on screen.

**Aggregated relations.**
- **Placement:** `placedProcesses()` maps each process to its representative on the current root (itself, or its outermost collapsed ancestor visible there). Processes not under the current root, such as siblings outside the drilled-in group, are left out.
- **Lines:** `buildRelationLines` drops self-lines (source equals target), so relations inside one collapsed group vanish. Relations between two collapsed groups merge into one line per kind through the existing grouping.
- **Count and recompute:** a line with an end at a collapsed group shows the relation count as its label; the title already lists the relations. `showRelations` also runs on `root.set`.
- **Hiding:** "Hide relation" on an aggregated line hides all its relations, as for any multi-relation line.

#### Pre-conditions (M5)

- You have accepted the Milestone 4 review. Its landscape integration suite is still unrun (`m4-gate-review` in progress) and runs only after your approval.
- Unit tests and lint are green. `studio/test/integration/plugins/plugin-host.test.ts` and `.github/workflows/studio.yml` stay untouched.

#### Scope (M5)

- **New:**
  - `studio/src/modules/bpmn-landscape/modeler/LandscapeCollapse.ts` (toggle command, interceptors, connector sync);
  - `modeler/LandscapeDrilldown.ts` (overlay, breadcrumbs, viewbox per root);
  - integration test `test/integration/bpmn-landscape/landscape-hierarchy.test.ts` with a fixture map.
- **Changed:**
  - in `bpmn-landscape`:
    - `LandscapeMapFile.ts` (`createElementId` accepts `'level'`);
    - `modeler/LandscapeModeler.ts` (module wiring, import and export with planes, map root, root-aware placement, `exportSvg` bounds);
    - `modeler/landscapeCanvasMapping.ts`, `LandscapeRules.ts`, `LandscapeGroupMembership.ts`, `LandscapeUpdates.ts`, `LandscapeRenderer.ts` (band look, count label), `LandscapeContextPadProvider.ts`, `LandscapePaletteProvider.ts`, `LandscapeLabelEditing.ts`;
    - `buildRelationLines.ts`, `LandscapeMapDocumentModel.ts`, `panes/LandscapePropertiesPane.tsx`, `styles/landscape.scss`, `texts/landscapes.md`;
  - unit tests `landscapeCanvasMapping.test.ts`, `buildRelationLines.test.ts`, `LandscapeMapFile.test.ts`;
  - `docs/architecture/bpmn-landscape.md`; the decision table (11, 12) of this plan; `docs/process_landscape_map_3b8e61d4.plan.md` (copy).
- **Not touched:** the `.bfwmap` schema, the scans and the Maps explorer, `bpmn-core`, the SDK, the Engine and Lite.

#### Assumptions (M5)

- A group inside a band has depth 0; bands are not levels.
- The collapsed size is fixed (200×80) and not stored. A long label wraps and is cut off at the box.
- A file with `collapsed="true"` written by hand opens collapsed. An empty collapsed group gets an empty plane.
- Relations from inside the drilled-in plane to processes outside it are not shown there; the parent plane shows them aggregated.
- Copying a collapsed group is refused, like copying a process. Expanding first makes it copyable.

#### Risks (M5)

- **Data integrity of connectors:**
  - **Risk:** a hidden end that points at a deleted or moved element would write an invalid file.
  - **Mitigation:** delete cascades to such connectors, the sync runs after every toggle, and export falls back to the canvas end only when no hidden id is set.
  - **Tests:** a roundtrip unit test and an integration test (collapse, save, reopen, expand) cover this.
- **Undo while drilled in:** reverting a collapse removes the plane on screen. The handler switches to the group's root first; covered by an integration test.
- **`diagram.clear()` and planes:** re-import must drop all plane roots. Checked in the import code and covered by the reopen test; if `clear` leaves roots, the importer removes them explicitly.
- **Membership on expand:** expanded bounds can cover siblings. The hint stops them from being swallowed; overlap stays visible and is the user's to fix.
- **Global registry lookups:** every `elementRegistry.filter` that assumes one root is reviewed: containers, `isProcessOnMap`, focus and `exportSvg` bounds. `isProcessOnMap` must stay map-wide, so a process on any plane counts as on the map.
- **Operations and topology:** none beyond the desktop app. Each open map has its own diagram, so breadcrumbs and plane state are per editor, and nothing is stored in localStorage metadata beyond the existing selection revision.
- **Compatibility:** the format is unchanged, and maps saved by M4 open expanded as before.

#### Definition of Done (M5)

- **Levels:** the map pane edits levels (rename, add, remove) with undo, and the group pane shows the computed level.
- **Bands:** bands can be drawn at top level only, look distinct and adopt enclosed shapes.
- **Collapse and drill-down:**
  - groups collapse and expand with undo;
  - a collapsed group opens as its own plane by double-click, overlay button or context pad;
  - breadcrumbs lead back;
  - moving or deleting a collapsed group carries its contents.
- **Connectors and relations:**
  - crossing connectors are drawn to the collapsed group and restored on expand;
  - the file keeps real ends and `collapsed`;
  - relation lines aggregate onto collapsed groups with a count.
- **Gate:** the Studio gate is green, the landscape suite has been run after your approval, `bpmn-landscape.md` and the help text are updated, and the plan copy in `docs/` is current.

#### Checklist (M5)

31. Levels:
    - `levels` in `LandscapeMapProperties`, import and export;
    - `createElementId('level', …)`;
    - Levels section in `MapProperties` (rename, add, remove, undoable);
    - read-only computed "Level" in the group properties (depth across planes, bands ignored).
32. Bands:
    - palette entry "Create band";
    - rules refuse bands on planes;
    - renderer look (left header strip, vertical label);
    - membership generalised to bands.
33. Planes (`LandscapeCollapse`):
    - `landscape.toggleCollapse` command (collapsed size, `expandedBounds`, plane root, contents and enclosed connectors moved);
    - interceptors for move, delete and undo-while-drilled-in;
    - rules (no resize, auto-resize or copy for collapsed groups);
    - membership skips collapsed groups and the expand resize;
    - root-aware `addElementShape` and `enclosingContainerOutside`;
    - import and export with planes from the stored map root.
34. Crossing connectors (decision 11):
    - representative ends on the lowest common plane;
    - `hiddenSourceId` / `hiddenTargetId` set inside the toggle command and cleared by a user reconnect;
    - export of the real ends;
    - `syncConnectors` after every toggle;
    - cascade delete when a hidden end is deleted.
35. Drill-down UI (`LandscapeDrilldown`):
    - drilldown overlay button;
    - context-pad Collapse, Expand and Open;
    - double-click drills into a collapsed group (decision 12) and label editing skips it;
    - breadcrumbs;
    - viewbox per root;
    - `exportSvg` limited to the current root.
36. Aggregated relations:
    - representatives in `placedProcesses()`;
    - self-line filter in `buildRelationLines`;
    - count label on lines ending at a collapsed group;
    - `showRelations` on `root.set`.
37. Unit tests:
    - `canvasToMap` / import descriptors with collapsed groups (ids, `parentId`, geometry, `collapsed`, real connector ends survive a roundtrip);
    - the self-line filter;
    - `createElementId('level')`.

    Docs: `bpmn-landscape.md` (levels, bands, planes, crossing connectors, drill-down, aggregation), `texts/landscapes.md`, decisions 11 and 12 in this plan.

    Integration tests in `landscape-hierarchy.test.ts`:
    - collapse with a crossing connector, save, reopen, expand (positions and connector end restored);
    - double-click drill-down and breadcrumb back;
    - undo of a collapse while drilled in;
    - aggregated line count;
    - levels rename and computed level;
    - band creation refused inside a group.
38. Studio gate (`npm run build`, `npm run lint:fix`, `npm run format`, `npm run test:unit`). Copy this plan file to `docs/process_landscape_map_3b8e61d4.plan.md`. Ask before running `npm run test:integration:bpmn-landscape`. **Stop for review** (focus: the collapse and connector walk-through, the band look).

### Milestone 6 — Assistance

39. `layoutLandscape`; tests for determinism, no overlaps, cycles and grouping.
40. Auto-create wizard; "Create Map from Selection" in the Processes pane opens it.
41. Scan cost (open item from the Milestone 4 review): every solution change scans all maps and the BPMN catalog once for the Maps explorer badges, once for the Processes pane and once per open map. Share one scan per solution change between these consumers (or cache map parses by text hash like the BPMN scan) and remove the `ponytail:` note in `scanSolutionLandscapeMaps.ts`.
42. `bpmn-landscape.md` (layout), `docs/decisions.md` (own layout, elkjs in reserve), final help text, integration tests (wizard creates the expected map).
43. Studio gate. Ask before running the full integration run (`npm run test:integration`). **Final review**; whether elkjs is needed is your decision at this point.

Plan-Gate: bestanden.

