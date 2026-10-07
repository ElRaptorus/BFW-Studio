# DMN Decision Simulator

## Overview

The `dmn-decision-simulator` module (`studio/src/modules/dmn-decision-simulator/`) evaluates a decision or decision service of the open DMN document inside the Studio, without an Engine. It is a TypeScript port of the Engine's DMN evaluator on top of `@bpmn-io/feelin`, plus a DRD overlay UI. Import resolution across solution files is shared with the DMN editor ([dmn-editor.md](dmn-editor.md)). Results render through `EvaluationResultView`, which `dmn-core` owns (`modules/dmn-core/evaluation-result/`) and exports, so the Engine decision viewer uses it without importing this module. The Engine stays authoritative; see "Known parity limits".

## Layers

| Layer | Path | Purpose |
|-------|------|---------|
| Core (pure TS, no DOM) | `core/` | `evaluateDmnSimulation(request)` entry; `feel.ts`, `decisionTableEvaluator.ts` + `hitPolicies.ts`, `boxedExpressionEvaluator.ts`, `bkmInvoker.ts`, `dependencyResolver.ts`, `importResolution.ts`, `loadSimulationModels.ts`. File split mirrors the Engine's `core_dmn` evaluator. |
| Worker | `worker/` | `DmnSimulationWorkerClient` runs the core in a module Worker, 5 s timeout (`simulation_timeout`, `simulation_worker_error`). One evaluation at a time (the controller refuses to start a run while one is `running`). A failure terminates only the client's own worker; `postMessage` exceptions and `messageerror` resolve as `simulation_worker_error`. |
| Session | `DmnSimulatorSession.ts` | Per-document store (snapshot, input texts). Input texts are never written to `currentData` or `metadata`. Snapshot fields: `status`, `target`, `outcome`, `unresolvedImports`, `ambiguousImports`, `importedModelUris`, `importedInputs`, `replayIndex`, `stale`. `getLatestVisibleStepPerElement()` feeds the badges; `renameInputText()` carries typed text across an input data rename; `clearResult()` keeps inputs and target. |
| DRD integration | `DmnSimulatorBridge.ts`, `DmnSimulatorPaletteProvider.ts`, `DmnSimulatorController.ts` | diagram-js service registered through `dmn.modeler.registerModule`. The bridge owns the controller and the table highlighter and disposes both on `diagram.destroy`. |
| Panel | `components/DmnSimulatorPanel.tsx`, `components/outcomeSummary.ts`, `mountDmnSimulatorPanel.tsx` | Top-center control pad in the DRD container (see "Panel"). |
| Table highlight | `DmnSimulatorTableHighlighter.ts` | Marks matched/unmatched rule rows (`dmn-sim-rule-matched` / `-unmatched`) in the decision-table view via a MutationObserver, using `RuleTrace` ids from the session. Highlights nothing while the result is `stale`. Adds a `dmn-sim-table-legend` element while at least one row is classed, and removes it otherwise. |

## Command

`dmn.simulator.toggle` takes an optional bridge argument. `resolveSimulatorDocument(bifrost, bridge?)` in `index.ts` finds the target: with a bridge (palette click) the open `dmn` document whose DRD viewer owns that bridge, otherwise the focused document. `enabledWhen` and the handler use the same helper, and both require the DRD view to be active. `DmnSimulatorHost` is `{ uri, bifrost, adapter }`; the XML for a run comes from `adapter.getXml()` (includes unsaved edits).

## Overlay lifecycle

dmn-js clears the whole DRD (`diagram.clear`, which removes every overlay and marker) when the user opens a decision table and again before every XML re-import. While active, the controller therefore listens on the DRD event bus:

| Event | Reaction |
|-------|----------|
| `diagram.clear` | Forget overlay entries (React roots unmounted deferred, no `overlays.remove`), forget markers. A running replay continues, so the DRD never comes back with a half-finished replay. |
| `import.done` | Re-create the static overlays (input fields, play buttons) and re-render the outcome. |
| `elements.changed` | Coalesced per animation frame: rebuild the static overlays and re-render the outcome, so added, removed and renamed shapes are followed. |

`showStaticOverlays` tracks `inputNameByElementId`; when an input data is renamed, its typed text moves to the new name. The palette entry's active state is toggled directly on the DOM (`.djs-palette [data-action="dmn-sim-toggle"]`, class `dmn-sim-palette-entry--active`); diagram-js has no public palette refresh.

## Runs, stale results, replay

- `run()` captures a run sequence number; `deactivate()` and every new run increment it. A result that arrives for an older sequence is dropped.
- While active, `EVENT_DMN_ADAPTER_XML_CHANGED` / `EVENT_DMN_ADAPTER_XML_LOADED` set `stale: true` when an outcome exists (and mark a run in flight as stale). The panel shows "The model changed after this run — run again."; table highlights are hidden because rule ids may have changed. DRD badges stay until the next run or Reset.
- After a run with two or more steps the controller animates `replayIndex` from 0 through the last step (`REPLAY_STEP_MILLISECONDS = 250`), then shows the final state (`null`). One timer; cleared on run start, Reset, a manual replay click and deactivate.
- Rendering: one badge and one marker set per local element (latest visible step), `dmn-sim-current` on the replay step's element, `dmn-sim-evaluated-edge` on incoming requirement connections between evaluated elements, `dmn-sim-target` on the started element.

## Panel

A control pad styled like the Token Simulator toolbar but with its own `dmn-sim-panel__*` classes. `.dmn-sim-panel-container` sits at `top: 10px`, horizontally centered, `z-index: 176`: above the minimap (175), below the diagram-js popup menus (200, 1000).

- **Bar** (`__actions`): Run and Run again (both re-run `snapshot.target`), Reset (clears the result, keeps inputs), first / previous / next / final-state replay with an `n/m` counter, Details, help (`std.help.openToTheSide ['dmn/simulator']`, text in `texts/dmn-simulator.md`, registered in `onLoad`), Close. Details carries a dot (`__attention`) while imported inputs or import warnings exist.
- **Strip** (`__strip--hint | value | error | stale`): one line from `summarizeOutcome` in `outcomeSummary.ts`. Priority: running, no outcome (input hint, mentions Details when imported inputs exist), error (a short pointer only; the controller's `notifyError` opens an error notification with `code: message`, source "Decision Simulator"), stale, value (`<target> = <JSON>`, hit policy tag, duration).
- **Drawer** (`__drawer`, opened only by Details, local React state, capped at `45vh`): unresolved-import warnings, an ambiguity warning per namespace provided by several solution files (the loader uses the first file and reports `ambiguousImports`), inputs of imported models (the same input chip as on the diagram), the full outcome (`EvaluationResultView`; decision services via `toEvaluationResult`), and the step list. Steps of imported models show an "Open" link (`std.editor.gotoSymbolInDocument`) using `importedModelUris`.

Input chip (`DmnSimulatorInput`, `.dmn-sim-input`, `--unset` until a value is set): a wrench button below each input data shape and in the drawer. A click opens `editInput`, a `bifrost.dialog` with a medium multi-line editor (`type: 'json'`, `language: 'plaintext'`; there is no FEEL language support), and Apply writes the text via `session.setInputText`. The pad root stops `mousedown` only, never `keydown`: a focused pad button must not swallow global shortcuts such as Ctrl+Shift+P.

Colours: every `--dmn-sim-*` variable is defined once on `.bifrost` from `--theme-*` tokens (`color-mix` for translucent fills), so panel, badges and table highlights follow every theme without a block in the theme files.

## Semantics

- Inputs are FEEL texts per input data variable name. An applied empty value is `null`; an input never set is absent and fails with `missing_required_input` (Engine semantics). Unresolved names are hard errors (`feel_evaluation_error`).
- Imports: `loadSimulationModels` reads the transitive closure from the solution (`scanSolutionDmnModels`), keyed by namespace. Imported models are read from disk, not from unsaved tabs. Recursion depth is limited (default 10).
- Qualified references split on the first `#` (Engine, validator and simulator agree; the single implementation is `dmn-core/qualifiedReference.ts`).
- Errors are `SimulationError` codes (`missing_required_input`, `import_not_found`, `drg_cycle`, `bkm_cycle`, `input_value_violation`, `missing_service_input`, ...). A failure that occurs before the target recorded a step still records an error step on the target (`recordTargetErrorStep`).
- Every step records `rules` for decision tables, which drive row highlighting. BKM steps carry the namespace of the model that owns the BKM, also for chains inside imported models (`EvaluationEnvironment.namespace`).
- `serializeFeelValue` drops `undefined` object properties (like JSON).
- Knowledge requirements resolve to business knowledge models only, as in the Engine; the Imported Requirements pane therefore offers BKMs only.
- Decision services take no separate service inputs: their input decisions are evaluated by the simulator itself, as the Engine does.

## Known parity limits

Behaviour the simulator mirrors from the Engine and that would need Engine work to change: priority key/list ordering and comma-split priority lists, numeric priorities compared as strings, output entries evaluated without context, boxed invocation that only reaches local BKMs, eager BKM binding with unbound parameters.

## Tests

`test/unit/dmn-decision-simulator/`. `parity.test.ts` runs the Engine conformance cases C40–C61 (`parityCases.ts` table, fixtures in `test/fixtures/dmn-simulator-parity/`; C43 and C47 are Engine deploy/lookup cases and are covered by the dependency resolver test). `evaluationWithImports.test.ts` covers BKM namespaces in imported chains, the target error step and loader URIs/ambiguity; `workerClient.test.ts` the worker client (fake `Worker`); `simulatorSupport.test.ts` the session. `tableHighlighter.test.ts` covers highlighting, stale and the legend. The controller needs the DOM and React roots and is covered by `test/integration/dmn-editor/dmn-simulator.test.ts`.
