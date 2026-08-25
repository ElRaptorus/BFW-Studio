# Git Cruiser

---

## Overview

`git-cruiser` is a standalone module providing full Git integration for Bifrost Forge World. It detects Git repositories in opened solutions, visualizes file status throughout the UI (file explorer, open editors, dedicated pane, status bar), and provides core Git operations (stage, commit, push, pull, revert, stash, branch management). All Git CLI interactions run in the Electron main process via `simple-git`, communicating with the renderer through IPC.

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│  Renderer (git-cruiser module)                      │
│                                                        │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │ GitService  │  │ GitPane    │  │ Initializers     │  │
│  │ (state +    │  │ (React)    │  │  commands, menus │  │
│  │  IPC bridge)│  │            │  │  icons, settings │  │
│  └──────┬──────┘  └────────────┘  │  statusBar,      │  │
│         │                          │  panes,           │  │
│         │ ipcRenderer.invoke       │  decorations      │  │
│         │                          └─────────────────┘  │
├─────────┼──────────────────────────────────────────────┤
│  IPC    │  GitIpcChannels.ts constants                  │
├─────────┼──────────────────────────────────────────────┤
│         ▼                                               │
│  ┌──────────────────────────────────┐                   │
│  │ registerGitHandlers (main proc)  │                   │
│  │ Uses: simple-git                  │                   │
│  └──────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### Renderer Side

#### GitService

**Path:** `studio/src/modules/git-cruiser/GitService.ts`

Singleton service managing all renderer-side Git state and IPC communication. Key responsibilities:

- **Status cache**: `Map<repoRoot, GitRepoState>` maps each detected repo root to its current status
- **Repo detection**: Iterates solution projects, calls `IPC_INVOKE_GIT_IS_REPO` to find `.git` roots
- **Debounced refresh**: Uses `lodash.debounce` on `scheduleRefresh()` to coalesce multiple triggers
- **Operation methods**: `stage`, `unstage`, `commit`, `push`, `pull`, `revert`, `stash`, `stashApply` (with optional `{ restoreIndex }` for `--index`), `switchBranch`, `createBranch`, `fetch`, `showFileAtRef`, `getLog`
- **Sync state flag**: `isSyncing: boolean` — set `true` during sync/fetch operations; drives the spinning status bar icon
- **Directory status aggregation**: `getDirectoryStatus(uri)` returns the most severe child file status

Each operation method calls `refreshRepo()` after completing, which emits `gitStatusChanged` and delegates to the `GitDecorationProvider.refresh()` for targeted UI updates (see [Tree Item Decorations](#tree-item-decorations)).

#### GitPane

**Path:** `studio/src/modules/git-cruiser/panes/GitPane.tsx`

React component registered as a left pane group. Uses SDK pane components extensively:

- **Repo selector** — `PaneProperty type="select"`, visible only when the solution contains 2+ git repositories. The selected repo is pane-local state. When the user switches, the pane re-renders with the chosen repo's state. Single-repo solutions see no selector.
- **Branch info bar** — `PaneInfoBar` with `PaneInfoBarItem` for branch name and ahead/behind counts, plus `PaneInfoBarAction` (command-driven) for Stash and Apply Stash actions.
- **Commit input** — `PaneProperty type="text"` for the title and `PaneProperty type="textarea"` for the optional body. Both use real-time `onChange` with `valueRef` props, which provide bidirectional ref-based state bridging. Command handlers read values directly from these refs (passed as `commandArgs`) and clear them after a successful commit; the `gitStatusChanged` event then syncs the cleared refs back to `useState`.
- **Commit actions** — `PaneActionBar` with a `PaneActionSplitButton`. The main button triggers "Commit"; the dropdown caret opens the `git-cruiser/pane-commit-actions` menu with: Commit, Commit & Push, Commit & Sync, a divider, Commit to new Branch, Commit to new Branch & Sync. Each menu item is a `MenuItem_Command` with the title/body refs as `commandArgs`.
- **File tree** — Staged / Unstaged / Untracked file groups inside a `PaneBody`, using the `Tree` component with per-file hover action icons (stage/unstage via `actionIconOnHover`).

All icons are rendered via the SDK `Icon` component. Subscribes to `gitStatusChanged` events to refresh its state. When the event fires, the pane re-reads all repo states and resolves the selected repo (falling back to the first repo if the previously selected one no longer exists).

### Main Process Side

#### registerGitHandlers

**Path:** `studio/src/bifrost/electron-main/registerGitHandlers.ts`

Registers `ipcMain.handle` for all `IPC_INVOKE_GIT_*` channels. Each handler instantiates a `simple-git` instance scoped to the provided `cwd` and delegates to the corresponding `simple-git` method.

### IPC Channels

**Path:** `studio/src/modules/git-cruiser/GitIpcChannels.ts`

All channel constants are defined here and re-exported via `IpcEvents.ts`.

| Channel | Purpose |
|---------|---------|
| `IPC_INVOKE_GIT_IS_AVAILABLE` | Check if `git` is installed (`git --version`) |
| `IPC_INVOKE_GIT_IS_REPO` | Check if a path is inside a git repo |
| `IPC_INVOKE_GIT_STATUS` | Get `git status` for a repo |
| `IPC_INVOKE_GIT_STAGE` | `git add` files |
| `IPC_INVOKE_GIT_UNSTAGE` | `git reset HEAD` files |
| `IPC_INVOKE_GIT_COMMIT` | `git commit` with message |
| `IPC_INVOKE_GIT_PUSH` | `git push` — auto-detects missing upstream via `branch().tracking` and pushes with `--set-upstream origin <branch>` when needed |
| `IPC_INVOKE_GIT_PULL` | `git pull` with optional `--rebase` |
| `IPC_INVOKE_GIT_REVERT` | `git checkout -- <files>` |
| `IPC_INVOKE_GIT_FETCH` | `git fetch` |
| `IPC_INVOKE_GIT_STASH` | `git stash push` with optional message |
| `IPC_INVOKE_GIT_STASH_APPLY` | `git stash pop` with optional index and `{ restoreIndex }` option (`--index`) |
| `IPC_INVOKE_GIT_STASH_LIST` | `git stash list` |
| `IPC_INVOKE_GIT_BRANCH_LIST` | List branches |
| `IPC_INVOKE_GIT_BRANCH_SWITCH` | `git switch` |
| `IPC_INVOKE_GIT_BRANCH_CREATE` | `git switch -c` |
| `IPC_INVOKE_GIT_SHOW` | `git show <ref>` (retrieve file at commit) |
| `IPC_INVOKE_GIT_LOG` | `git log` with optional count and file filter |
| `IPC_INVOKE_GIT_CLONE` | `git clone` with optional branch and progress streaming |
| `IPC_INVOKE_GIT_LS_REMOTE` | `git ls-remote --heads --symref` for listing remote branches |
| `IPC_INVOKE_GIT_CONNECT_TO_REMOTE` | Composite: clone to temp, move `.git` into target, reset index, restore missing files |
| `IPC_MESSAGE_GIT_CLONE_PROGRESS` | Event (main → renderer): clone progress updates with `{ stage, progress }` |

---

## Module State Model

The module operates in one of three states:

| State | Condition | UI |
|-------|-----------|-----|
| **Active** | Git installed + `enabled = true` | Full functionality |
| **Git not found** | Git not in PATH | Status bar "Git not found", pane explains situation |
| **Disabled** | `enabled = false` | No visible UI at all |

State is determined by `GitService.isActive` (`isGitAvailable && isEnabled`). All visibility predicates and UI components check this flag.

---

## Repo Detection and Lifecycle

`GitService.detectRepos()` scans `solution.projects` and checks each project's `baseUri` via `IPC_INVOKE_GIT_IS_REPO`. It **rebuilds** the internal project-to-repo mapping from scratch on every call, discarding stale entries for removed projects or disappeared repos. Any `repoStateMap` entries without a corresponding project are also pruned.

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
GitService.refreshRepo()
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

1. Builds a new Map from all `GitRepoState.files` (file URIs → decoration) and aggregated directory URIs (worst-status child → decoration)
2. Computes the symmetric difference between old and new caches
3. Fires `onDidChange` with only the changed URIs
4. Replaces the cache atomically

`provideDecoration(uri)` is O(1) — a direct Map lookup.

### React Integration

- **`DecorationContext`** (`studio-sdk/src/components/Tree/DecorationContext.ts`): A React context providing the `TreeDecorationSource` to consumers
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
2. **Dispatch commands** — `git.showGitDiff` and `git.showFileHistory` are dispatchers that still live here because they need synchronous `GitService` enablement checks (`hasModifications`, `hasFileHistory`). Internally they call orchestrator functions (`diffFromGit.ts`, `fileHistory.ts`) that route to the appropriate diff module based on file extension (`.bpmn` → `bpmn-diff`, `.dmn` → `dmn-diff`).
3. **Module-side wrapper commands** — Each diff module registers its own command set:
   - **bpmn-diff**: `bpmn.diff.openHistoryPreview`, `bpmn.diff.history.restoreFile`, `bpmn.diff.historyPreview.changeViewMode`, `bpmn.diff.suggestBranchNameForProcess`, `bpmn.diff.getChangeSummaryMarkdown`
   - **dmn-diff**: `dmn.diff.openHistoryPreview`, `dmn.diff.history.restoreFile`, `dmn.diff.historyPreview.changeViewMode`, `dmn.diff.getChangeSummaryMarkdown`

### Visual Diff

**Path:** `studio/src/modules/git-cruiser/diffFromGit.ts`

Retrieves `HEAD` version via `git show`, writes to OS temp directory, and dispatches to the appropriate diff module based on file extension: `bpmn.diff.openDiffTwoFiles` for `.bpmn` files, `dmn.diff.openDiffTwoFiles` for `.dmn` files. Temp files are cleaned up on module reload.

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

`git.createBranchForProcess` delegates to `bpmn.diff.suggestBranchNameForProcess` (which uses `bpmn-core/bpmnProcessUtils.ts` utilities — `extractProcessName`, `slugify`) to get a branch name suggestion, then performs the Git branch creation itself.

---

## Protected Diagrams

**Path:** `studio/src/modules/git-cruiser/config/ProjectConfig.ts`

Glob patterns matching protected BPMN files. When committing, staged `.bpmn` files are checked against patterns using `minimatch`. Matched files trigger a confirmation dialog.

Configuration precedence:
1. **Project-level**: `.evilstudio/git-cruiser.json` at repo root (watched via `bifrost.files.watchFile`)
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

After each refresh, `GitService` updates its cache, emits `gitStatusChanged`, then emits `unspecifiedGlobalUpdate` (debounced at 160 ms by the framework) to trigger a Workbench-level re-render — this ensures toolbar buttons whose enabled state depends on git status (e.g. the "Show Diff" button in the BPMN editor) are re-evaluated. Finally it calls `decorationProvider.refresh(allRepoStates)`. The provider computes changed URIs and fires `onDidChange`, which triggers re-renders of only the affected tree items via the `useDecoration` hook.

---

## Status Bar

**Path:** `studio/src/modules/git-cruiser/initializers/initializeStatusBar.ts`

Registers three status bar items (left area): `git-cruiser/not-found`, `git-cruiser/branch`, and `git-cruiser/sync`.

### Active-Editor Tracking

Both `git-cruiser/branch` and `git-cruiser/sync` are always `type: 'button'`. The factory functions resolve the **active repository** through a three-step fallback chain:

1. **Focused editor** — `bifrost.editors.getFocusedEditorDocument()?.uri` → `gitService.getRepoRootForUri()` → `gitService.getRepoState()`
2. **Git Pane selection** — `gitService.paneSelectedRepoRoot` (written by the pane's repo selector)
3. **First repo** — `states[0]` (last resort)

When the user switches to a file in a different repository, the status bar factory is automatically re-evaluated (via `EVENT_EDITOR_AREA_FOCUS_UPDATED` → `EVENT_CONTENT_UPDATE` → `updateStatusBarItems()`). When the user changes the Git Pane selector, the pane explicitly triggers `bifrost.statusBar.updateStatusBarItems()`. In both cases the label, sync counts, and `commandArgs` update to reflect the newly active repo.

### Branch Item

- **Label**: `branchName*` (single repo) or `repoName: branchName*` (multi-repo). The `*` dirty marker appears when the repo has uncommitted changes.
- **Click**: executes `git.switchBranch` with `commandArgs: [activeRepoRoot]`, opening the QuickJump branch picker for the active repo.

### Sync Item

- **Label**: `✓` when in sync, otherwise `↑N ↓M` showing ahead/behind counts for the active repo's tracking branch.
- **Click**: executes `git.sync` with `commandArgs: [activeRepoRoot]`, syncing the active repo immediately.
- **Spinning icon**: While a sync or fetch operation is in progress (`gitService.isSyncing === true`), the icon switches from `git-cruiser/sync` to `git-cruiser/sync-spinning` (which adds the `ph-spin` animation class). The flag is set at the start of `git.sync`, `git.pane.commitAndSync`, and `git.pane.commitToNewBranchAndSync`, and reset in the `finally` block. A `statusBar.updateStatusBarItems()` call before and after ensures the icon change is rendered.

### Tooltips

Both items list **all** repos with their branch and sync status, providing a multi-repo overview regardless of which repo is currently active.

---

## Multi-Repository Command Resolution

Global commands (commit, push, pull, sync, stash, switch branch, create branch) need a `repoRoot` to operate on. The synchronous helper `resolveRepoRoot(bifrost, gitService, commandId, givenRepoRoot?)` in `initializeCommands.ts` handles this:

- **`givenRepoRoot` provided**: returns it directly (no user interaction). This path is used when commands are invoked from the Git Pane (which passes its currently selected repo) or from the `git.sync` command (which forwards its resolved repo to `git.pull`).
- **0 repos**: returns `null` (command exits early)
- **1 repo**: returns that repo's root directly (no user interaction)
- **2+ repos, no `givenRepoRoot`**: opens a **QuickJump menu** listing repositories by folder name and branch. Each QuickJump entry re-invokes the same `commandId` with the selected `repoRoot` as the first argument (chained re-invocation pattern). Returns `null` so the original invocation exits without performing any operation.

Every command handler accepts an optional `repoRoot?: string` first parameter, calls `resolveRepoRoot`, and exits early if the result is `null`. Git Pane header buttons (Stash, Apply Stash) pass `repoState.repoRoot` directly, so they never trigger the QuickJump picker.

### switchBranch QuickJump Flow

`git.switchBranch` accepts `(repoRoot?: string, branchName?: string)`. When `branchName` is omitted, it fetches all branches via `gitService.getBranches(repoRoot)` and presents a QuickJump picker with:

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
| `git.showGitDiff` | Git: Show Changes for This File | BPMN toolbar (static), context menus; accepts `uri: string` |
| `git.getHeadContent` | — | Internal (data service for bpmn-diff commit preview) |
| `git.getFileAtRef` | — | Internal (retrieve file at arbitrary Git ref) |
| `git.showFileHistory` | — | BPMN toolbar (static); accepts `uri: string` |
| `git.openHistoryPreview` | — | Internal (opens history fragment from QuickJump) |
| `git.restoreFileFromCommit` | — | History preview toolbar "Restore" button |
| `git.showInGitPane` | — | Context menus |
| `git.suggestGitignore` | — | Internal |
| `git.showGitNotFoundInfo` | — | Status bar click |
| `git.cloneRepository` | Git: Clone Repository... | Command search, File menu, Start Page, Editor empty state, Git pane empty state |
| `git.connectFolderToRemote` | Git: Connect Folder to Remote Repository... | Command search, File Explorer context menu (non-git folders), Git pane empty state |

---

## Git Pane

**Path:** `studio/src/modules/git-cruiser/panes/GitPane.tsx`

### Action Icons

File entries in the Git Pane use the SDK's `actionIconsOnHover` array (added to `TreeItemBase` in `studio-sdk/src/contracts/TreeTypes.ts`) to render right-aligned action icons on hover. The icons are rendered by `HeadlessTreeItem` as a separate container positioned absolutely within the entry row.

| Section | Icons Shown |
|---------|-------------|
| **Changes** (unstaged) | Revert, Stage |
| **Staged Changes** | Unstage |
| **Untracked** | Stage |

The Tree-level `onActionIconClick` callback receives the item data with an injected `actionId` string to distinguish which icon was clicked.

### Row Click Behavior

Clicking a file entry opens it in the editor via `bifrost.editors.focusOrOpenEditorDocument`. Deleted files are intercepted — a notification informs the user to use "Revert Changes" to restore the file, instead of attempting to open a non-existent file.

### Header

The pane uses the SDK `PaneHeader` with a `PaneHeaderIcon` child for the refresh action. Below it, the internal header (`git-pane__header`) displays the branch name and contextual action icons:

| Element | Visibility | Action |
|---------|-----------|--------|
| Refresh icon (`PaneHeaderIcon`) | Always | Invokes `git.refreshStatus` |
| Branch label | Always | — |
| Sync label (`↑N ↓N`) | When tracking a remote branch | Tooltip shows ahead/behind count and tracking branch name |
| Stash All Changes icon | When any changes are present | Invokes `git.stash` |
| Apply Stash icon | When `repoState.hasStash` is true | Invokes `git.stashApply` |

### Context Menus

File entries use the `git-cruiser/pane-file` menu, which provides Stage/Unstage, Revert (hidden for untracked files), Show Git Changes, Open File, and Reveal in File Manager.

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
| GitService | `studio/src/modules/git-cruiser/GitService.ts` |
| GitTypes | `studio/src/modules/git-cruiser/GitTypes.ts` |
| IPC Channels | `studio/src/modules/git-cruiser/GitIpcChannels.ts` |
| Main process handlers | `studio/src/bifrost/electron-main/registerGitHandlers.ts` |
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
| **Merge Change Overview Pane (fallback)** | `studio/src/modules/git-cruiser/merge/panes/MergeChangeOverview.tsx` |
| **Merge Resolution Utility** | `studio/src/modules/git-cruiser/merge/writeResolvedFile.ts` |
| **Merge Styles (generic)** | `studio/src/modules/git-cruiser/merge/styles/component.merge-editor.scss` |
| **BPMN Merge Resolver** | `studio/src/modules/bpmn-editor/merge/BpmnMergeResolver.tsx` |
| **BPMN Merge Change Overview Pane** | `studio/src/modules/bpmn-editor/merge/panes/BpmnMergeChangeOverview.tsx` |
| **BPMN Merge Styles** | `studio/src/modules/bpmn-editor/merge/styles/component.bpmn-merge.scss` |

## Merge Conflict Resolution

The merge conflict resolver is a **pluggable** subsystem for resolving Git merge conflicts visually. The generic merge framework lives in `git-cruiser`, while type-specific visualization is delegated to the appropriate editor module (e.g., `bpmn-editor` for BPMN files).

### Architecture overview

The resolver follows the same pattern as the **EditorDocumentInspector**: each editor document type can optionally register a merge resolver component via `mergeResolverKey` / `mergeResolverConstructor` on the document type definition. The generic `MergeDocumentRenderer` in `git-cruiser` looks up the resolver at runtime; if none is registered, it falls back to a Monaco DiffEditor for text files.

Merge-specific actions (zoom, conflict navigation, etc.) use a **std-style command dispatch pattern**: generic commands like `git.merge.zoomToViewport` dispatch to type-specific variants like `git.merge.zoomToViewport.bpmn`. When no variant is registered, the command is simply disabled.

The merge editor is opened as a singleton document type (`merge`) at the fixed URI `merge://resolver`.

### Key files

| File | Purpose |
|------|---------|
| `git-cruiser/merge/MergeDocumentModel.ts` | Generic model: file list, blobs, progress, navigation, resolution tracking |
| `git-cruiser/merge/MergeDocumentRenderer.tsx` | Generic renderer: toolbar, title bar, resolution progress, delegates content to resolver or text fallback |
| `bpmn-editor/merge/BpmnMergeResolver.tsx` | BPMN resolver: three-panel layout (ours/theirs viewers + result viewer), diff overlays, element classification, per-element resolution |
| `bpmn-editor/merge/BpmnMergeResultModeler.tsx` | Read-only result preview: tracks resolution state and rebuilds merged XML via `xmlMergeEngine` on every change |
| `bpmn-editor/merge/panes/BpmnMergeChangeOverview.tsx` | BPMN-specific merge pane: classified elements, per-attribute conflict resolution, auto-applied tracking |
| `bpmn-editor/merge/autoApplyEngine.ts` | Pure XML-level merge engine: applies non-conflicting changes from apply-side to starting-side DOM |
| `bifrost/common/EditorDocumentMergeResolverManager.ts` | Registry for merge resolver components (key→component map) |
| `studio-sdk/src/contracts/MergeTypes.ts` | `MergeResolverProps`, `ElementResolution`, `MergeResolutionProgress` contracts |

### Types

| Type | Location | Purpose |
|------|----------|---------|
| `GitMergeStateKind` | `GitTypes.ts` | `'merge' \| 'rebase' \| 'cherry-pick' \| null` |
| `GitMergeState` | `GitTypes.ts` | Merge kind + list of conflicted `GitFileStatus` entries |
| `GitConflictBlobs` | `GitTypes.ts` | `{ base, ours, theirs }` — each `string \| null` |
| `MergeConflictKind` | `MergeDocumentModel.ts` | `'content' \| 'ours-deleted' \| 'theirs-deleted'` |
| `MergeFileType` | `GitTypes.ts` | `'bpmn' \| 'dmn' \| 'text' \| 'binary'` — determines rendering strategy |
| `MergeFileEntry` | `MergeDocumentModel.ts` | Per-file tracking: path, URI, resolved flag, fileType |
| `MergeResolverProps` | `studio-sdk/contracts/MergeTypes.ts` | Props contract for resolver components (blobs, conflictKind, operationKind, entry, resolverRef, callbacks) |
| `MergeOperationKind` | `studio-sdk/contracts/MergeTypes.ts` | `'merge' \| 'rebase' \| 'cherry-pick' \| null` |
| `ElementResolutionStatus` | `studio-sdk/contracts/MergeTypes.ts` | `'auto-applied' \| 'pending' \| 'accepted-ours' \| 'accepted-theirs' \| 'custom'` |
| `ElementResolution` | `studio-sdk/contracts/MergeTypes.ts` | `{ elementId, status }` |
| `MergeResolutionProgress` | `studio-sdk/contracts/MergeTypes.ts` | `{ totalConflicts, resolvedConflicts, isComplete }` |
| `ClassifiedElement` | `BpmnMergeResolver.tsx` | Per-element diff classification (BPMN-specific) |
| `MergeSideDetail` | `BpmnMergeResolver.tsx` | Per-side change detail (BPMN-specific) |

### IPC channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `IPC_INVOKE_GIT_MERGE_STATE` | renderer → main | Detect merge/rebase/cherry-pick state |
| `IPC_INVOKE_GIT_CONFLICT_BLOBS` | renderer → main | Retrieve base/ours/theirs via `git show :N:` |
| `IPC_INVOKE_GIT_MERGE_ABORT` | renderer → main | Abort merge |
| `IPC_INVOKE_GIT_REBASE_ABORT` | renderer → main | Abort rebase |
| `IPC_INVOKE_GIT_REBASE_CONTINUE` | renderer → main | Continue rebase |
| `IPC_INVOKE_GIT_CHERRY_PICK_ABORT` | renderer → main | Abort cherry-pick |
| `IPC_INVOKE_GIT_CHERRY_PICK_CONTINUE` | renderer → main | Continue cherry-pick |
| `IPC_INVOKE_GIT_REMOVE` | renderer → main | `git rm` for delete-conflict resolution |

### Commands

| Command | Arguments | Purpose |
|---------|-----------|---------|
| `git.merge.openResolver` | — | Opens or focuses the singleton merge resolver document |
| `git.merge.acceptOurs` | `model: MergeDocumentModel` | Writes "ours" blob to disk, stages, advances to next |
| `git.merge.acceptTheirs` | `model: MergeDocumentModel` | Writes "theirs" blob to disk, stages, advances to next |
| `git.merge.skip` | `model: MergeDocumentModel` | Advances to the next unresolved file |
| `git.merge.saveTextAndNext` | `model: MergeDocumentModel, content: string` | Writes user-edited text content, stages, advances (text files only) |
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

1. `GitService.refreshRepo()` now runs `IPC_INVOKE_GIT_MERGE_STATE` in parallel with `IPC_INVOKE_GIT_STATUS`.
2. `GitRepoState.mergeState` stores the result (kind + conflicted file list).
3. The Git Pane renders a "Merge Conflicts" section at the top of the tree when conflicts exist.
4. The status bar branch item shows `MERGING`/`REBASING`/`CHERRY-PICKING` suffix and conflict count.
5. `handlePullResult()` shows a notification with "Open Merge Resolver" action when pull results in conflicts.

### Three-panel BPMN merge layout

For `content` conflicts in BPMN files, the resolver renders a three-panel layout using nested `SplitterLayout`:

```
+-------------------+-------------------+
|  Ours (viewer)    | Theirs (viewer)   |
|  NavigatedViewer  | NavigatedViewer   |
|  read-only        | read-only         |
+---------+---------+---------+---------+
|           Result (viewer)             |
|           NavigatedViewer             |
|           read-only preview           |
+---------------------------------------+
```

The outer `SplitterLayout` is vertical (top: viewers, bottom: result viewer). The inner top splitter is horizontal (ours | theirs) — reusing the existing synced viewer infrastructure.

The result panel is a **read-only preview**, not an editor. `BpmnMergeResultModeler` holds both XML strings (starting-side and apply-side) and the resolution map. On every resolution change it re-runs `xmlMergeEngine` with an adjusted skip set and reloads the `BpmnViewerWithSync` with the rebuilt XML.

**Viewer ↔ Result viewer sync**: On result viewer ready, `wireResultModelerSync()` uses `addViewboxSync()` from ours viewer to the result viewer, keeping all three panels' viewports in sync.

### Operation-aware starting side

The merge engine's starting XML depends on the Git operation:

| Operation | Starting side | Apply side |
|-----------|---------------|------------|
| merge / cherry-pick | ours (your branch) | theirs (incoming) |
| rebase | theirs (base branch) | ours (replayed commits) |

The resolver reads `operationKind` from `MergeResolverProps` (which comes from `MergeDocumentModel.getMergeOperationKind()`) and parameterizes `startingSide` and `applySide`. All downstream logic (auto-apply, per-element accept, UI labels) is side-agnostic.

### Auto-apply engine (XML-level merge)

`autoApplyEngine.ts` exports `xmlMergeEngine()`, which merges non-conflicting apply-side changes into the starting-side XML at the **DOM level** using `DOMParser` / `XMLSerializer`. This replaces an earlier modeler-based approach that failed for structural changes (see `common-pitfalls.md` for details).

The function receives the starting-side XML, the apply-side XML, the apply-side diff (`BpmnDiffChangesByAction`), and the set of conflict element IDs. It returns `{ mergedXml, autoAppliedIds }`.

**Algorithm:**

1. Parse both XMLs as DOM documents
2. Build an index mapping element IDs to semantic nodes and DI nodes in both DOMs
3. For each non-conflict change in the apply-side diff:
   - **Deleted**: Remove the semantic element and its DI node (BPMNShape/BPMNEdge) from the starting DOM. Remove any `bpmn:flowNodeRef` entries in lanes.
   - **Updated**: Replace the semantic element in the starting DOM with the apply-side version (deep clone via `importNode`). Also replace the DI node if present.
   - **Moved** (layout only): Replace only the DI node.
   - **Added**: Copy the semantic element from the apply-side DOM into the starting DOM under the same parent (found by ID). Copy the DI node into the BPMNPlane. Add `bpmn:flowNodeRef` entries to lanes.
4. Serialize the merged DOM back to an XML string

**Ordering**: Deletions run before additions. Within deletions, connections are removed before shapes (to avoid orphaned references). Within additions, shapes are added before connections (so endpoints exist when connections are imported).

The merged XML is loaded into the visible `BpmnViewerWithSync` for display. On every subsequent resolution change, the merge is re-run with an adjusted skip set (see below) and the viewer is reloaded.

### Per-attribute resolution lifecycle

Resolution is tracked at the **conflict key** level, not at the element level. A single BPMN element can produce multiple conflict keys:

| Key format | Scope |
|---|---|
| `{elementId}` | Base properties (type, standard attributes, layout) |
| `{elementId}:cp:{propertyName}` | Individual custom property |

Utilities for constructing and parsing conflict keys are exported from `BpmnMergeResultModeler`: `makeBaseKey()`, `makeCpKey()`, `parseConflictKey()`.

Each conflict key gets a resolution status tracked in `BpmnMergeResultModeler.resolutionMap`:

```
auto-applied    ← non-conflicting, auto-applied from apply side
pending         ← conflict, not yet resolved
accepted-ours   ← user accepted ours
accepted-theirs ← user accepted theirs
```

The result viewer exposes key-level imperative methods (`acceptStartingSideForKey`, `acceptApplySideForKey`) alongside element-level batch methods (`acceptStartingSideForElement`, `acceptApplySideForElement`) that resolve all sub-keys of an element at once. Batch methods `acceptAllStartingSide` / `acceptAllApplySide` resolve all pending keys in one pass (single rebuild).

**Resolution → rebuild mechanism**: Instead of surgically modifying a hidden modeler, every resolution change triggers a full XML rebuild via `computeEffectiveSkipIds()` → `xmlMergeEngine()` → viewer reload. The effective skip set is computed from the initial conflict IDs, adjusted as follows:

- Conflict elements where ANY sub-key is resolved to "apply side" are **removed** from the skip set → the engine applies the donor version.
- Auto-applied elements that were reverted to "pending" are **added** to the skip set → the engine leaves the starting-side version.

This avoids the broken `modeling.updateProperties()` path that failed because diff attribute names are display-formatted (e.g. "Element Type" instead of "$type") and values are stringified.

`revertAutoApplied(elementId)` still operates at the element level, since auto-applied entries are always element-level (no compound keys for non-conflict changes).

Resolution progress (`MergeResolutionProgress`) counts conflict keys for elements classified as `'both'` (actual conflicts), not failed auto-applies. The `totalConflicts` counter therefore reflects the number of individually resolvable conflict units, not the number of elements.

Resolution progress is emitted via the `onResolutionChanged` callback on `MergeResolverProps`, flowing through the renderer to `MergeDocumentModel.updateResolutionProgress()`, which emits `EVENT_RESOLUTION_CHANGED`.

The "Resolve & Stage" button in the toolbar is enabled only when `isCurrentFileFullyResolved()` returns `true`. It calls `getResultXml()` on the resolver, writes to disk, stages, and advances.

Overlay status per element is derived from the compound keys: if any sub-key is `pending`, the element overlay shows `pending`.

### Toolbar button strategy

When `hasResolutionProgress` is true (BPMN resolver with content conflicts), the toolbar shows **only** the resolution-specific buttons ("Resolve & Stage", "Accept All Ours", "Accept All Theirs"). The per-file "Accept Ours" / "Accept Theirs" / "Accept & Edit" buttons are shown only for non-BPMN files or when no resolution progress is active.

This separation exists because the per-element buttons in the Merge Changes pane are the primary resolution mechanism for BPMN files — the toolbar "Accept All" buttons are batch operations for convenience.

### Whole-file accept with active result modeler

`git.merge.acceptOurs` and `git.merge.acceptTheirs` check for an active resolver API. When one exists, they batch-resolve all pending conflicts via `acceptAllOurs()` / `acceptAllTheirs()`, retrieve the merged XML via `getResultXml()`, and write that instead of the raw blob. This preserves any partial resolution work the user has done. If no resolver is active, the commands fall back to writing the raw blob directly.

### Merge Change Overview panes

Two separate panes cover merge change visualization, following the same separation-of-concerns principle as the rest of the merge subsystem:

**Generic fallback** (`git-cruiser/merge/panes/MergeChangeOverview.tsx`): Registered by the `git-cruiser` module. Displayed when the active merge document has no BPMN resolver (i.e., non-BPMN text files). Shows a simplified message directing the user to the diff editor.

**BPMN-specific** (`bpmn-editor/merge/panes/BpmnMergeChangeOverview.tsx`): Registered by the `bpmn-editor` module via `initializeBpmnPanes`. Displayed when `model.currentFileType === 'bpmn'`. Provides the full categorized element list with per-attribute conflict resolution. It accesses BPMN-specific data (classified elements, definitions metadata) through the `resolverRef` on the model, which is set by the active resolver component.

When the BPMN pane is active, its sections are displayed in this order:
1. **Resolution progress bar** — resolved / total conflict keys (counts compound keys, not elements)
2. **Conflicts** — grouped by element, with **per-attribute sub-entries** when an element has multiple conflict keys. Each sub-entry has its own "Accept Ours" / "Accept Theirs" buttons and resolution badge. Elements with a single conflict key show buttons directly on the element entry.
3. **Auto-applied** — elements that were automatically merged, each with a source label (Ours/Theirs) and a "Revert" button to demote back to `'pending'`
4. **Ours only** — including Definitions metadata changes from ours-vs-base diff
5. **Theirs only** — including Definitions metadata changes from theirs-vs-base diff

Definitions metadata (exporter name, version, etc.) are shown as non-navigable entries within the Ours/Theirs sections, keeping all side-specific information together rather than in separate "Definitions" sections.

The conflict badge count in the section header reflects the total number of conflict keys (not elements), matching the resolution progress counter.

### BPMN editor integration

`BpmnDocumentModel` detects conflict markers (`<<<<<<<`) in file content:
- On initial load (`create()`): shows an empty diagram with `mergeConflict: true` metadata.
- On file watcher change (`onChange()`): sets `mergeConflict: true` and skips modeler update.
- `BpmnDocumentRenderer` shows a conflict banner with "Open Merge Resolver", "Accept Ours", "Accept Theirs" buttons.

### Delete conflict handling

When one side deletes a file while the other modifies it, `git show :N:` returns `null` for the missing stage. The model sets `conflictKind` to `'ours-deleted'` or `'theirs-deleted'`, and the renderer shows a placeholder panel with a trash icon and a "Compare with base" link instead of a viewer.

### Non-BPMN text file support (opt-in)

By default, the merge resolver only walks `.bpmn` files. The setting `git.merge.includeNonBpmn` (default `false`) enables an opt-in mode that also includes non-BPMN text files.

**File classification** (`classifyFileType` in `MergeDocumentModel.ts`):
- `.bpmn` → `'bpmn'` — rendered with the registered `BpmnMergeResolver`
- `.dmn` → `'dmn'` — rendered with the registered `DmnMergeResolver`
- Known binary extensions (images, fonts, archives, executables, etc.) → `'binary'` — always excluded
- Everything else → `'text'` — rendered with the SDK's `DiffEditor` (Monaco)

**Text fallback behavior** (built into the generic `MergeDocumentRenderer`):
- Monaco `DiffEditor` showing ours (left) vs theirs (right), with an editable right (modified) side.
- The DiffEditor's `onContentChanged` callback tracks modifications, enabling a "Save & Next" button when the user edits content.
- "Save & Next" calls `git.merge.saveTextAndNext` which writes the edited content to disk, stages, and advances.
- Command-gated toolbar buttons (zoom, conflict nav) are automatically disabled since no type-specific commands are registered for text files.

**Language detection** (`getLanguageForFile`): Maps file extensions to Monaco language IDs. Falls back to `plaintext`.

### Registering a new merge resolver

To add merge conflict visualization for a new file type:

1. Create a React component implementing `MergeResolverProps` (from `studio-sdk/contracts/MergeTypes`).
2. Register it on the document type definition with `mergeResolverKey` / `mergeResolverConstructor`.
3. Optionally register type-specific merge commands (`git.merge.zoomToViewport.{docType}`, etc.) for toolbar/title bar actions.
4. Expose an imperative API via `props.resolverRef.current` for commands to reach the resolver.

## Clone Repository

**Command:** `git.cloneRepository` (searchable as "Git: Clone Repository...")

Three-step sequential dialog chain with protocol auto-detection and optional HTTPS credential support:

**Dialog 1 — Repository URL**: Single `text_input` for the URL. On submit, the protocol is auto-detected from the URL pattern (`git@...` / `ssh://...` → SSH, `https://...` / `http://...` → HTTPS). Invalid patterns show a validation error.

**Dialog 2 — HTTPS Credentials** (skipped for SSH): Username + masked token/password fields. Both are optional (public repos skip this step). A "Back" button returns to Dialog 1. Credentials are embedded into the URL in-memory (`https://user:token@host/repo`) for the git operations that follow.

**Between Dialogs 2 and 3 — Branch fetch**: `gitService.listRemoteBranches` is called with the effective URL. A sticky notification shows progress. On success, branches are passed to Dialog 3 as a pre-populated `select`. On failure, Dialog 3 falls back to a `text_input` for manual branch entry with the error shown as a hint.

**Dialog 3 — Branch + Destination**: `path_picker` for the destination folder (plain string, no JSON), plus either a `select` (branches loaded) or `text_input` (fallback). The repository is cloned into a subfolder named after the repo.

**Progress notifications**: Clone progress is streamed from the main process via `IPC_MESSAGE_GIT_CLONE_PROGRESS`. The renderer subscribes via `gitService.onCloneProgress()` and updates a sticky notification with stage + percentage. The notification is closed on completion or error.

**Solution integration** (post-clone):
- **Explicit `.essln` solution open**: `addFolderToSolution` + `saveSolutionFile` — folder is added to the current solution
- **All other cases**: Delegates to `std.solution.openDirectory`, which handles the open-here / open-in-new-window prompt

**UI entry points**: File menu (after "Add Folder to Solution"), command search, Start Page extra renderer, Editor Area Empty State extra action, Git Pane no-repo empty state.

## Connect Folder to Remote

**Command:** `git.connectFolderToRemote` (searchable as "Git: Connect Folder to Remote Repository...")

Converts a local folder that is not inside a git repo into a git repository connected to a remote. When invoked from command search (no args), prompts for a folder via `showOpenDirectory`. When invoked from a context menu, receives the folder URI as an argument.

Uses the same three-step dialog chain as Clone, except Dialog 3 contains the branch picker (no destination folder — the folder is already known) and an optional "new branch" text field.

**Dialog 3 — Branch selection:**
- Branch picker (select or text_input fallback)
- "Optional: Create new branch from selected base branch" text field. If left empty, the selected base branch is used directly. If a name is provided and the branch exists on the remote, git switches to it. If the name does not exist, a new local branch is created from the selected base branch.

**Clone-to-temp strategy** (implemented as a single composite IPC handler `IPC_INVOKE_GIT_CONNECT_TO_REMOTE` in `registerGitHandlers.ts`):

1. Clone the repo into a temp directory (`os.tmpdir()/evil-studio-connect-<timestamp>`) with progress reporting
2. *(Optional)* If `newBranch` was specified: check `git branch -a` in the temp clone — if `remotes/origin/<newBranch>` exists, `git checkout <newBranch>`; otherwise `git checkout -b <newBranch>` (creates a local branch from the cloned base branch)
3. Move the `.git` directory from the temp clone into the target folder (`fs.rename` with `EXDEV` fallback to `fs.cp` + `fs.rm` for cross-filesystem moves)
4. `git reset HEAD` — resets the index so git sees all local files as working-tree changes rather than staged deletions
5. `git status` — identify files that are in the branch but missing locally (shown as "deleted")
6. `git checkout HEAD -- <deleted files>` — restore only the missing branch files, leaving existing local files untouched
7. Clean up the temp directory

After completion, the target folder is a proper git repository on the selected branch (or the newly created branch). Any local files that differ from the branch appear as uncommitted modifications in the Git pane. Files that only exist locally appear as untracked. No conflict dialog is needed — the user resolves differences naturally through the Git pane.

**Progress notifications**: Reuses the existing `IPC_MESSAGE_GIT_CLONE_PROGRESS` mechanism from the clone command. The renderer subscribes via `gitService.onCloneProgress()` and updates a sticky notification.

**Error recovery**: On any failure, `.git/` is cleaned up via `deleteFilesAndDirectories` to restore the folder to its pre-connect state. The temp directory is cleaned up in a `finally` block.

**Context menu**: Appears on project roots and solution roots that are **not** inside a known git repo. Subdirectories within projects do not show this option — only the project root folder itself.

## HTTPS Credential Handling

`GIT_TERMINAL_PROMPT=0` is set at module level in `registerGitHandlers.ts`, preventing git from hanging on interactive credential prompts. Without this, `git ls-remote` on a private HTTPS repo would wait indefinitely for stdin input in the headless Electron main process.

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

## Next steps

- Git Config Wizard (local config only → Inherit global config, if set → optional next step after cloning repository, always callable from Git Pane and solution root folder, if the folder is part of a Git Repo)
- Per-element change history (`git log` per BPMN element)
- Inline gutter indicators (added/removed lines)
- recursive git repo and submodule detection
