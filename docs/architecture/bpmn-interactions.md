# BPMN Interactions (Discover)

---

## Overview

`studio/src/modules/bpmn-interactions/` implements Discover › **Interactions**: a read-only, generated network diagram of **message** and **signal** communication between BPMN processes the user selects in the open solution. The virtual document `interactions://solution` has no file on disk; generation is explicit. The catalog comes from the shared `LandscapeSolutionScan` (`bpmn-landscape/solution-scan`) and `communicationEvents` on each scanned process ([modules.md](modules.md) §bpmn-core, [bpmn-landscape.md](bpmn-landscape.md) §Shared Solution Scan). Layout uses the shared ELK engine in `bpmn-core/elkLayoutEngine.ts` (same worker and timeout as landscape map layout). Landscape maps show only user-drawn connectors; Interactions is the place for inferred message/signal links between processes.

---

## Architecture

```
LandscapeSolutionScan.catalog (communicationEvents + correlationKey)
        │
        ▼
buildInteractionGraph (pure) ──► InteractionGraph (processes, ports, lines, stations)
        │
        ▼
layoutInteractionGraph (ELK) ──► positions + edge waypoints
        │
        ▼
InteractionsViewer (read-only diagram-js Diagram)
```

### Scan fields used

Interactions reads `SolutionBpmnModelEntry` rows from the shared scan. Per process it uses:

| Field | Use |
|---|---|
| `communicationEvents` | One port per event; `kind` / `direction` / `name` / `position` / attachment / `location` / `correlationRetrievalExpression` |
| `correlationKey` | Shown in the Properties pane for a selected process |
| `uri`, `sha256` | Process identity and generation signature (stale detection) |

Unnamed message or signal references (`name: null`) still become ports with a warning label; they never connect. `buildProcessRelations` in the landscape module filters `name !== null` and is unrelated to this view.

### Graph rules (`buildInteractionGraph`)

**Path:** `studio/src/modules/bpmn-interactions/buildInteractionGraph.ts`

- Port id: `<uri>#<processId>#<flowNodeId>`.
- Partners: same `kind`, same non-null `name`, opposite `direction`, different `processId` (same id in another file counts as a different process). Same-process pairs never connect.
- **Direct:** one line per throw/catch pair in view.
- **Stations:** one station per `(kind, name)` with at least one throw and one catch port in view; lines run port → station → port.
- Stubs (`→ N outside the view` / `N outside the view ←`) when partners exist in the solution but are not selected; the orange **Unconnected** warning glyph (`showNoPartnerInSolutionGlyph`) when a named port has no partner anywhere in the catalog.
- `hideProcessesWithoutInteraction` drops selected processes with no line in the current graph.
- Output order is deterministic (process label, kind, direction, name, flow node id).

### Layout (`layoutInteractionGraph`)

**Path:** `studio/src/modules/bpmn-interactions/layoutInteractionGraph.ts`

ELK layered layout, direction `RIGHT`, orthogonal edges. Process nodes expose fixed-order ports (catch `WEST`, throw `EAST`). Direct mode sets `elk.layered.mergeEdges: true`. Station nodes are small pills between throw and catch sides.

### Document model (`InteractionsDocumentModel`)

**Path:** `studio/src/modules/bpmn-interactions/InteractionsDocumentModel.ts`

| Concern | Behaviour |
|---|---|
| Selection | Session-only list of `{ uri, processId }`; `setProcessesSelected(references, selected)` applies bulk select or clear in one revision bump. The Processes pane shows a tri-state checkbox per file and per process plus a master checkbox beside the filter. File and master checkboxes both act on, and show the state of, only the processes the filter lists (`listedProcessesCheckboxState`). The document outlives the solution, so a `solutionChanged` with a different solution id (another solution, or none) clears the selection, the generated diagram and the stale signature and drops a running generation; file changes inside the same solution keep them |
| Generation | `scan.refresh()` → `buildInteractionGraph` → `layoutInteractionGraph` → `viewer.importLayout`; stores `generationSignature` from sorted catalog `uri:sha256` plus selection |
| Stale | `isStale()` when signature differs from last generation (catalog or selection change); metadata `stale` drives Regenerate label and “Out of date” |
| Settings change | Layout / hide toggles re-run graph + layout on last catalog without rescan |
| Metadata | `viewbox`, `selectionRevision`, `generationRevision`, `settingsRevision`, `focusMode`, `generating`, `stale` — not the process selection |
| Viewer | `attachTo` / `detach` on the renderer canvas host; stub clicks call `addPartnersOutsideViewAndGenerate` |

### Viewer (`InteractionsViewer`)

**Path:** `studio/src/modules/bpmn-interactions/viewer/InteractionsViewer.ts`

Read-only diagram-js stack: selection, outline, overlays, zoom scroll, minimap, search pad, tooltips. **No** modeling modules or plugin hooks. `InteractionsRenderer` draws process boxes, port glyphs (`portGlyphs.ts`: drawn at the 36 px bpmn-js event size with `BpmnRenderer`'s radii, stroke widths, dash pattern and `PathMap` markers, then scaled to the 24 px `PORT_SIZE` of `layoutInteractionGraph.ts`), station pills, orthogonal connections, stub groups (`.interactions-port-stub`; the stylesheet turns pointer events back on for them, because diagram-js disables them on every `.djs-visual`), unconnected-port warning groups (`.interactions-port-warning`, same pointer-events override and an SVG `<title>`), and port labels inside the process box (a label that does not fit is cut to one line with “…” and keeps the full text in a `<title>`). API: `importLayout`, `exportSvg` (with `replaceThemeColorsInSvg`), focus mode, zoom helpers, `select` / `reveal`, search toggle, `destroy`.

### Renderer and panes

| Component | Path |
|---|---|
| Title bar + toolbar + empty states | `InteractionsDocumentRenderer.tsx` — Debugger-style `EditorTitle` (solution name, selection count, diagram freshness) and three-group `EditorToolbar` (icon-only toggles including Generate; zoom in the centre group; help on the right) |
| Processes pane | `panes/InteractionsProcessesPane.tsx` — tree from `interactionsProcessTree.ts` with `checkboxState` on file and process rows; master checkbox `data-test--interactions-select-all-processes` beside the filter; double-click → `std.editor.gotoSymbolInDocument` |
| Properties pane | `panes/InteractionsPropertiesPane.tsx` — diagram summary (two actionable buttons when a graph exists), event-specific port fields, read-only detail for process / line / station |

### Registration

**Path:** `studio/src/modules/bpmn-interactions/index.tsx` (loaded after `bpmn-landscape`)

| Item | Value |
|---|---|
| Page | `discover/interactions` (`defaultDocumentUri: interactions://solution`, `editorTabsVisible: false`) |
| Document type | `bpmn-interactions-map`, `uriMatch /^interactions:\/\/solution$/` |
| Settings (solution scope) | `bpmn.interactions.layout`, `bpmn.interactions.hideProcessesWithoutInteraction`. `interactions://solution` lies in no project, so URI-based resolution would only reach User; `readInteractionsSetting` / `writeInteractionsSetting` (`InteractionsDocumentModel.ts`) use `inspectForTarget` / `setInScope` with the Solution layer, and User when no `.bfwsln` is open. The model's change subscription has no resource, so Solution-layer writes reach it |
| Left pane group | `interactions` → Processes pane |
| Right pane | Properties prepended to `property` group |
| Context menu | `bpmn/interactions/element` |
| Keybindings | `F` focus, Cmd/Ctrl+F find — scoped to `.kbm-editor[data-editor-document-type=bpmn-interactions-map]` |

### Commands

**Path:** `studio/src/modules/bpmn-interactions/commands.ts`, `exportCommands.ts`

| Command | Purpose |
|---|---|
| `bpmn.interactions.generate` | Generate / regenerate |
| `bpmn.interactions.toggleHideProcessesWithoutInteraction` | Solution setting |
| `bpmn.interactions.setLayout` | `direct` \| `stations` (not in command search) |
| `bpmn.interactions.toggleFocusMode` | Dim unrelated shapes |
| `bpmn.interactions.find` | Open search pad |
| `bpmn.interactions.openElement` / `openElementInTextEditor` | Designer or text editor for process or port |
| `bpmn.interactions.addPartnersOutsideView` | Add one port's stub partners to selection via `setProcessesSelected` (optional `portId`) |
| `bpmn.interactions.addAllPartnersOutsideView` | De-duplicate every stub partner in the graph, add them, regenerate |
| `bpmn.interactions.revealNextUnconnectedPort` | Cycle through ports with the unconnected warning glyph (`viewer.reveal`) |
| `std.editor.zoomToViewport` / `zoomToActualSize` / `zoomToSelectedElement` (`.bpmn-interactions-map`) | Zoom |
| `std.editor.showExportDialog.bpmn-interactions-map` / `exportDocumentAs.bpmn-interactions-map` | PNG / JPEG / WebP / SVG; default `<solution-basename>-interactions.png` next to the `.bfwsln`, else `<project>-interactions.png` in the first project folder |

When `APP_TEST=true`, `bpmn.interactions.test.selectProcesses`, `.generate`, `.getGraphSummary`, `.isStale` support the integration suite.

### Export

Image export follows `bpmn-core/ImageExportFunctions.ts` (raster via `renderSvgToRasterImage` inside `runWithExportHint`). Tests stub `bifrost.dialog.showSaveFile` like the landscape suite.

### Test hooks (`data-test--`)

| Attribute | Location |
|---|---|
| `interactions-selection-count` | Title centre (selection label) |
| `interactions-diagram-state`, `interactions-stale` (only while out of date) | Title right |
| `interactions-export` | Toolbar left |
| `interactions-generate`, `interactions-hide-without-interaction`, `interactions-layout-direct`, `interactions-layout-stations`, `interactions-zoom-to-viewport`, `interactions-zoom-to-actual-size` | Toolbar centre |
| `interactions-select-all-processes` | Processes pane header (master checkbox) |
| `tree-entry-checkbox` | Tree row checkbox (`HeadlessTreeItem`, Interactions Processes pane) |
| `interactions-focus`, `interactions-find`, `interactions-help` | Toolbar right |
| `interactions-empty`, `interactions-canvas` | Renderer content |
| `interactions-process-filter` | Processes pane |
| `interactions-properties-summary`, `interactions-summary-add-all-partners`, `interactions-summary-next-unconnected`, `interactions-properties-next-unconnected`, `interactions-properties-open`, `interactions-properties-add-partners` | Properties pane |
| `interactions-stub`, `interactions-port-label` | Canvas SVG |

---

## File Path Reference

| Component | Path |
|---|---|
| Module entry | `studio/src/modules/bpmn-interactions/index.tsx` |
| Graph | `studio/src/modules/bpmn-interactions/buildInteractionGraph.ts` |
| Layout | `studio/src/modules/bpmn-interactions/layoutInteractionGraph.ts` |
| Document model | `studio/src/modules/bpmn-interactions/InteractionsDocumentModel.ts` |
| Renderer | `studio/src/modules/bpmn-interactions/InteractionsDocumentRenderer.tsx` |
| Viewer | `studio/src/modules/bpmn-interactions/viewer/InteractionsViewer.ts` |
| Diagram rendering | `studio/src/modules/bpmn-interactions/viewer/InteractionsRenderer.ts` |
| Port glyphs | `studio/src/modules/bpmn-interactions/viewer/portGlyphs.ts` |
| Commands | `studio/src/modules/bpmn-interactions/commands.ts` |
| Export | `studio/src/modules/bpmn-interactions/exportCommands.ts` |
| Processes pane | `studio/src/modules/bpmn-interactions/panes/InteractionsProcessesPane.tsx` |
| Properties pane | `studio/src/modules/bpmn-interactions/panes/InteractionsPropertiesPane.tsx` |
| Process tree builder | `studio/src/modules/bpmn-interactions/interactionsProcessTree.ts` |
| Styles | `studio/src/modules/bpmn-interactions/styles/interactions.scss` |
| User help | `studio/src/modules/bpmn-interactions/texts/interactions.md` |
| Integration tests | `studio/test/integration/bpmn-interactions/` |
| Fixture | `studio/test/fixtures/test-solution-interactions/` |
