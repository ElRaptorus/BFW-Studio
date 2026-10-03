# Deploy

## Overview

The `engine-deploy` module owns the Deploy category's page `deploy/plan`. The user picks BPMN and DMN files in a read-only Deploy Explorer; the page `deploy://plan` analyses them against the active Engine and deploys one request per file, DMN first. Engine connectivity and the shared deploy commands: [engine.md](engine.md). The file scan: [modules.md](modules.md) §solution-models. Category and page registry: [workbench-categories.md](workbench-categories.md).

## Module (`studio/src/modules/engine-deploy/`)

| Part | Path | Purpose |
|---|---|---|
| Module entry | `index.tsx` | Registers icons, page `deploy/plan` (`defaultDocumentUri: 'deploy://plan'`, `editorTabsVisible: false`), document type `engine-deploy-plan` (uri `/^deploy:\/\/plan$/`), left pane group `deploy-explorer` (`pages: ['deploy/plan']`), the item pane, menus, keybinding and commands |
| Model | `models/DeployPlanDocumentModel.ts` | Session-only plan state; one document, `DEPLOY_PLAN_URI = 'deploy://plan'` |
| Renderer | `renderers/DeployPlanRenderer.tsx` | Toolbar, blocked-reason notice, item table |
| Panes | `panes/DeployExplorerPane.tsx`, `panes/DeployItemDetailsPane.tsx` | Read-only explorer (left); selected item details (right `property`, shown for `deploy://plan` while an item is selected) |
| Commands | `commands.ts` | See below |
| Analysis | `analysis/*` | Pure functions, no Bifrost access |

The plan set is not persisted. `analysisRevision` and `selectionRevision` are the only values written to metadata (see the editor document data-placement rule in [editor-documents.md](editor-documents.md)).

## Analysis

| File | Function | Result |
|---|---|---|
| `fetchEngineSnapshot.ts` | `fetchEngineSnapshot(client, processIds, decisionIds)` | `EngineSnapshot`: health, deployed process versions with the SHA-256 of the stored XML, deployed decision versions. Fetches versions only for ids the plan references. Any error yields `health.ok = false` with empty maps |
| `analyzeDeployPlan.ts` | `analyzeDeployPlan({ planUris, entries, snapshot, connection, unsavedUris })` | `DeployAnalysis`: global blockers, per-item analysis, dependencies |
| `analyzeDeployPlan.ts` | `getDeployBlockedReason(analysis, includedUris)` | First reason Deploy is disabled, or `null` |
| `executeDeployPlan.ts` | `executeDeployPlan(files, deployFile)` | `DeployItemResult[]`; DMN first, continues after a failure or cancel, thrown errors become `failed` |
| `buildDeployExplorerTree.ts` | `buildDeployExplorerTree(entries, roots, mode)` | Explorer `TreeItem[]` |

Process status per executable process: `new`, `newVersion`, `unchanged` (same version and SHA-256), `changedWithoutVersionBump` (same version, different SHA-256), `versionMissing`, `skipped` (non-executable), `unknown` (Engine unreachable). A file takes the highest-ranked status of its processes. A DMN is `unchanged` when the first 12 hex characters of its SHA-256 are a deployed version (the Engine derives DMN versions that way and stores the XML verbatim). Dependency states: `inPlan`, `onEngine`, `localNotInPlan`, `missing`, `unknown`; local files outside the plan are followed transitively. Blockers: no active Engine, not connected, Engine not reachable (failed health check), connected but without a client (treated as offline), unsaved changes in an included file, invalid or missing file, missing `deploy_bpmn` / `deploy_dmn` capability, DMN without a definitions id.

Defaults (`includedByDefault`) apply once per item: unchanged, skipped and invalid files are not ticked, every other status is (version-missing files then get the version dialog on deploy). They are applied after the first healthy snapshot or when the Engine is offline. An unhealthy snapshot is not stored: the model keeps its message (`engineUnavailableMessage`, blocker `Engine is not reachable: …`), statuses stay `unknown` and no defaults are applied. Items defaulted while offline (`defaultedWithoutEngineState`) get their defaults chosen again once a healthy snapshot arrives, unless the user toggled them (`setIncluded`).

The plan table shows icon, file name with the folder as a muted second line (`describeDeployItemLocation`: relative to the project root, prefixed with the project name in a multi-root solution), kind, status, versions, dependencies, stored linter summary and result. Blocker reasons use the same `folder/fileName` prefix. Deploy is blocked for the whole plan while an included item has a blocker (offline, invalid); there is no per-item `skipped` result.

## Model

`DeployPlanDocumentModel` keeps `planUris`, `includedUris`, `selectedUri`, `entries`, `snapshot`, `analysis` and `results` as private fields behind getters. `refresh()` scans (`solution.models.scan`), fetches the snapshot and recomputes; a sequence counter discards stale runs. `recomputeLocal()` re-analyses without network. Triggers:

- `engine:connected`, `engine:disconnected`, `engine:connection-lost`, `engine:reconnected`, `engine:auth-token-changed`, and a settings change touching the active Engine: `refresh()`.
- `EVENT_EDITOR_DOCUMENT_DATA_UPDATED`, debounced 300 ms, and document focus: `recomputeLocal()` (unsaved changes).

`deploy()` runs `executeDeployPlan` over the included files, un-includes the deployed ones and refreshes. BPMN goes through `engine.workspace.deployBpmnFile`; DMN reads the file and calls `engine.deploy`. Subscriptions are disposed in `onEditorDocumentWillClose`.

## Commands

| Command | Purpose |
|---|---|
| `engine.deploy.addToPlan(uris)` | Open the plan page and add files |
| `engine.deploy.addSelectedToPlan` | Add every model below the Explorer selection (`collectSelectedModelUris`) |
| `engine.deploy.removeFromPlan(uri)` | Remove a file |
| `engine.deploy.addMissingDependencies` | Add the `localNotInPlan` dependencies |
| `engine.deploy.refreshPlan` | Rescan and re-fetch |
| `engine.deploy.deployPlan` | Deploy; `enabledWhen` is `model.canDeploy()` |
| `engine.workspace.deployBpmnFile(engineId, filePath, options?)` | Registered by `engine-workspace`; reusable single-file BPMN deploy |

## Single-file BPMN deploy

`engine-workspace/deploy/deployBpmnFile.ts` is the one deploy core for a BPMN file: read, `engine.ensureProcessVersions` (writes the file when versions were added), `engine.deploy`, and up to three `engine.resolveVersionConflicts` retries on `version_exists`. It returns `deployed`, `cancelled` or `failed` and never opens notifications; `deployFocusedBpmnFile` and the plan wrap it. Linter-gate failures (422 `linter_gate_failed`) are mapped by `remapFailuresToFileNames` (`engine-core/commands/registerDeployCommands.ts`) into `DeployFailureDetail { fileName, details, rulesetFailures }`; `formatRulesetFailure` renders `rulesetId: check expected X, actual Y`.

The header Deploy button is hidden on `deploy/*` (`ENGINE_HEADER_DEPLOY_PAGES`).

## Explorer

The pane toolbar holds the Files / Folders toggle and the rescan button; the plan's own Refresh is in the plan toolbar. Both modes show the folder tree below the solution roots (a single root is flattened). **Files** adds the model files as leaves (invalid entries carry an error badge); **Project** shows folders only, each with a model-count badge. Items carry `DeployExplorerMetadata` (`kind`, `uri`, `modelUris`); folder metadata has a `uri` because context-menu selection compares metadata by `uri`. Double-click and Enter add to the plan; the context menus are `engine/deploy-explorer/item` and `engine/deploy-explorer/multi-selection`.

## Keybinding scope

The File Explorer tree keys (Enter and F2 rename, Backspace and Delete) are bound to `.kbm-file-explorer`, not `.kbm-treeview`. `Tree` always adds `kbm-treeview`, so a binding on it would also fire in the Deploy Explorer and act on the File Explorer selection. Other trees need their own class.

## Test hooks

`data-test--deploy-button`, `data-test--deploy-add-missing-dependencies`, `data-test--deploy-blocked-reason`, `data-test--deploy-item="<file uri>"`, `data-test--deploy-item-status`, `data-test--deploy-explorer-mode="file|project"`, tree `data-test--tree="engine/deploy-explorer"`. Tests: `test/unit/engine-deploy/`, `test/integration/deploy/engine-deploy.test.ts`.
