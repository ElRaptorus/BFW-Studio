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
| `engine.deploy.rescanExplorer` | Rescan the solution in the Explorer (module-local event, `onExplorerRescanRequested`) |
| `engine.deploy.setExplorerMode(mode)` | Set `file` or `project` on the plan model (shared by Explorer and plan page) |
| `engine.deploy.loadPackage(name)` | Replace the plan with a package; vanished files are skipped with a warning |
| `engine.deploy.savePlanAsPackage` | Prompt for a name (overwrite is confirmed) and save the plan |
| `engine.deploy.deletePackage(name)` | Confirm and delete |
| `engine.deploy.deployPlan` | Deploy; `enabledWhen` is `model.canDeploy()` |
| `engine.workspace.deployBpmnFile(engineId, filePath, options?)` | Registered by `engine-workspace`; reusable single-file BPMN deploy |

## Single-file BPMN deploy

`engine-workspace/deploy/deployBpmnFile.ts` is the one deploy core for a BPMN file: read, `engine.ensureProcessVersions` (writes the file when versions were added), `engine.deploy`, and up to three `engine.resolveVersionConflicts` retries on `version_exists`. It returns `deployed`, `cancelled` or `failed` and never opens notifications; `deployFocusedBpmnFile` and the plan wrap it. Linter-gate failures (422 `linter_gate_failed`) are mapped by `remapFailuresToFileNames` (`engine-core/commands/registerDeployCommands.ts`) into `DeployFailureDetail { fileName, details, rulesetFailures }`; `formatRulesetFailure` renders `rulesetId: check expected X, actual Y`.

The header Deploy button is hidden on `deploy/*` (`ENGINE_HEADER_DEPLOY_PAGES`).

## Explorer

The pane header holds a packages dropdown icon and the rescan icon; the pane toolbar holds the Files / Folders toggle. The mode lives on `DeployPlanDocumentModel` (`getExplorerMode` / `setExplorerMode`, view state in metadata) and also switches the plan page between the file view and the folder view. The plan's own Refresh is in the plan toolbar. Both modes show the folder tree below the solution roots (a single root is flattened). **Files** adds the model files as leaves (invalid entries carry an error badge); **Project** shows folders only, each with a model-count badge. Items carry `DeployExplorerMetadata` (`kind`, `uri`, `modelUris`); folder metadata has a `uri` because context-menu selection compares metadata by `uri`. Double-click and Enter add to the plan; the context menus are `engine/deploy-explorer/item` and `engine/deploy-explorer/multi-selection`.

## Plan page

`DeployPlanRenderer` uses the Engine Workspace layout: `EditorTitle` (rocket icon, `EngineContextBreadcrumb`), then a toolbar (count line left; add-missing-dependencies, filter input, refresh centered; settings, auth key, Deploy right). Row arrays are memoized on `DeployPlanDocumentModel.getRevision()` (bumped by every change the tables show); a new `data` identity would reset the table's page index. Both views are the shared `Table` with `manualFiltering` (the components filter themselves), client-side pagination (default 50, options 25/50/100/250) and column filters.

- **File view** (`DeployPlanFilesTable`): the row selection *is* the include state; selection changes are applied to the model as a diff (`setManyIncluded`). Unreadable files cannot be ticked. Columns: File (with muted folder), Kind, Status, Versions, Dependencies, Linter, Result, remove. Versions and Linter sort (Linter by the file's lowest stored score; files without a score last). The column filters live in the renderer so the count line can show `· N shown by filter`.
- **Folder view** (`DeployPlanFoldersTable`, `summarizeDeployFolders`): one row per direct parent folder, with a tri-state include checkbox, status badges with counts, and the average stored linter score per ruleset coloured by the worst verdict in the folder. Versions and Dependencies are not shown.
- **Badges** (`components/formatDeployBadges.ts`, `DeployBadges.tsx`): status is a short coloured badge with the explanation as tooltip; linter scores read `Dev: 92,6%` / `Prod: 77,3%` and are coloured by the stored compliance status (`valid` / `risky` / `failed`).

## Packages

Setting `engine.deploy.packages` (scope `solution`): `{ name, files[] }[]`, files relative to the folder of the `.bfwsln` (or the opened folder). Reads and writes pass the first project root as the resource so the value lands in the Solution layer. The Explorer dropdown is the menu `engine/deploy-explorer/packages`, rebuilt from the setting each time it opens (Load entries, Save Plan as Package…, Delete Package submenu). Pure helpers: `analysis/deployPackages.ts`.

## Keybinding scope

The File Explorer tree keys (Enter and F2 rename, Backspace and Delete) are bound to `.kbm-file-explorer`, not `.kbm-treeview`. `Tree` always adds `kbm-treeview`, so a binding on it would also fire in the Deploy Explorer and act on the File Explorer selection. Other trees need their own class.

## Test hooks

`data-test--deploy-button`, `data-test--deploy-add-missing-dependencies`, `data-test--deploy-blocked-reason`, plan rows `data-test--table-row="<file uri>"` (folder view: folder path), `data-test--deploy-item-status` (file rows), `data-test--deploy-folder-status` (folder rows), `data-test--deploy-folder-include="<folder>"`, `data-test--deploy-explorer-mode="file|project"`, `data-test--deploy-explorer-rescan`, `data-test--deploy-packages-menu`, tree `data-test--tree="engine/deploy-explorer"`. Tests: `test/unit/engine-deploy/`, `test/integration/deploy/engine-deploy.test.ts`.
