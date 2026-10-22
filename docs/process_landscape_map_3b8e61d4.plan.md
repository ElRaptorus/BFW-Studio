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
  - id: m4-maps-pane
    content: "M4 Solution integration: Maps pane and on-N-maps badge in the Processes pane"
    status: pending
  - id: m4-missing-processes
    content: "M4: missing and ambiguous processes - greyed out, notification, replace, drop, keep"
    status: pending
  - id: m4-map-links
    content: "M4: map-link nodes"
    status: pending
  - id: m4-explorer-menu
    content: "M4: Explorer directory menu entry New Landscape Map"
    status: pending
  - id: m4-image-export
    content: "M4: image export as PNG, JPG, WebP and SVG"
    status: pending
  - id: m4-tests-docs
    content: "M4: unit tests, docs, integration tests for missing processes and export"
    status: pending
  - id: m4-gate-review
    content: "M4: Studio gate, ask before running the landscape suite, stop for review"
    status: pending
  - id: m5-levels-bands
    content: "M5 Hierarchy: levels editor, bands, nested groups with auto-resize"
    status: pending
  - id: m5-collapse-drilldown
    content: "M5: collapse, expand and drill-down via planes with breadcrumbs"
    status: pending
  - id: m5-aggregated-relations
    content: "M5: relations aggregated onto collapsed groups"
    status: pending
  - id: m5-tests-docs
    content: "M5: unit tests, docs, integration tests for collapse and drill-down"
    status: pending
  - id: m5-gate-review
    content: "M5: Studio gate, ask before running the landscape suite, stop for review"
    status: pending
  - id: m6-layout-function
    content: "M6 Assistance: pure layoutLandscape, tests"
    status: pending
  - id: m6-wizard
    content: "M6: auto-create wizard and Create Map from Selection"
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

**Missing and ambiguous processes.** A process reference without a matching process id is missing; an id defined in several files is resolved by `fileHint`, otherwise ambiguous. Both are drawn greyed out and cannot be opened. Opening a map with such references shows one notification with "Review", which selects the first one. The properties pane offers Replace (a picker of solution processes not on the map; disabled with a hint when there are none; for ambiguous ids it lists the candidates), Drop reference, and Keep (dismisses; the greyed drawing stays). Replace and Drop are undoable.

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

### Milestone 4 — Solution integration and robustness

23. Maps pane (list, open, new, missing-process badge); "on N maps" badge in the Processes pane.
24. Missing and ambiguous processes: greyed-out drawing, notification with "Review", Replace, Drop and Keep.
25. Map-link nodes, created by dragging a map from the Maps pane onto the canvas; double-click opens the target (the label is edited in the properties pane); a missing target is greyed out.
26. Explorer directory menu entry "New Landscape Map…".
27. Image export as PNG, JPG, WebP and SVG.
28. Unit tests (missing detection, replace candidates, SVG serialisation), `bpmn-landscape.md`, integration tests (missing-process flow, export).
29. Studio gate. Ask before running the landscape suite. **Stop for review.**

### Milestone 5 — Hierarchy

30. Levels editor in the map properties, computed level in the element properties; bands at top level; nested groups with auto-resize.
31. Collapse, expand and drill-down via planes with breadcrumbs.
32. Relations aggregated onto collapsed groups with a count.
33. Unit tests (collapse, expand and save keep ids and relations), `bpmn-landscape.md`, integration tests (collapse, drill down, save, reopen).
34. Studio gate. Ask before running the landscape suite. **Stop for review.**

### Milestone 6 — Assistance

35. `layoutLandscape`; tests for determinism, no overlaps, cycles and grouping.
36. Auto-create wizard; "Create Map from Selection" in the Processes pane opens it.
37. `bpmn-landscape.md` (layout), `docs/decisions.md` (own layout, elkjs in reserve), final help text, integration tests (wizard creates the expected map).
38. Studio gate. Ask before running the full integration run (`npm run test:integration`). **Final review**; whether elkjs is needed is your decision at this point.

Plan-Gate: bestanden.
