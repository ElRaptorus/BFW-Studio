# Git Cruiser

---

## Overview

`git-cruiser` is a standalone module providing full Git integration for Bifrost Forge World. It detects Git repositories in opened solutions, visualizes file status throughout the UI (file explorer, open editors, dedicated pane, status bar), and provides core Git operations (stage, commit, push, pull, revert, stash, branch management). Git itself is reached only through the core service `bifrost.sourceControl` ([source-control.md](source-control.md)); git-cruiser holds the repository state and all git UI, and imports neither `electron` nor `fs`.

---

## Design › Source page

git-cruiser registers the page `design/source` (`index.ts`) and its left group `git` with `pages: ['design/source']` (`initializers/initializePanes.ts`). The default document of the page is the Source Overview (`defaultDocumentUri: 'git:overview'`, see below). The Source-only document types are `git.overview`, `git.text-diff`, `bpmn.diff` and the BPMN history preview (`bpmn-diff`), `dmn.diff` and the DMN history preview (`dmn-diff`), and `merge:` (`MERGE_DOCUMENT_TYPE`). Show Diff, File History and the merge resolver therefore land on Source through routing rule R1 ([workbench-categories.md](workbench-categories.md)). `git.focusGitPane` calls `setVisibilityOfPaneAreaByPaneId('design/source/git', true)`, which activates `design/source` first. The branch status bar item keeps `git.switchBranch` on click; during a merge it runs `git.merge.openResolver`, which opens on Source.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  git-cruiser module (renderer)                         │
│                                                        │
│  ┌─────────────────┐  ┌─────────┐  ┌────────────────┐  │
│  │ RepositoryStore │  │ GitPane │  │ Initializers   │  │
│  │ (state, refresh │  │ (React) │  │ commands, menus│  │
│  │  after writes)  │  └─────────┘  │ statusBar, ... │  │
│  └────────┬────────┘               └───────┬────────┘  │
│           │ writes                         │ reads     │
├───────────┼────────────────────────────────┼───────────┤
│           ▼                                ▼           │
│  bifrost.sourceControl (SourceControlService)          │
│  → SourceControlServiceElectron → IPC → main process   │
└────────────────────────────────────────────────────────┘
```

### Renderer Side

#### RepositoryStore

**Path:** `studio/src/modules/git-cruiser/RepositoryStore.ts`

Module-level instance created in `index.ts`; documents and panes reach it through the `git.getRepositoryStoreRef` command. It holds the module's view of the solution's repositories. Key responsibilities:

- **Status cache**: `Map<repositoryRoot, SourceControlRepositoryState>` maps each detected repository root to its current state
- **File history cache**: `Map<uri, boolean | 'pending'>`. `hasFileHistory(uri)` returns `true` unless a completed check stored `false` (fewer than two commits). A cache miss starts a background `bifrost.sourceControl.getLog`; unknown and `'pending'` stay enabled so `executeCommand('git.showFileHistory')` is not rejected on the first call. `emitStatusChanged` clears this map.
- **Repo detection**: Iterates solution projects, calls `bifrost.sourceControl.findRepositoryRoot` for each
- **Debounced refresh**: Uses `lodash.debounce` on `scheduleRefresh()` to coalesce multiple triggers
- **Operation methods** (each refreshes the repository afterwards): `stage`, `unstage`, `commit` (joins title and body with a blank line), `push`, `pull`, `revert`, `stash`, `stashApply`, `switchBranch`, `createBranch`, `remove`, `mergeAbort`, `rebaseAbort`, `rebaseContinue`, `cherryPickAbort`, `cherryPickContinue`; `clone` and `connectFolderToRemote` re-detect repositories. `pull` also reports `merge-conflicts` when a successful pull left conflicted files.
- **Read-only queries** (`getFileContentAtRevision`, `getLog`, `getBranches`, `stashList`, `getConflictBlobs`, `getChangedFilesBetween`, `getMergeBase`, `listRemoteBranches`, `onCloneProgress`, `fetch`) are not wrapped; callers use `bifrost.sourceControl` directly.
- **History paging**: `getHistory(repositoryRoot, skip, searchText = '', maxCount = 100)` adds the branch's upstream from the cached state and returns a `HistoryPage` (`{ entries, hasMore }`). `commit` takes `CommitOptions` (`{ title, body? }`); both types live in `GitTypes.ts`.
- **Selected repository**: `setSelectedRepo` emits `sourceControlSelectedRepositoryChanged` when the value actually changes, so everything that follows the selected repository reloads: the Git pane, the git status bar items and the Source Overview.
- **Sync state flag**: `isSyncing: boolean` — set `true` during sync/fetch operations; drives the spinning status bar icon

Each operation method calls `refreshRepo()` after completing, which emits `sourceControlStatusChanged` and delegates to the `GitDecorationProvider.refresh()` for targeted UI updates (see [Tree Item Decorations](#tree-item-decorations)).

#### GitPane

**Path:** `studio/src/modules/git-cruiser/panes/GitPane.tsx`

React component registered as a left pane group. Uses SDK pane components extensively:

- **Repo selector** — `PaneProperty type="select"`, visible only when the solution contains 2+ git repositories. The selected repo is pane-local state. When the user switches, the pane re-renders with the chosen repo's state. Single-repo solutions see no selector.
- **Branch info bar** — `PaneInfoBar` with `PaneInfoBarItem` for branch name and ahead/behind counts, plus `PaneInfoBarAction` (command-driven) for Stash and Apply Stash actions.
- **Commit input** — `PaneProperty type="text"` for the title and `PaneProperty type="textarea"` for the optional body. Both use real-time `onChange` with `valueRef` props, which provide bidirectional ref-based state bridging. Command handlers read values directly from these refs (passed as `commandArgs`) and clear them after a successful commit; the `sourceControlStatusChanged` event then syncs the cleared refs back to `useState`.
- **Commit actions** — `PaneActionBar` with a `PaneActionSplitButton`. The main button triggers "Commit"; the dropdown caret opens the `git-cruiser/pane-commit-actions` menu with: Commit, Commit & Push, Commit & Sync, a divider, Commit to new Branch, Commit to new Branch & Sync. Each menu item is a `MenuItem_Command` with the title/body refs as `commandArgs`.
- **File tree** — Staged / Unstaged / Untracked file groups inside a `PaneBody`, using the `Tree` component with per-file hover action icons (stage/unstage via `actionIconOnHover`).

All icons are rendered via the host `Icon` component (`#components/Icon`). Subscribes to `sourceControlStatusChanged` events to refresh its state. When the event fires, the pane re-reads all repo states and resolves the selected repo (falling back to the first repo if the previously selected one no longer exists).

The main process side (handlers, argument validation, output parsing, IPC channels) is documented in [source-control.md](source-control.md).

---

## Module State Model

The module operates in one of three states:

| State | Condition | UI |
|-------|-----------|-----|
| **Active** | Git installed + `enabled = true` | Full functionality |
| **Git not found** | Git not in PATH | Status bar "Git not found", pane explains situation |
| **Disabled** | `enabled = false` | No visible UI at all |

State is determined by `RepositoryStore.isActive` (`isGitAvailable && isEnabled`). All visibility predicates and UI components check this flag.

---

## Repo Detection and Lifecycle

`RepositoryStore.detectRepos()` scans `solution.projects` and checks each project's `baseUri` via `bifrost.sourceControl.findRepositoryRoot`. It **rebuilds** the internal project-to-repo mapping from scratch on every call, discarding stale entries for removed projects or disappeared repos. Any `repoStateMap` entries without a corresponding project are also pruned.

**Triggers:**
- `solutionChanged` event (folder added/removed, solution opened/closed)
- `git.general.enabled` setting changed
- After clone/connect operations

**Reactivity to external changes:** There is no file watcher for `.git` directories. If a `.git` folder is created, moved, or deleted outside the Studio, the change is picked up on the next `detectRepos()` call (triggered by solution changes or manual refresh). `refreshRepo()` gracefully removes repos from the state map if the IPC status call fails (e.g., `.git` disappeared), preventing stale entries.

---

## Tree Item Decorations

**Path:** `studio/src/modules/git-cruiser/initializers/initializeDecorations.ts`

Uses an **event-driven, per-URI decoration system** (modelled after VSCode's `FileDecorationProvider`). The `GitDecorationProvider` class implements the SDK's `TreeDecorationProvider` interface:

### Architecture

```
RepositoryStore.refreshRepo()
  → decorationProvider.refresh(allRepoStates)
    → builds new Map<uri, decoration> from file + pre-aggregated directory statuses
    → computes symmetric difference (added/removed/changed URIs)
    → fires onDidChange(changedUris)
      → FileExplorerDecorationSource forwards to subscribers
        → useDecoration hook in affected HeadlessTreeItems triggers re-render
```

Only the 1–2 tree items whose status actually changed re-render, instead of the entire tree.

### Key Types (SDK)

- **`TreeItemDecoration`**: `{ styles?: Partial<TreeItemStyles>, badges?: TreeBadge[] }`
- **`TreeDecorationProvider`**: `provideDecoration(uri)` + `onDidChange(listener)`
- **`TreeDecorationSource`**: `getDecoration(uri)` + `subscribe(listener)` — mediates between providers and the React tree

### Provider Cache

`GitDecorationProvider` maintains an internal `Map<string, TreeItemDecoration>` pre-computed for **all files and directories** across all repos. When `refresh()` is called:

1. Builds a new Map from all `SourceControlRepositoryState.files` (file URIs → decoration) and aggregated directory URIs (worst-status child → decoration)
2. Computes the symmetric difference between old and new caches
3. Fires `onDidChange` with only the changed URIs
4. Replaces the cache atomically

`provideDecoration(uri)` is O(1) — a direct Map lookup.

### React Integration

- **`DecorationContext`** (`studio/src/components/Tree/DecorationContext.ts`): A React context providing the `TreeDecorationSource` to consumers
- **`useDecoration(uri)`**: Hook that subscribes to the source's change events. Re-renders **only** when `changedUris.has(thisUri)` — O(1) per subscriber per event
- **`Tree` component**: Accepts optional `decorationSource` prop, wraps items in `DecorationContext`
- **`HeadlessTreeItem`**: Calls `useDecoration(data.metadata?.uri)`, merges returned decoration with base `data.styles`/`data.badges`
- **`EditorTabDraggable`**: Calls `useDecoration(editorDocument.uri)` and applies `labelColor` as an inline style on the tab label. The `DecorationContext` is set up by `EditorTabsAndOptions` in `EditorWrapper.tsx`, using the same decoration source as the tree views.

### FileExplorerDecorationSource

**Path:** `studio/src/bifrost/common/activities/FileExplorerView.ts`

Implements `TreeDecorationSource` within `FileExplorerView`:
- Holds registered `TreeDecorationProvider[]`
- `getDecoration(uri)`: iterates providers, merges results — O(providers) per call (typically 1)
- `subscribe(listener)`: listeners receive `Set<string>` of changed URIs
- Forwards each provider's `onDidChange` events to all subscribers

Exposed via `bifrost.fileExplorerView.getDecorationSource()`, passed to the `Tree` in `SolutionPane.tsx` and `OpenEditorsPane.tsx`, and to the editor tab bar via `DecorationContext` in `EditorWrapper.tsx`.

### Status Colors

| Status | Token | Dark value | Light value | Badge |
|--------|-------|------------|-------------|-------|
| Modified | `--theme-git-modified` | `#E2C08D` | `#9C6B20` | `M` |
| Added | `--theme-git-added` | `#73C991` | `#2D7D46` | `A` |
| Deleted | `--theme-git-deleted` | `#C74E39` | `#A52B1A` | `D` |
| Renamed | `--theme-git-renamed` | `#73C991` | `#2D7D46` | `R` |
| Copied | `--theme-git-added` | `#73C991` | `#2D7D46` | `C` |
| Untracked | `--theme-git-untracked` | `#73C991` | `#2D7D46` | `U` |
| Conflicted | `--theme-git-conflicted` | `#E5534B` | `#C4352A` | `C` |
| Ignored | `--theme-git-ignored` | `#808080` | `#6B6B6B` | — |

Colors are theme tokens defined in `git-cruiser.scss` (for the default light/dark themes) and in each themes module SCSS file (self-contained). The `STATUS_COLOR_TOKEN_MAP` in `GitTypes.ts` maps each status code to its `var(--theme-git-*)` reference, which is passed as-is into tree item `styles.labelColor` and `styles.badgeColor`. The SDK's `resolveColor()` recognises `var(...)` strings and applies them as inline CSS, allowing the browser to resolve the actual color from the active theme's custom properties.

---

## BPMN Integration via Delegation

The git-cruiser module has **no BPMN-specific rendering, parsing, or document model knowledge**. All BPMN-aware functionality has been moved to `bpmn-diff` and `bpmn-core`. The git-cruiser provides generic Git primitives that other modules call via the command system.

### Delegation Pattern

1. **Git primitives exposed as commands** — `git.getFileAtRef`, `git.getLog`, `git.getHeadContent`, `git.createBranchInRepoOf`, `git.restoreFileContent`. These know nothing about BPMN or DMN; they operate on URIs and refs.
2. **Dispatch commands** — `git.showGitDiff` and `git.showFileHistory` are dispatchers that still live here because they need synchronous `RepositoryStore` enablement checks (`hasModifications`, `hasFileHistory`). Internally they call orchestrator functions (`diffFromGit.ts`, `fileHistory.ts`) that route to the appropriate diff module based on file extension (`.bpmn` → `bpmn-diff`, `.dmn` → `dmn-diff`, everything else → `git.text-diff`).
3. **Module-side wrapper commands** — Each diff module registers its own command set:
   - **bpmn-diff**: `bpmn.diff.openDiffTwoFiles`, `bpmn.diff.getChangeDigest`, `bpmn.diff.openHistoryPreview`, `bpmn.diff.history.restoreFile`, `bpmn.diff.historyPreview.changeViewMode`, `bpmn.diff.suggestBranchNameForProcess`, `bpmn.diff.getChangeSummaryMarkdown`
   - **dmn-diff**: `dmn.diff.openDiffTwoFiles`, `dmn.diff.getChangeDigest`, `dmn.diff.openHistoryPreview`, `dmn.diff.history.restoreFile`, `dmn.diff.historyPreview.changeViewMode`, `dmn.diff.getChangeSummaryMarkdown`

### Visual Diff

**Path:** `studio/src/modules/git-cruiser/diffFromGit.ts`

`openChangeDiff(bifrost, { repositoryRoot, relativePath, previousRelativePath, beforeRef, afterRef })` is the ref-to-ref diff router behind `git.showGitDiff` and `git.showChangeDiff`. A ref is a commit hash, `HEAD`, `WORKING` (file on disk) or `NONE` (side does not exist). The before side reads `previousRelativePath ?? relativePath` (renames).

| Case | Target |
|---|---|
| `.bpmn` / `.dmn`, both sides exist, diff command registered | `bpmn.diff.openDiffTwoFiles` / `dmn.diff.openDiffTwoFiles` with `{ label, sourceFileUri, beforeLabel, afterLabel }`; committed sides are written to temp copies |
| Anything else (other file types, one side `NONE`, diff module missing) | `git.text-diff` document |

`showGitDiffForFile(bifrost, repositoryStore, uri)` derives the refs from the file status: `HEAD` → `WORKING` for modified files, `NONE` → `WORKING` for untracked/added files, `HEAD` → `NONE` for files deleted on disk. Labels read "Last commit", "Your changes" or the short hash. Temp files are content-addressed (`<tmp>/<sha1 of content>/<relative path>`), so two diffs of the same path never share a file and an open tab never shows a stale before side. They are cleaned up on module reload.

### Text Diff (`git.text-diff`)

**Path:** `studio/src/modules/git-cruiser/textDiff/`

Fragment document type (page `design/source`) on top of the shared `DiffEditor`. The URI is `fragment+git.text-diff:` with fragment data `repositoryRoot`, `path`, optional `previousPath`, `beforeRef`, `afterRef`, `beforeLabel`, `afterLabel`. `TextDiffDocumentModel` loads both sides through `bifrost.sourceControl.getFileContentAtRevision` (`WORKING` via `bifrost.files.load`, `NONE` as empty text). Texts are private fields behind getters; the only metadata is a `revision` counter, incremented when a `WORKING` side changed on focus. `textDiffContent.ts` maps the file extension to an editor language and guards binary (NUL byte) and oversized (> 2 MiB) content; a guarded file shows a notice instead of the editor.

### Source Overview (`git.overview`)

**Path:** `studio/src/modules/git-cruiser/overview/`

Singleton document `git:overview` (page `design/source`, also its `defaultDocumentUri`). `SourceOverviewDocumentModel` derives everything from `RepositoryStore` (selected repository, state, `getHistory`) and refreshes, debounced, on `sourceControlStatusChanged` and `sourceControlSelectedRepositoryChanged`. Data lives in private fields behind getters; metadata only carries `revision`, `mode` (`uncommitted` | `comparison` | `history`) and `comparisonBase`. Each mode is a toolbar tab ("Uncommitted changes" | "Current Branch" | "Current vs. <base>") and renders only its own content. Model changes within one task are coalesced (`markChanged` → one `updateMetadata` per microtask), so a refresh re-renders once.

| Part | Behavior |
|------|----------|
| Uncommitted changes | A clean branch shows the placeholder "No uncommitted changes on the current branch.". `OverviewFile` per changed path (`status`, `beforeRef`, `afterRef`, `previousPath`); conflicted files from `mergeState` get status `conflicted` and open the resolver |
| Current vs. base (`comparison`) | A hint line says "Shows committed changes only.". Base defaults to the first existing of `main`, `master`, `origin/main`, `origin/master` that is not the current branch (the branch `origin/HEAD` points to is not read); `getMergeBase(base, 'HEAD')` → `getChangedFilesBetween(mergeBase, 'HEAD')`. `loading` (files not read yet), `on-base`, `no-base` and `failed` (git could not read the changes; the notice asks for a refresh) states render notices; a restored or chosen base that no longer exists falls back to the default, and the chosen base is dropped when another repository is selected. The toolbar menu `git-cruiser/overview-base` lists the other branches |
| Digests | BPMN/DMN files are summarized through `bpmn.diff.getChangeDigest` / `dmn.diff.getChangeDigest` (rendered by a private function in `ChangeRow.tsx`). Keyed by repository, path and refs; SHA-1 hashes of both texts are remembered, so an unchanged pair is not summarized twice. A status-triggered refresh (`refresh(false)`) does not read already summarized files again; opening, focusing and the refresh button do. Only the first 20 model files are summarized automatically, the row's "Summarize" link does the rest |
| Current Branch (`history`) | `SourceHistory` lists commits (refs, "Merged <branch>", "Not pushed", age via a private `formatCommitAge`) along a rail: a dot per commit, a rotated square for merges, the accent colour for the commit carrying the `head` ref; the rail is a `::before` line on `.source-overview__commit`. Right-click opens the menu `git-cruiser/overview-history-entry` ("Copy Commit Hash" → `git.copyCommitHash`). The toolbar (history mode only) holds a search field (`HistorySearchField`, `EditorToolbarTextInput` with `dataTestId="history-search"`, debounced 300 ms, rebuilt per repository): `setHistorySearchText` trims the text (at most `MAXIMUM_HISTORY_SEARCH_LENGTH` = 200 characters), reloads the first page and keeps the text in a private model field (not metadata; a repository change clears it). git searches the whole history (`--grep`, `--fixed-strings`, `--regexp-ignore-case`, so literal and case-insensitive, over subject and body); a search without results shows `data-test--history-no-match`. History loads carry a sequence number (`historySequence`): a result of a load that is no longer the latest is dropped, and `loadMoreHistory` does nothing while a reload or another page is loading. Commits that leave the list are removed from the expanded ones. Expanding a commit loads `getChangedFilesBetween(firstParent | null, hash)` and lists the files as `ChangeRow`s; model files that still exist get the `git.previewFileVersion` icon button ("Preview this version") |

Components: `ChangeRow`, `ChangeBadge`, `SourceHistory`. `ChangeRow` is one changed file, used by both change tabs (model files first) and by expanded commits: type icon (process / decision / file), status badge, model name with the muted path (path only without a model name), icon buttons on the right (preview for commits, Open File for `WORKING` files), and a summary line for models. The row is a container with the main `<button>` (type, badge, name, path, summary) and the action buttons as its siblings, so no interactive element is nested: the main button opens `git.showChangeDiff`, or `git.merge.openResolver` for a conflicted model file (any other conflicted file opens through `std.editor.focusOrOpenDocument`). Styles: `styles/source-overview.scss`, which uses `--theme-*` tokens only (status colours come from `--theme-git-*`). Commands (`overviewCommands.ts`): `git.overview.open`, `git.overview.showUncommitted`, `git.overview.showComparison`, `git.overview.showHistory`, `git.overview.setComparisonBase`, `git.overview.refresh`, `git.overview.toggleCommit(model, hash)`, `git.overview.loadMoreHistory(model)`, `git.overview.summarizeFile(model, file)` (all but `open` take the model as first argument; `open` is listed in the command search). The renderer reaches the model's actions only through these commands. The scrolling area (`.source-overview`) uses `useScrollPositionManager` with the key `source-overview:<document uri>:<mode>`, so each tab keeps its scroll position while a diff or another tab is in front (in memory, not persisted). Help text `git/overview` is opened by the toolbar help button.

### Semantic Change Summary

The change summary dialog and the Change Overview pane live entirely in the **bpmn-diff** module (see [bpmn-diff.md](bpmn-diff.md)). The "Show Summary" button is in the diff view toolbar and reads from the already-computed diff — no git-cruiser dependency.

**Path:** `studio/src/modules/git-cruiser/commitPreview.ts`

`buildChangeSummaryForFiles()` orchestrates the commit preview by fetching HEAD XML for each staged BPMN file and delegating formatting to `bpmn.diff.getChangeSummaryMarkdown`. A parallel `buildChangeSummaryForDmnFiles()` handles staged `.dmn` files via `dmn.diff.getChangeSummaryMarkdown`.

### File History and Restore

The BPMN history preview document type, renderer, model, pane, and styles have been moved to the **bpmn-diff** module. See [bpmn-diff.md](bpmn-diff.md) for details.

The QuickJump logic (`fileHistory.ts`) remains in git-cruiser for access to the synchronous `hasFileHistory` check, but dispatches to the appropriate diff module: `bpmn.diff.openHistoryPreview` for `.bpmn` files, `dmn.diff.openHistoryPreview` for `.dmn` files.

### Toolbar Buttons

The Git-related toolbar buttons ("Show Diff" and "History") are placed **statically** in both the BPMN renderer's `<EditorToolbar>` (`BpmnDocumentRenderer.tsx`) and the DMN renderer's `<EditorToolbar>` (`DmnDocumentRenderer.tsx`), guarded by `bifrost.commands.isRegistered(commandId)` checks. This means they render only when the `git-cruiser` module is loaded — if it is disabled, the buttons disappear gracefully.

Button enabled/disabled state is handled entirely by the commands' `enabledPredicateFn` (third argument to `bifrost.commands.register`). Both commands accept a plain `uri: string` — the renderer passes `editorDocument.uri`.

### Branch-Per-Process

`git.createBranchForProcess` delegates to `bpmn.diff.suggestBranchNameForProcess` (which reads the process name of the focused BPMN file, or falls back to the file name, and slugifies it into `feature/<slug>`) to get a branch name suggestion, then performs the Git branch creation itself.

---

## Protected Diagrams

**Path:** `studio/src/modules/git-cruiser/config/ProjectConfig.ts`

Glob patterns matching protected BPMN files. When committing, staged `.bpmn` files are checked against patterns using `minimatch`. Matched files trigger a confirmation dialog.

Configuration precedence:
1. **Project-level**: `.bifrostfw/git-cruiser.json` at repo root (watched via `bifrost.files.watchFile`)
2. **User-level**: `git.protect.diagrams` setting

```json
{
  "protectedDiagrams": [
    "src/production/**/*.bpmn"
  ]
}
```

---

## Status Refresh Strategy

| Trigger | Debounce |
|---------|----------|
| Editor document saved | Configurable (default 500ms) |
| Git operation completed | Immediate |
| Solution opened/changed | Immediate |
| Manual `git.refreshStatus` | Immediate |

After each refresh, `RepositoryStore` updates its cache, emits `sourceControlStatusChanged`, then emits `unspecifiedGlobalUpdate` (debounced at 160 ms by the framework) to trigger a Workbench-level re-render — this ensures toolbar buttons whose enabled state depends on git status (e.g. the "Show Diff" button in the BPMN editor) are re-evaluated. Finally it calls `decorationProvider.refresh(allRepoStates)`. The provider computes changed URIs and fires `onDidChange`, which triggers re-renders of only the affected tree items via the `useDecoration` hook.

---

## Status Bar

**Path:** `studio/src/modules/git-cruiser/initializers/initializeStatusBar.ts`

Registers three status bar items (left area): `git-cruiser/not-found`, `git-cruiser/branch`, and `git-cruiser/sync`.

### Active-Editor Tracking

Both `git-cruiser/branch` and `git-cruiser/sync` are always `type: 'button'`. The factory functions resolve the **active repository** through a three-step fallback chain:

1. **Focused editor** — `bifrost.editors.getFocusedEditorDocument()?.uri` → `repositoryStore.getRepoRootForUri()` → `repositoryStore.getRepoState()`
2. **Git Pane selection** — `repositoryStore.getSelectedRepo()` (written by the pane's repo selector)
3. **First repo** — `states[0]` (last resort)

When the user switches to a file in a different repository, the status bar factory is automatically re-evaluated (via `EVENT_EDITOR_AREA_FOCUS_UPDATED` → `EVENT_CONTENT_UPDATE` → `updateStatusBarItems()`). When the user changes the Git Pane selector, the pane explicitly triggers `bifrost.statusBar.updateStatusBarItems()`. In both cases the label, sync counts, and `commandArgs` update to reflect the newly active repo.

### Branch Item

- **Label**: `branchName*` (single repo) or `repoName: branchName*` (multi-repo). The `*` dirty marker appears when the repo has uncommitted changes.
- **Click**: executes `git.switchBranch` with `commandArgs: [activeRepoRoot]`, opening the QuickJump branch picker for the active repo.

### Sync Item

- **Label**: `✓` when in sync, otherwise `↑N ↓M` showing ahead/behind counts for the active repo's tracking branch.
- **Click**: executes `git.sync` with `commandArgs: [activeRepoRoot]`, syncing the active repo immediately.
- **Spinning icon**: While a sync or fetch operation is in progress (`repositoryStore.isSyncing === true`), the icon switches from `git-cruiser/sync` to `git-cruiser/sync-spinning` (which adds the `ph-spin` animation class). The flag is set at the start of `git.sync`, `git.pane.commitAndSync`, and `git.pane.commitToNewBranchAndSync`, and reset in the `finally` block. A `statusBar.updateStatusBarItems()` call before and after ensures the icon change is rendered.

### Tooltips

Both items list **all** repos with their branch and sync status, providing a multi-repo overview regardless of which repo is currently active.

---

## Multi-Repository Command Resolution

Global commands (commit, push, pull, sync, stash, switch branch, create branch) need a `repoRoot` to operate on. The synchronous helper `resolveRepoRoot(bifrost, repositoryStore, commandId, givenRepoRoot?)` in `initializeCommands.ts` handles this:

- **`givenRepoRoot` provided**: returns it directly (no user interaction). This path is used when commands are invoked from the Git Pane (which passes its currently selected repo) or from the `git.sync` command (which forwards its resolved repo to `git.pull`).
- **0 repos**: returns `null` (command exits early)
- **1 repo**: returns that repo's root directly (no user interaction)
- **2+ repos, no `givenRepoRoot`**: opens a **QuickJump menu** listing repositories by folder name and branch. Each QuickJump entry re-invokes the same `commandId` with the selected `repoRoot` as the first argument (chained re-invocation pattern). Returns `null` so the original invocation exits without performing any operation.

Every command handler accepts an optional `repoRoot?: string` first parameter, calls `resolveRepoRoot`, and exits early if the result is `null`. Git Pane header buttons (Stash, Apply Stash) pass `repoState.repoRoot` directly, so they never trigger the QuickJump picker.

### switchBranch QuickJump Flow

`git.switchBranch` accepts `(repoRoot?: string, branchName?: string)`. When `branchName` is omitted, it fetches all branches via `bifrost.sourceControl.getBranches(repoRoot)` and presents a QuickJump picker with:

- **"Create new branch..."** (sticky, `ph-light ph-plus` icon) — re-invokes `git.createBranch` with `[repoRoot]`
- **Local branches** (`git-cruiser/branch` icon) — re-invokes `git.switchBranch` with `[repoRoot, branchName]`
- **Remote branches** (`ph-light ph-cloud` icon, `remotes/` prefix stripped) — re-invokes `git.switchBranch` with `[repoRoot, branchName]`

The current branch is marked with a `current` text badge. When `branchName` is provided, the command directly performs the switch with the existing error handling (including stash-and-switch retry).

## Commands

| Command | Title | Context |
|---------|-------|---------|
| `git.refreshStatus` | Git: Refresh Status | Command search, Git pane header icon |
| `git.fetch` | Git: Fetch | Command search |
| `git.stage` | — | Git pane action icon |
| `git.unstage` | — | Git pane action icon |
| `git.stageAll` | Git: Stage All Changes | Command search |
| `git.unstageAll` | Git: Unstage All Changes | Command search |
| `git.revert` | — | Context menus, Git pane |
| `git.commit` | Git: Commit | Command search, Git pane |
| `git.push` | Git: Push | Command search |
| `git.pull` | Git: Pull | Command search |
| `git.sync` | Git: Sync (Fetch + Pull + Push) | Status bar |
| `git.pane.commit` | — | Git pane split button (main action) |
| `git.pane.commitAndPush` | — | Git pane split button menu |
| `git.pane.commitAndSync` | — | Git pane split button menu |
| `git.pane.commitToNewBranch` | — | Git pane split button menu |
| `git.pane.commitToNewBranchAndSync` | — | Git pane split button menu |
| `git.stash` | Git: Stash Changes | Command search |
| `git.stashApply` | Git: Apply Stash | Command search |
| `git.switchBranch` | Git: Switch Branch | Command search, status bar |
| `git.createBranch` | Git: Create Branch | Command search |
| `git.createBranchForProcess` | Git: Create Branch for This Process | Command search |
| `git.suggestCommitTitle` | Git pane wand button | `(repoRoot)` → suggested title or `null` |
| `git.showGitDiff` | Git: Show Changes for This File | BPMN toolbar (static), context menus; accepts `uri: string`; enabled for every file with a git status (incl. untracked) |
| `git.showChangeDiff` | — | Internal; `(repositoryRoot, relativePath, previousRelativePath, beforeRef, afterRef)` |
| `git.previewFileVersion` | — | Internal; `(fileUri, hash, subject, author, date)` → `bpmn.diff.openHistoryPreview` / `dmn.diff.openHistoryPreview` |
| `git.copyCommitHash` | Source Overview history row context menu | `(hash)` copies to the clipboard |
| `git.getHeadContent` | — | Internal (data service for bpmn-diff commit preview) |
| `git.getFileAtRef` | — | Internal (retrieve file at arbitrary Git ref) |
| `git.showFileHistory` | — | BPMN toolbar (static); accepts `uri: string` |
| `git.openHistoryPreview` | — | Internal (opens history fragment from QuickJump) |
| `git.restoreFileFromCommit` | — | History preview toolbar "Restore" button |
| `git.showInGitPane` | — | Context menus; `(uri?)` selects the repository containing the URI (`getRepoRootForUri`: path boundary, innermost root wins), then shows the pane |
| `git.suggestGitignore` | — | Internal |
| `git.showGitNotFoundInfo` | — | Status bar click |
| `git.cloneRepository` | Git: Clone Repository... | Command search, File menu, Start Page, Editor empty state, Git pane empty state |
| `git.connectFolderToRemote` | Git: Connect Folder to Remote Repository... | Command search, File Explorer context menu (non-git folders), Git pane empty state |

---

## Git Pane

**Path:** `studio/src/modules/git-cruiser/panes/GitPane.tsx`

### Action Icons

File entries in the Git Pane use the `actionIconsOnHover` array (on `TreeItemBase` in `studio/src/bifrost/contracts/TreeTypes.ts`) to render right-aligned action icons on hover. The icons are rendered by `HeadlessTreeItem` as a separate container positioned absolutely within the entry row.

| Section | Icons Shown |
|---------|-------------|
| **Changes** (unstaged) | Revert, Stage |
| **Staged Changes** | Unstage |
| **Untracked** | Stage |

The Tree-level `onActionIconClick` callback receives the item data with an injected `actionId` string to distinguish which icon was clicked.

### Row Click Behavior

Clicking a file entry runs `git.showGitDiff(uri)` (HEAD against the file on disk; new, untracked and deleted files open a text diff with one empty side). A conflicted BPMN or DMN file runs `git.merge.openResolver`; any other conflicted file is opened in the editor. "Open File" stays in the `git-cruiser/pane-file` context menu.

### Commit Title Suggestion

The ghost button `ph ph-magic-wand` ("Suggest a title from your staged model changes", `data-test--git-suggest-title`) in the commit action bar runs `git.suggestCommitTitle(repositoryRoot)`, which returns `string | null`. The command digests every staged, non-conflicted `.bpmn` / `.dmn` file (`HEAD` against the file on disk, through `bpmn.diff.getChangeDigest` / `dmn.diff.getChangeDigest`; a file deleted on disk counts as removed, and a file whose digest fails is only named, as `update`) and hands the digests to a private `suggestCommitTitle` in `initializeCommands.ts`. Without a staged model file it shows the notification "Stage a BPMN or DMN file first." and returns `null`; the pane writes a result into the title field (`commitTitleRef` and state). Rule: one model → `<model name or file name>: <parts>` with `add model` / `remove model` for a new or deleted model, otherwise `add 'X'`, `change 'Y'`, `remove 'Z'` (first name per kind, ` +N` for more), `adjust layout` for a layout-only change, `update` for anything else; two models → `Update A, B`; more → `Update A, B and N more`; at most 72 characters, cut with `…`.

### Header

The pane uses the host `PaneHeader` (`#components/panes/PaneHeader`) with a `PaneHeaderIcon` child for the refresh action. Below it, the internal header (`git-pane__header`) displays the branch name and contextual action icons:

| Element | Visibility | Action |
|---------|-----------|--------|
| Refresh icon (`PaneHeaderIcon`) | Always | Invokes `git.refreshStatus` |
| Branch label | Always | — |
| Sync label (`↑N ↓N`) | When tracking a remote branch | Tooltip shows ahead/behind count and tracking branch name |
| Stash All Changes icon | When any changes are present | Invokes `git.stash` |
| Apply Stash icon | When `repoState.hasStash` is true | Invokes `git.stashApply` |

### Context Menus

File entries use the `git-cruiser/pane-file` menu, which provides Show Changes (first item), Stage/Unstage, Revert (hidden for untracked files), Open File, and Reveal in File Manager.

### Commit Split Button Menu

**Path:** `studio/src/modules/git-cruiser/initializers/initializeMenus.ts`

The `git-cruiser/pane-commit-actions` menu is registered as a `MenuFactoryFunction` that receives the commit title and body `useRef` objects as `menuArgs`. Each item is a `MenuItem_Command` that forwards these refs as `commandArgs`:

| Item | Command | Notes |
|------|---------|-------|
| Commit | `git.pane.commit` | — |
| Commit & Push | `git.pane.commitAndPush` | — |
| Commit & Sync | `git.pane.commitAndSync` | Includes fetch |
| *(divider)* | — | — |
| Commit to new Branch | `git.pane.commitToNewBranch` | Prompts for branch name |
| Commit to new Branch & Sync | `git.pane.commitToNewBranchAndSync` | Prompts for branch name, includes fetch |

All pane commit commands use an `enabledPredicateFn` that reads from the title ref to verify the commit title is non-empty and staged files exist.

---

## Branch Safety (`resolveNewBranch`)

The "Commit to new Branch" family of commands uses a `resolveNewBranch(repoRoot, branchName)` helper that handles the full lifecycle of creating or switching to a branch:

1. **Fresh branch** — If the branch does not exist locally or remotely, `createBranch` is called. Returns `{ ready: true, isNew: true }`.
2. **Already on branch** — If the current branch matches, shows an info notification suggesting a regular commit.
3. **Existing branch** — If the branch exists locally, remotely, or both, a confirmation dialog warns the user and offers to check out the existing branch and commit on top. On confirmation, delegates to `switchToExistingBranch`.

### `switchToExistingBranch` flow

Handles the stash → checkout → pop sequence needed when local changes conflict with the target branch:

1. **Fast path**: Try `switchBranch` directly. If the working tree is compatible, no stash needed.
2. **Conflict detection**: If the switch fails because local changes would be overwritten (detected via localized error message patterns: "overwritten" / "überschrieben" / "uncommitted"), proceed to stash flow.
3. **Stash → Checkout → Pop --index**: Stash all changes (`git stash push`), switch branches, then pop with `{ restoreIndex: true }` to preserve the staging area.
4. **Revert on failure**: If the pop fails (e.g., merge conflicts), the entire operation is rolled back via `revertFailedStashPop`:
   - Unstage all files on the target branch (`unstage ['.']`)
   - Discard working tree changes (`revert ['.']`)
   - Switch back to the original branch
   - Re-apply the stash on the original branch
   - Show a human-readable notification distinguishing merge conflicts from other failures

The caller (`commitToNewBranch` / `commitToNewBranchAndSync`) inspects the `isNew` flag from the resolution to decide whether to `push --set-upstream` (new branch) or `pull` then `push` (existing branch).

---

## Error Handling

**Path:** `studio/src/modules/git-cruiser/dialogs/gitErrorNotification.ts`

Git CLI errors arrive wrapped in an IPC envelope (`Error invoking remote method '…': Error: <git output>`). The error handling module strips this envelope and then routes through **per-command error processors** that pattern-match the cleaned error string against known failure reasons, producing a short, human-readable notification.

### Architecture

1. **`stripIpcWrapper(raw)`** — removes the IPC prefix and `Error:` leader.
2. **Per-command processors** — each exported function (`showCommitError`, `showPushError`, `showPullError`, `showRevertError`, `showStashError`, `showStashPopError`, `showBranchCreateError`) checks for command-specific failure patterns and selects a user-friendly summary.
3. **`notify(bifrost, summary, raw)`** — logs the full raw error to console and calls `std.notifications.showError` which renders a notification with a "Show Error" button that opens a copy-able dialog with the full text.
4. **`showGitError(bifrost, title, error)`** — generic fallback for compound operations (sync, stash-&-switch) where the failing sub-command is ambiguous.

### Processor Assignment

| Call site | Processor |
|-----------|-----------|
| `git.commit` | `showCommitError` |
| `git.push` (all catch paths) | `showPushError` |
| `git.pull` | `showPullError` |
| `git.revert` | `showRevertError` |
| `git.stash` | `showStashError` |
| `git.stashApply` | `showStashPopError` |
| `git.switchBranch` | Dialog flow + `showGitError` (fallback) |
| `git.createBranch` | `showBranchCreateError` |
| `git.sync`, stash-&-switch | `showGitError` (generic) |
| `git.pane.commit` | `showCommitError` |
| `git.pane.commitAndPush` | `showCommitError` / `showPushError` |
| `git.pane.commitAndSync` | `showGitError` (compound) |
| `git.pane.commitToNewBranch` | `showBranchCreateError` / `showCommitError` |
| `git.pane.commitToNewBranchAndSync` | `showBranchCreateError` / `showGitError` (compound) |
| `resolveNewBranch` / `switchToExistingBranch` | `showGitError` + inline conflict notification |
| `pullErrorDialog.ts` rebase/stash-retry | `showPullError` / `showStashPopError` |
| `git.createBranchForProcess` | `showBranchCreateError` |

---

## File Path Reference

| Component | Path |
|-----------|------|
| Module entry | `studio/src/modules/git-cruiser/index.ts` |
| Repository store | `studio/src/modules/git-cruiser/RepositoryStore.ts` |
| UI status maps, merge types, commit options, history page | `studio/src/modules/git-cruiser/GitTypes.ts` |
| Source Overview (model, renderer, commands, components, styles) | `studio/src/modules/git-cruiser/overview/` |
| Source Overview help text | `studio/src/modules/git-cruiser/texts/source-overview.md` |
| Source control service, types, IPC, main process | [source-control.md](source-control.md) |
| Commands | `studio/src/modules/git-cruiser/initializers/initializeCommands.ts` |
| Menus | `studio/src/modules/git-cruiser/initializers/initializeMenus.ts` |
| Icons | `studio/src/modules/git-cruiser/initializers/initializeIcons.ts` |
| Settings | `studio/src/modules/git-cruiser/initializers/initializeSettings.ts` |
| Status bar | `studio/src/modules/git-cruiser/initializers/initializeStatusBar.ts` |
| Panes | `studio/src/modules/git-cruiser/initializers/initializePanes.ts` |
| Decorations | `studio/src/modules/git-cruiser/initializers/initializeDecorations.ts` |
| Git Pane | `studio/src/modules/git-cruiser/panes/GitPane.tsx` |
| Styles | `studio/src/modules/git-cruiser/styles/git-cruiser.scss` |
| Visual Diff Orchestrator | `studio/src/modules/git-cruiser/diffFromGit.ts` |
| Commit Preview Orchestrator | `studio/src/modules/git-cruiser/commitPreview.ts` |
| File History QuickJump | `studio/src/modules/git-cruiser/fileHistory.ts` |
| Project Config | `studio/src/modules/git-cruiser/config/ProjectConfig.ts` |
| Commit Dialog | `studio/src/modules/git-cruiser/dialogs/commitDialog.ts` |
| Pull Error Dialog | `studio/src/modules/git-cruiser/dialogs/pullErrorDialog.ts` |
| Git Error Notification | `studio/src/modules/git-cruiser/dialogs/gitErrorNotification.ts` |
| **Merge Document Model** | `studio/src/modules/git-cruiser/merge/MergeDocumentModel.ts` |
| **Merge Document Renderer** | `studio/src/modules/git-cruiser/merge/MergeDocumentRenderer.tsx` |
| **Merge Resolution Utility** | `writeResolvedFile` / `removeResolvedFile` in `studio/src/modules/git-cruiser/initializers/initializeCommands.ts` |
| **Merge Styles (generic)** | `studio/src/modules/git-cruiser/merge/styles/component.merge-editor.scss` |
| **BPMN Merge Resolver** | `studio/src/modules/bpmn-editor/merge/BpmnMergeResolver.tsx` |
| **BPMN Merge Change Overview Pane** | `studio/src/modules/bpmn-editor/merge/panes/BpmnMergeChangeOverview.tsx` |
| **BPMN Merge Styles** | `studio/src/modules/bpmn-core/diff/styles/component.bpmn-merge.scss` (shared by the BPMN and DMN merge resolvers) |

## Merge Conflict Resolution

The merge conflict resolver is a **pluggable** subsystem for resolving Git merge conflicts visually. The generic merge framework lives in `git-cruiser`, while type-specific visualization is delegated to the appropriate editor module (e.g., `bpmn-editor` for BPMN files).

### Architecture overview

The resolver follows the same pattern as the **EditorDocumentInspector**: each editor document type can optionally register a merge resolver component via `mergeResolverKey` / `mergeResolverConstructor` on the document type definition. The generic `MergeDocumentRenderer` in `git-cruiser` looks up the resolver at runtime. Only `.bpmn` and `.dmn` conflicted files enter the resolver walk; other extensions are skipped. If a walked file has no registered resolver, the renderer shows an error instead of a generic text editor.

Merge-specific actions (zoom, conflict navigation, etc.) use a **std-style command dispatch pattern**: generic commands like `git.merge.zoomToViewport` dispatch to type-specific variants like `git.merge.zoomToViewport.bpmn`. When no variant is registered, the command is simply disabled.

The merge editor is opened as a singleton document type (`merge`) at the fixed URI `merge://resolver`.

### Key files

| File | Purpose |
|------|---------|
| `git-cruiser/merge/MergeDocumentModel.ts` | Generic model: file list, blobs, progress, navigation, resolution tracking |
| `git-cruiser/merge/MergeDocumentRenderer.tsx` | Generic renderer: toolbar, title bar, resolution progress, delegates content to the registered resolver |
| `bifrost/common/EditorDocumentMergeResolverManager.ts` | Registry for merge resolver components (key→component map) |
| `studio/src/bifrost/contracts/MergeTypes.ts` | `MergeResolverProps`, `ElementResolution`, `MergeResolutionProgress` contracts |

BPMN three-panel visualization, `xmlMergeEngine`, and per-attribute resolution: [bpmn-diff.md](bpmn-diff.md) §Merge UI. DMN resolver: [dmn-editor.md](dmn-editor.md).

### Types

| Type | Location | Purpose |
|------|----------|---------|
| `SourceControlMergeStateKind` | `bifrost/contracts/SourceControlTypes.ts` | `'merge' \| 'rebase' \| 'cherry-pick' \| null` |
| `SourceControlMergeState` | `bifrost/contracts/SourceControlTypes.ts` | Merge kind + list of conflicted `SourceControlFileStatus` entries |
| `SourceControlConflictBlobs` | `bifrost/contracts/SourceControlTypes.ts` | `{ base, ours, theirs }` — each `string \| null` |
| `MergeConflictKind` | `studio/src/bifrost/contracts/MergeTypes.ts` | `'content' \| 'ours-deleted' \| 'theirs-deleted' \| 'added-by-both'` |
| `MergeFileType` | `bifrost/contracts/MergeTypes.ts` | `'bpmn' \| 'dmn'` — only diagram files enter the merge resolver |
| `MergeFileEntry` | `MergeDocumentModel.ts` | Per-file tracking: path, URI, resolved flag, fileType |
| `MergeResolverProps` | `studio/src/bifrost/contracts/MergeTypes.ts` | Props contract for resolver components (blobs, conflictKind, operationKind, entry, resolverRef, callbacks) |
| `MergeOperationKind` | `studio/src/bifrost/contracts/MergeTypes.ts` | `'merge' \| 'rebase' \| 'cherry-pick' \| null` |
| `ElementResolutionStatus` | `studio/src/bifrost/contracts/MergeTypes.ts` | `'auto-applied' \| 'pending' \| 'accepted-ours' \| 'accepted-theirs' \| 'custom'` |
| `ElementResolution` | `studio/src/bifrost/contracts/MergeTypes.ts` | `{ elementId, status }` |
| `MergeResolutionProgress` | `studio/src/bifrost/contracts/MergeTypes.ts` | `{ totalConflicts, resolvedConflicts, isComplete }` |
| `MergeResolverHost` | `studio/src/bifrost/contracts/MergeTypes.ts` | What the BPMN/DMN merge change-overview panes read from `MergeDocumentModel` (`currentFileType`, `resolverRef`, `getResolutionProgress()`), so editors never import `git-cruiser`; `MergeDocumentModel` implements it |
| `EVENT_MERGE_FILE_CHANGED`, `EVENT_RESOLUTION_CHANGED` | `studio/src/bifrost/contracts/MergeTypes.ts` | Events `MergeDocumentModel` emits for those panes |

### Source control calls

Merge state comes with `getRepositoryState`; blobs from `bifrost.sourceControl.getConflictBlobs` (`git show :1:` / `:2:` / `:3:`). Abort, continue and `git rm` for delete conflicts go through the `RepositoryStore` methods so the state refreshes. `writeResolvedFile` writes the result with `bifrost.files.save` and then stages it.

### Commands

| Command | Arguments | Purpose |
|---------|-----------|---------|
| `git.merge.openResolver` | — | Opens or focuses the singleton merge resolver document |
| `git.merge.acceptOurs` | `model: MergeDocumentModel` | Writes "ours" blob to disk, stages, advances to next |
| `git.merge.acceptTheirs` | `model: MergeDocumentModel` | Writes "theirs" blob to disk, stages, advances to next |
| `git.merge.skip` | `model: MergeDocumentModel` | Advances to the next unresolved file |
| `git.merge.resolveAndStage` | `model: MergeDocumentModel` | Writes result XML from resolver, stages, advances (enabled when all conflicts resolved) |
| `git.merge.abort` | — | Aborts the current merge/rebase/cherry-pick |
| `git.merge.continue` | — | Continues rebase or cherry-pick after all conflicts resolved |
| `git.merge.paneAcceptOurs` | `relativePath, repoRoot` | Resolves a conflicted file with "ours" blob directly (Git Pane) |
| `git.merge.paneAcceptTheirs` | `relativePath, repoRoot` | Resolves a conflicted file with "theirs" blob directly (Git Pane) |
| `git.focusGitPane` | — | Shows and focuses the Git Pane |

#### Command dispatch pattern (generic → type-specific)

| Generic command | Dispatches to | Fallback |
|----------------|---------------|----------|
| `git.merge.zoomToViewport` | `git.merge.zoomToViewport.{docType}` | Disabled |
| `git.merge.zoomToActualSize` | `git.merge.zoomToActualSize.{docType}` | Disabled |
| `git.merge.zoomToSelectedElement` | `git.merge.zoomToSelectedElement.{docType}` | Disabled |
| `git.merge.selectNextConflict` | `git.merge.selectNextConflict.{docType}` | Disabled |
| `git.merge.selectPreviousConflict` | `git.merge.selectPreviousConflict.{docType}` | Disabled |
| `git.merge.getCurrentConflictIndex` | `git.merge.getCurrentConflictIndex.{docType}` | Returns `null` |
| `git.merge.acceptOursThenEdit` | `git.merge.acceptOursThenEdit.{docType}` | Generic: write blob + open file |
| `git.merge.acceptTheirsThenEdit` | `git.merge.acceptTheirsThenEdit.{docType}` | Generic: write blob + open file |
| `git.merge.acceptOursForElement` | `git.merge.acceptOursForElement.{docType}` | Disabled |
| `git.merge.acceptTheirsForElement` | `git.merge.acceptTheirsForElement.{docType}` | Disabled |
| `git.merge.acceptAllOurs` | `git.merge.acceptAllOurs.{docType}` | Disabled |
| `git.merge.acceptAllTheirs` | `git.merge.acceptAllTheirs.{docType}` | Disabled |

The `{docType}` is resolved from the current file's editor document type (e.g., `bpmn` or `dmn`). Each editor module registers its own merge command variants:
- **bpmn-editor**: `git.merge.zoomToViewport.bpmn`, `git.merge.getResultXml.bpmn`, `git.merge.acceptAllOurs.bpmn`, etc. — full per-element merge support
- **dmn-editor**: `git.merge.getResultXml.dmn`, `git.merge.acceptAllOurs.dmn`, `git.merge.acceptAllTheirs.dmn`, `git.merge.isFullyResolved.dmn`, `git.merge.getResolutionProgress.dmn` — whole-file resolution

The merge resolution commands receive the `MergeDocumentModel` directly from the renderer via `commandArgs`. This follows the [renderer-passes-model pattern](commands.md#renderer--command-pass-the-model).

### Conflict detection flow

1. `RepositoryStore.refreshRepo()` reads `bifrost.sourceControl.getRepositoryState()`, which includes the merge state.
2. `SourceControlRepositoryState.mergeState` stores the result (kind + conflicted file list).
3. The Git Pane renders a "Merge Conflicts" section at the top of the tree when conflicts exist.
4. The status bar branch item shows `MERGING`/`REBASING`/`CHERRY-PICKING` suffix and conflict count.
5. `handlePullResult()` shows a notification with "Open Merge Resolver" action when pull results in conflicts.

### BPMN / DMN merge visualization

Three-panel layout, `xmlMergeEngine`, per-attribute resolution, and the BPMN Change Overview pane are documented in [bpmn-diff.md](bpmn-diff.md) §Merge UI. git-cruiser owns the generic model, IPC, commands, and file walk (`.bpmn` / `.dmn` only).

The BPMN Change Overview pane is registered by `bpmn-editor` (`BpmnMergeChangeOverview.tsx`); the DMN pane by `dmn-editor` (`DmnMergeChangeOverview.tsx`). Both read type-specific data through `model.resolverRef` — call type-specific methods with optional chaining (`resolverApi?.getDefinitionsMetadataOurs?.() ?? []`).

### Toolbar button strategy

When `hasResolutionProgress` is true (BPMN or DMN resolver with content conflicts), the toolbar shows **only** the resolution-specific buttons ("Resolve & Stage", "Accept All Ours", "Accept All Theirs"). The per-file "Accept Ours" / "Accept Theirs" / "Accept & Edit" buttons are shown when no resolution progress is active yet (for example delete conflicts, or before the resolver reports element progress).

### Whole-file accept with active result modeler

`git.merge.acceptOurs` and `git.merge.acceptTheirs` check for an active resolver API. When one exists, they batch-resolve all pending conflicts via `acceptAllOurs()` / `acceptAllTheirs()`, retrieve the merged XML via `getResultXml()`, and write that instead of the raw blob. This preserves any partial resolution work the user has done. If no resolver is active, the commands fall back to writing the raw blob directly.

### BPMN editor integration

`BpmnDocumentModel` detects conflict markers (`<<<<<<<`) in file content:
- On initial load (`create()`): shows an empty diagram with `mergeConflict: true` metadata.
- On file watcher change (`onChange()`): sets `mergeConflict: true` and skips modeler update.
- `BpmnDocumentRenderer` shows a conflict banner with "Open Merge Resolver", "Accept Ours", "Accept Theirs" buttons.

### Delete conflict handling

When one side deletes a file while the other modifies it, `git show :N:` returns `null` for the missing stage. The model sets `conflictKind` to `'ours-deleted'` or `'theirs-deleted'`, and the renderer shows a placeholder panel with a trash icon and a "Compare with base" link instead of a viewer.

### File types in the merge resolver

The merge resolver walks only `.bpmn` and `.dmn` files (`classifyFileType` in `MergeDocumentModel.ts`):

- `.bpmn` → `'bpmn'` — rendered with the registered `BpmnMergeResolver`
- `.dmn` → `'dmn'` — rendered with the registered `DmnMergeResolver`
- Every other extension (text, binary, JSON, Markdown, …) is excluded from the walk

Conflicted non-diagram files stay visible in the Git Pane (Accept Ours / Accept Theirs / Open in editor). They are not opened in the merge editor.

There is no generic CodeMirror text-merge fallback. That courtesy editor was removed; the merge editor is BPMN/DMN only, matching the Studio's document-type scope.

### Registering a new merge resolver

To add merge conflict visualization for a new file type:

1. Create a React component implementing `MergeResolverProps` (from `studio/src/bifrost/contracts/MergeTypes.ts`).
2. Register it on the document type definition with `mergeResolverKey` / `mergeResolverConstructor`.
3. Optionally register type-specific merge commands (`git.merge.zoomToViewport.{docType}`, etc.) for toolbar/title bar actions.
4. Expose an imperative API via `props.resolverRef.current` for commands to reach the resolver.

## Clone Repository

**Command:** `git.cloneRepository` (searchable as "Git: Clone Repository...")

Three-step sequential dialog chain with protocol auto-detection and optional HTTPS credential support:

**Dialog 1 — Repository URL**: Single `text_input` for the URL. On submit, the protocol is auto-detected from the URL pattern (`git@...` / `ssh://...` → SSH, `https://...` / `http://...` → HTTPS). Invalid patterns show a validation error.

**Dialog 2 — HTTPS Credentials** (skipped for SSH): Username + masked token/password fields. Both are optional (public repos skip this step). A "Back" button returns to Dialog 1. Credentials are embedded into the URL in-memory (`https://user:token@host/repo`) for the git operations that follow.

**Between Dialogs 2 and 3 — Branch fetch**: `bifrost.sourceControl.listRemoteBranches` is called with the effective URL. A sticky notification shows progress. On success, branches are passed to Dialog 3 as a pre-populated `select`. On failure, Dialog 3 falls back to a `text_input` for manual branch entry with the error shown as a hint.

**Dialog 3 — Branch + Destination**: `path_picker` for the destination folder (plain string, no JSON), plus either a `select` (branches loaded) or `text_input` (fallback). The repository is cloned into a subfolder named after the repo.

**Progress notifications**: Clone progress is streamed from the main process via `IPC_MESSAGE_GIT_CLONE_PROGRESS`. The renderer subscribes via `bifrost.sourceControl.onCloneProgress()` and updates a sticky notification with stage + percentage. The notification is closed on completion or error.

**Solution integration** (post-clone):
- **Explicit `.bfwsln` solution open**: `addFolderToSolution` + `saveSolutionFile` — folder is added to the current solution
- **All other cases**: Delegates to `std.solution.openDirectory`, which handles the open-here / open-in-new-window prompt

**UI entry points**: File menu (after "Add Folder to Solution"), command search, Start Page extra renderer, Editor Area Empty State extra action, Git Pane no-repo empty state.

## Connect Folder to Remote

**Command:** `git.connectFolderToRemote` (searchable as "Git: Connect Folder to Remote Repository...")

Converts a local folder that is not inside a git repo into a git repository connected to a remote. When invoked from command search (no args), prompts for a folder via `showOpenDirectory`. When invoked from a context menu, receives the folder URI as an argument.

Uses the same three-step dialog chain as Clone, except Dialog 3 contains the branch picker (no destination folder — the folder is already known) and an optional "new branch" text field.

**Dialog 3 — Branch selection:**
- Branch picker (select or text_input fallback)
- "Optional: Create new branch from selected base branch" text field. If left empty, the selected base branch is used directly. If a name is provided and the branch exists on the remote, git switches to it. If the name does not exist, a new local branch is created from the selected base branch.

**Clone-to-temp strategy** (implemented as a single composite IPC handler `IPC_INVOKE_GIT_CONNECT_TO_REMOTE` in `bifrost/electron-main/git/registerGitHandlers.ts`):

1. Clone the repo into a temp directory (`os.tmpdir()/bifrost-forge-world-connect-<timestamp>`) with progress reporting
2. *(Optional)* If `newBranch` was specified: check `git branch -a` in the temp clone — if `remotes/origin/<newBranch>` exists, `git checkout <newBranch>`; otherwise `git checkout -b <newBranch>` (creates a local branch from the cloned base branch)
3. Move the `.git` directory from the temp clone into the target folder (`fs.rename` with `EXDEV` fallback to `fs.cp` + `fs.rm` for cross-filesystem moves)
4. `git reset HEAD` — resets the index so git sees all local files as working-tree changes rather than staged deletions
5. `git status` — identify files that are in the branch but missing locally (shown as "deleted")
6. `git checkout HEAD -- <deleted files>` — restore only the missing branch files, leaving existing local files untouched
7. Clean up the temp directory

After completion, the target folder is a proper git repository on the selected branch (or the newly created branch). Any local files that differ from the branch appear as uncommitted modifications in the Git pane. Files that only exist locally appear as untracked. No conflict dialog is needed — the user resolves differences naturally through the Git pane.

**Progress notifications**: Reuses the existing `IPC_MESSAGE_GIT_CLONE_PROGRESS` mechanism from the clone command. The renderer subscribes via `bifrost.sourceControl.onCloneProgress()` and updates a sticky notification.

**Error recovery**: On any failure, `.git/` is cleaned up via `deleteFilesAndDirectories` to restore the folder to its pre-connect state. The temp directory is cleaned up in a `finally` block.

**Context menu**: Appears on project roots and solution roots that are **not** inside a known git repo. Subdirectories within projects do not show this option — only the project root folder itself.

## HTTPS Credential Handling

The main process sets `GIT_TERMINAL_PROMPT=0` ([source-control.md](source-control.md) §Electron Main), so git never waits for credentials on a terminal.

When `GIT_TERMINAL_PROMPT=0` is active and credentials are needed, git fails immediately with a catchable authentication error. The three-step dialog chain handles this by:
1. Detecting HTTPS URLs in Dialog 1
2. Prompting for optional credentials in Dialog 2
3. Embedding credentials into the URL before any git operation

Credentials stay in memory only — they are never persisted, logged, or transmitted by the Studio.

## Auto-Upstream Push

The `IPC_INVOKE_GIT_PUSH` handler proactively checks whether the current branch has a remote tracking branch before pushing. If no upstream is configured (`branch().branches[current].tracking` is empty), it automatically pushes with `--set-upstream origin <branch>` instead of a plain `git push`. This covers all push paths (command palette, pane commit+push, sync) with a single fix and avoids the "no upstream branch" error entirely.

Error detection in `showPushError` and the `git.push` recovery dialog also matches the locale-independent string `--set-upstream` (the command hint git always emits in stderr regardless of locale) in addition to the English-only patterns `no upstream` and `has no upstream branch`.

## Menu Integration

**File Menu** (`std/application/main`): "Add Git Repo to Solution ..." appears after "Add Folder to Solution ...", visible only when a solution is open and git is active. Triggers `git.cloneRepository`.

**Solution Root Context Menu** (`std/file-explorer/solution-root`): "Add Git Repo to Solution ..." appears after "Add Folder to Solution ..." via `insertAfterMenuItem`. Always visible when git is active.
