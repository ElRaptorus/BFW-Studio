# Workspace: Solutions, Projects, and File Handling

---

## Overview

File handling in the Studio consists of three layers:

1. **FileHandlingService** — Abstraction for file system access (read, write, traverse, watch)
2. **Solution/Project Model** — Data structure representing an open working directory
3. **Explorers** — `bifrost.explorers` (`ExplorerMediator`) holds one `FileExplorerView` per registered explorer; `ExplorerPane` renders each one

```
┌──────────────────────────────────────────────────────────────┐
│  ExplorerPane (React component, one pane per explorer)       │
│    └─ Tree (`studio/src/components/Tree/`)                   │
├──────────────────────────────────────────────────────────────┤
│  ExplorerMediator → FileExplorerView per explorer            │
├──────────────────────────────────────────────────────────────┤
│  SolutionMediator (persistence, watchers, events)            │
│    └─ SolutionManager (state management, serialization)      │
├──────────────────────────────────────────────────────────────┤
│  FileHandlingService (abstract)                              │
│    └─ FileHandlingServiceElectron (IPC → main process → fs)  │
└──────────────────────────────────────────────────────────────┘
```

---

## FileHandlingService

**Paths:**
- Abstract class: `studio/src/bifrost/common/FileHandlingService.ts`
- Electron implementation: `studio/src/bifrost/electron-renderer/FileHandlingServiceElectron.ts`

### URI Scheme

The Studio uses `file://` URIs as the primary addressing format for local files:

| Protocol | Usage |
|----------|-------|
| `file://` | Local files and directories |
| `buffer:` | Unsaved documents |
| `http://` / `https://` | Remote content |

Conversion methods:
- Path → URI: `getUriForFilename(filename)` — produces `file://` + absolute path
- URI → Path: `getLocalFilenameForUri(uri)` — strips `file://`, decodes URI

### File System Operations

All file system access goes through IPC to the Electron main process. The renderer has no direct `fs` access.

| Operation | Method | IPC Event |
|-----------|--------|-----------|
| Read file | `load(uri)` | `IPC_INVOKE_READ_FILE` |
| Write file | `save(uri, content)` | `IPC_INVOKE_WRITE_FILE` |
| List directory | `listDirectory(uri)` | `IPC_INVOKE_READ_DIR` |
| Traverse directory tree | `traverseDirectory(uri, cb)` | `IPC_INVOKE_TRAVERSE_DIRECTORY` |
| Traverse project (with include/exclude) | `traverseProject(project, cb)` | `IPC_INVOKE_TRAVERSE_DIRECTORY` |
| Create directory | `createDirectory(uri)` | `IPC_INVOKE_CREATE_DIR` |
| Copy file/directory | `copyFileOrDirectory(src, dest)` | `IPC_INVOKE_COPY_FILE_OR_DIRECTORY` |
| Rename file/directory | `renameFileOrDirectory(old, new)` | `IPC_INVOKE_RENAME_FILE_OR_DIRECTORY` |
| Delete file/directory (trash) | `deleteFilesAndDirectories(uris)` | `IPC_INVOKE_TRASH_ITEM` |
| Check existence | `doesFileOrDirectoryExist(path)` | `IPC_INVOKE_EXISTS` |

IPC events: `studio/src/bifrost/contracts/IpcEvents.ts`
Main process handlers: `studio/src/bifrost/electron-main/entrypoint-electron-main.ts`

### Traversal Cache

`FileHandlingServiceElectron` caches traversal results for 500ms to avoid repeated IPC calls.

### File Watching

Implemented via `chokidar` in the renderer process:

- `watchDirectory(uri, callback, ignoredPatterns?)` — watches a directory recursively
- `watchFile(uri, callback)` — watches a single file

Both return a `WatcherDisposable` with a `dispose()` method for cleanup.

Exclude patterns are compiled into a `chokidar` ignore filter via `Minimatch` instances (`buildChokidarIgnoreFilter`).

### FilePatternMatcher

**Path:** `studio/src/bifrost/common/FilePatternMatcher.ts`

Centralized glob pattern matching logic for include/exclude rules. Used both during traversal and for display in the File Explorer.

---

## Solution and Project

### Data Model

**Path:** `studio/src/bifrost/contracts/SolutionTypes.ts`

```typescript
type Solution = {
  type: 'solution';
  id: string;              // UUID, auto-generated
  name: string;            // Human-readable name (directory name or .bfwsln filename without extension)
  baseUri: string;         // file:// URI of the root directory (single-folder) or .bfwsln file URI (multi-folder)
  showHiddenFiles: boolean;
  projects: Project[];     // One or more projects
  solutionFileUri?: string; // URI of the .bfwsln file (undefined for single-folder solutions)
  isExplicitSolution?: boolean; // true when opened from .bfwsln or promoted via "Add Folder"
  views?: Record<string, { uri: string }>; // view folders declared in the saved .bfwsln (e.g. `landscapes`)
};

type Project = {
  type: 'project';
  id: string;           // UUID, auto-generated
  name: string;         // Human-readable name
  baseUri: string;      // file:// URI of the project directory
  files: {
    included: string[]; // Glob patterns for included files
    excluded: string[]; // Glob patterns for excluded files
  };
};
```

### Single-Folder vs Multi-Folder Solutions

- **Single-folder (default):** When a user opens a directory, a Solution with exactly one Project is created. `baseUri` = the directory URI, `solutionFileUri` = `undefined`, `isExplicitSolution` = `undefined`/`false`. No `.bfwsln` file is needed. This is fully backwards compatible.
- **Explicit solution (multi-folder or promoted):** When a user adds a folder via "Add Folder to Solution" or opens a `.bfwsln` file, `isExplicitSolution` is set to `true`. This means the tree always shows project root entries, even if only one project remains.
- **Multi-folder:** When a user opens a `.bfwsln` file, a multi-root solution is created. `solutionFileUri` = the `.bfwsln` file URI, `baseUri` = same as `solutionFileUri`. Each folder becomes a separate Project entry.

### Dirty Tracking

`SolutionManager` tracks unsaved changes via an internal `dirty` flag. The dirty state is set when:
- A folder is added or removed
- A project is renamed
- Projects are reordered

The flag is cleared when a solution file is saved (`setSolutionFileUri`) or when a new solution is opened. `isSolutionDirty()` also returns `true` for explicit solutions without a saved `.bfwsln` file.

### Close Solution

`closeSolution()` on `SolutionMediator` disposes all file watchers and clears the solution state. The `std.solution.closeSolution` command checks for unsaved changes and prompts the user before closing.

### `.bfwsln` Solution File Format

The `.bfwsln` ("Bifrost Forge World Solution") file is a JSONC file (JSON with comments) inspired by VS Code's `.code-workspace` format. Every read and write goes through `studio/src/bifrost/common/SolutionFile.ts` (`readSolutionFile`, `writeSolutionFolders`, `updateSolutionSettings`, `readSolutionSettingsText`, `repairSolutionFile`). `SolutionManager` has no file I/O.

```json
{
  "folders": [
    { "path": "/absolute/path/to/folder-a" },
    { "path": "/absolute/path/to/folder-b", "name": "Custom Name" }
  ],
  "settings": {},
  "views": { "landscapes": { "path": "landscapes" } }
}
```

- `folders[].path`: Absolute filesystem path. `name` is optional (defaults to the directory name).
- `settings`: Solution-scoped settings (see [settings.md](settings.md) §Scopes).
- `views`: one folder per analysis view (today only `landscapes`). `path` is relative to the `.bfwsln` (absolute paths are kept as written) and resolved to `Solution.views[viewId].uri` on read. The folder may lie inside a project or outside every project, and may not exist yet. Entries with a blank `path` are ignored. `writeSolutionView(solutionFileUri, fileHandling, viewId, folderUri | null)` writes or removes one entry read-modify-write; repair and Save As keep the block. Only a saved solution file has views; folder solutions and unsaved explicit solutions have none.
- `readSolutionFile()` parses with `comment-json`. Opening an unreadable file throws `SolutionFileUnreadableError` (`The solution file "<name>" could not be read: <reason>`) and offers no repair, because nothing has been written yet.
- Folder writes (`writeSolutionFolders`) and Solution settings writes (`updateSolutionSettings`) are read-modify-write. Only the touched part changes, so comments and unknown keys survive. A missing file is created by a folder write (Save As) and rejected by a settings write.
- A file that exists but cannot be read or parsed is never overwritten. The write throws `SolutionFileUnreadableError`. `std.solution.offerSolutionFileRepair` then opens a dialog. Repair copies the broken text to `<file>.broken` (or `.broken.1` … `.broken.99`, never overwriting an existing backup) and rewrites the file from the open solution with empty Solution settings. If an existing file cannot be read for the backup, the repair aborts and nothing is written. Declining leaves the file untouched and the solution dirty; `std.solution.closeSolution` then stays open instead of discarding the changes.
- A `save` that returns `false` is an error, not a successful write.
- The settings layer reads only the `settings` block (`readSolutionSettings`), so a file without `folders` still provides its settings.
- Writes to one file are queued inside the process. Two windows with the same solution open can still interleave; a file lock would be the upgrade.

### SolutionManager

**Path:** `studio/src/bifrost/common/SolutionManager.ts`

Pure state management without I/O. Holds the current `Solution` and provides mutation methods:

| Method | Purpose |
|--------|---------|
| `openDirectoryAsSolution(baseUri, name, excludedFiles)` | Creates a new single-folder Solution with one Project |
| `openSolutionFromFile(solutionFileUri, name, folders[], excludedFiles)` | Creates a multi-folder Solution from `.bfwsln` file data |
| `addFolder(baseUri)` | Adds a folder as a new Project, sets `isExplicitSolution = true` |
| `removeFolder(projectId)` | Removes a Project by ID (minimum 1 project enforced) |
| `renameProject(projectId, newName)` | Renames a project label |
| `reorderFolders(projectIds)` | Reorders projects by ID array |
| `setSolutionFileUri(solutionFileUri, solutionName)` | Updates the solution file association, clears dirty flag |
| `setView(viewId, folderUri \| null)` | Sets or removes one entry of `views` |
| `isSolutionDirty()` | Whether the solution has unsaved changes |
| `closeSolution()` | Clears the solution and dirty state |
| `hasOpenSolution()` | Whether a Solution is open |
| `getSolution()` | Current Solution (or `null`) |
| `toggleHiddenFiles()` | Toggles display of hidden files |
| `registerDefaultIncludedFiles(patterns)` | Registers default include patterns |
| `registerDefaultExcludedFiles(patterns)` | Registers default exclude patterns |
| `serialize() / deserialize(dump)` | Persistence via `LocalStorageItem` |

Emits `EVENT_SOLUTION_CHANGED` on every mutation.

`addFolder()` validates for duplicate and overlapping roots before adding.

### SolutionMediator

**Path:** `studio/src/bifrost/common/SolutionMediator.ts`

Orchestration layer around SolutionManager. Adds:

1. **Persistence:** Saves the Solution on every change via `LocalStorageItem` (instance scope)
2. **File watching:** Creates per-project `chokidar` watchers (one per project root directory, stored in a `Map<string, WatcherDisposable>`)
3. **Recently Opened:** Records opened Solutions in `RecentlyOpenedMediator`
4. **Settings integration:** Reacts to changes in `std.fileExplorer.exclude` and reloads the Solution
5. **Solution entry URI cache:** Maintains a `Set<string>` of all file URIs in the Solution (via `traverse` on the Designer explorer's `FileExplorerView`)
6. **View folder watchers:** `syncViewFolderWatchers()` watches every declared view folder that lies outside all projects; folders inside a project are covered by the project watcher

**Default exclude patterns:** `['.*', '**/.*', 'node_modules', '**/node_modules']`

| Method | Purpose |
|--------|---------|
| `openDirectoryAsSolution(uri)` | Opens single-folder: creates Solution, watcher, records in Recently Opened |
| `openSolutionFile(solutionFileUri)` | Opens `.bfwsln` file: reads folders, creates multi-root Solution, per-project watchers |
| `saveSolutionFile(solutionFileUri)` | Writes the current Solution. Returns `false` when the file is unreadable and the repair dialog is declined; the solution stays dirty |
| `repairSolutionFile(solutionFileUri)` | Backs up the broken file, then rewrites it from the open solution. Returns the backup URI, or `null` when there was nothing to back up |
| `addFolderToSolution(directoryUri)` | Adds a folder, sets up its watcher |
| `removeFolderFromSolution(projectId)` | Removes a folder, disposes its watcher, auto-saves `.bfwsln`. Clears the dirty flag only after the save succeeds |
| `renameProjectInSolution(projectId, newName)` | Renames a project and auto-saves `.bfwsln`. Clears the dirty flag only after the save succeeds |
| `isSolutionDirty()` | Whether the solution has unsaved changes |
| `closeSolution()` | Disposes all watchers, clears solution state |
| `containsEditorDocumentWithUri(uri)` | Checks whether a URI belongs to the open Solution |
| `listIncludedFileUris(pattern)` | Included files of the open solution whose URI matches `pattern`, sorted by URI; `[]` when no solution is open |
| `getViewFolderUri(viewId)` | Folder declared for `viewId`, or `null` without a saved solution file or entry |
| `setViewFolder(viewId, folderUri \| null)` | Writes the entry to the `.bfwsln` (relative path), updates the solution and the watchers. Throws without a saved solution file; returns `false` when the file is unreadable (the repair dialog is offered) |
| `onRefresh()` | Forces a reload by re-emitting `EVENT_SOLUTION_CHANGED` |
| `onElementAdded/Removed/Renamed/Moved(uri)` | Notifications for file changes |
| `toggleHiddenFiles()` | Delegates to SolutionManager |

### SolutionFunctions

**Path:** `studio/src/bifrost/common/SolutionFunctions.ts`

Utility functions:
- `isUriIncludedInSolution(solution, uri)` — checks whether a URI matches a project's include patterns and is not excluded

### Event Flow

```
SolutionManager.openDirectoryAsSolution()
    │
    ├─ emit EVENT_SOLUTION_CHANGED
    │
    ▼
SolutionMediator
    ├─ Saves to LocalStorage
    ├─ Re-emits EVENT_SOLUTION_CHANGED
    │
    ▼
Bifrost
    ├─ explorers.setSolution(solution) → every FileExplorerView reloads
    ├─ events.emit('solutionChanged', [solution])
    ├─ updateWindowTitleIfElectron()
    │
    ▼
Subscribers
    ├─ SearchAndSymbolIndexMediator → re-indexing
    ├─ EditorsPanesSettingsSolutionEventMediator → UI refresh
    └─ Workbench → forceUpdate()
```

---

## Explorers

**Paths:** `studio/src/bifrost/contracts/ExplorerTypes.ts`, `studio/src/bifrost/common/ExplorerMediator.ts`, `studio/src/bifrost/common/activities/FileExplorerView.ts`

An explorer is a perspective on the open solution: a file tree on one or more workbench pages. Every explorer has its own `FileExplorerView`, tree mediator and pane, but they all read the same `Solution`. The built-in Designer explorer (`DESIGNER_EXPLORER_ID = 'design'`, pane `design/workspace/explorer`) shows every project and is the only one that may reshape the solution. Other modules register further explorers, for example the Maps explorer of [bpmn-landscape.md](bpmn-landscape.md).

### `ExplorerDefinition`

| Field | Meaning |
|-------|---------|
| `id` | Explorer id; tree mediator `getExplorerTreeId(id)` = `std/file-explorer/<id>` |
| `paneId`, `pages` | Pane the explorer renders in, and the pages it belongs to |
| `source` | `{ kind: 'solution' }` (all projects) or `{ kind: 'view', viewId, includedFiles }` (the folder declared as `views.<viewId>` in the `.bfwsln`, filtered by `includedFiles`) |
| `label` | Pane title and root label; without it, the solution name |
| `emptyDirectories` | `'hide'` (default) prunes directories without visible files; the Designer uses `'show'` |
| `structuralOperations` | `true` only for the Designer: moving and dropping, new file and new directory, folder rename and delete, adding and removing solution folders, hiding directories, "Show Hidden Files" |
| `headerActions` | Extra `PaneHeaderIcon`s (`icon`, `tooltip`, `command`, `commandArgs?`, `dataTestId?`) |
| `emptyState` | Component shown instead of the tree while the explorer has no files |

### `bifrost.explorers` (`ExplorerMediator`)

| Method | Purpose |
|--------|---------|
| `register(definition)` | Adds an explorer and returns its `PaneObject` for a pane group. Throws on a duplicate id or pane |
| `getPane(id)` | `PaneObject` that renders the explorer through the shared provider `EXPLORER_PANE_PROVIDER_ID` |
| `get(id)`, `getView(id)` | Definition and `FileExplorerView`; throw for an unknown id |
| `getAll()`, `getByPaneId(paneId)`, `getViewExplorer(viewId)`, `getExplorersOfPage(pageId)` | Lookups |
| `getActiveExplorer()` | Explorer whose tree has focus or was focused last, restricted to the active page; else the page's first explorer; else the Designer |
| `getRevealTargets(uri)` | Explorers that show the file and belong to the document's page; else every explorer that shows it |
| `setSolution(solution \| null)` | Called by `Bifrost` on `EVENT_SOLUTION_CHANGED`; reloads every view |
| `registerDecorationProvider(provider, explorerIds?)` / `getDecorationSource(explorerId?)` | Decorations for all explorers or only the listed ones; sources merge styles and badges |

`EVENT_EXPLORER_VIEW_UPDATED` (`[explorerId]`) fires whenever a view finishes loading; `Workbench` re-renders on it. The std module registers the pane provider once (`ExplorerPane`) and places `getPane(DESIGNER_EXPLORER_ID)` in the explorer group.

### FileExplorerView

Transforms the `Solution` into view data for one explorer. Every node's metadata carries `explorerId`, which commands and menus use to find the explorer the user acted in.

```typescript
type SolutionViewData = {
  type: string;         // 'section'
  subtype: string;
  label: string;        // Explorer label or solution name
  labelTooltip: string; // Local path of the .bfwsln or the directory
  menuId?: string;      // 'std/file-explorer/solution' for solution-source explorers
  expanded: boolean;
  showHiddenFiles: boolean; // only in structural explorers
  pathId: string;       // baseUri
  entries: ProjectViewData[];
  badges: TreeBadge[];  // e.g. loading spinner
};

type ProjectViewData = {
  type: string;         // 'project'
  label: string;        // Project name
  labelIcon: string;    // 'std/tree/folder-{closed:open}' (single-root) or 'std/tree/project-{closed:open}' (multi-root)
  menuId: string;       // 'std/file-explorer/project' (single-root) or 'std/file-explorer/solution-root' (multi-root)
  uri: string;          // Project directory URI
  expanded: boolean;
  pathId: string;
  entries: TreeNode[];  // Files and directories
};
```

**Loading:** `setSolution(solution)` shows a loading badge and emits `EVENT_FILE_EXPLORER_OPENED_SOLUTION`; after 30 ms it builds the root entries, then emits the event again. A solution source builds one root per project (`traverseProject` with include/exclude). A view source builds one root for the declared folder as a synthetic project (`includedFiles`, the exclude setting plus the default excludes); without a saved solution, without the entry, or when the folder does not exist, it yields no roots and the pane shows `emptyState`.

**Tree nodes:** directories use `menuId: 'std/file-explorer/directory'`, files `'std/file-explorer/file'`; metadata holds `uri`, `type`, `openUriOnClick` and `explorerId`. File type icons come from `bifrost.editors.getDocumentTypeDefinitionByUri(uri)`.

**Protected view folders:** in solution-source explorers, every declared view folder and everything below it is marked `metadata.protected = true` and `metadata.protectedViewId`, drawn with a gray label. The folder itself gets the tooltip suffix "(<viewId> folder of this solution; read-only here, managed in the <label> explorer)". In the explorer that shows the view, the same files are not protected.

**Other members:** `containsFile(uri)`, `hasFiles()`, `getViewData()`, `traverse(callback)`, `clearSolution()`.

---

## ExplorerPane (UI)

**Path:** `studio/src/components/panes/activities/files/ExplorerPane.tsx`

One provider renders every explorer; it looks up the definition with `bifrost.explorers.getByPaneId(props.paneId)` (falling back to the Designer). The header shows new file, new directory and add folder or convert only for structural explorers, then refresh and Collapse All (with the explorer id), then `headerActions`. Drag and drop, the root drop target and external drops are wired only for structural explorers. The scroll position key is `explorer-scroll-<id>`.

### Display Logic

The `PaneContent` component decides how the file tree is rendered:

- **`emptyState` set and no files:** Shows the explorer's empty state
- **No Solution:** Shows "Open Folder" button
- **One project (non-explicit):** Flattens the hierarchy — shows the project's files directly as root entries (without the project as an intermediate level). Entries are sorted: directories first, then alphabetically.
- **Explicit solution (even with one project) or multiple projects:** Shows each project as a top-level section with a distinct folder-tree icon (`std/tree/project-{closed:open}`). Projects retain their order from the `.bfwsln` file. Entries within each project are sorted independently.

Drag-and-drop `projectRootUri` is set to `null` in multi-root mode (no root-level drops across projects).

### TreeView Mediator

The `Tree` React component registers a `TreeViewMediator` instance under the ID `std/file-explorer/<explorerId>` (the Designer: `std/file-explorer/design`) with the `ViewMediatorManager`. The mediator acts as an imperative bridge between the React render cycle and command/keybinding code that runs outside it. Selection state, expand/collapse state, and data reconciliation are handled internally by the `Tree` component (via `@headless-tree/core`).

The `TreeViewMediator` exposes:

- `collapseAll()` / `expandAll()` — delegates to the Headless Tree instance
- `getSelectedMetadata()` — reads the current selection and returns each item's metadata
- `waitForAndSelectEntriesByMetadataFilter()` — waits for matching entries to appear, expands their parents, and selects them
- `getViewData()` — snapshot of the visible tree for testing/debugging
- `notifyEntriesChanged()` — emits `EVENT_TREEVIEW_ENTRIES_CHANGED` so external listeners can react to data changes

### Commands and explorers

Explorer commands take an optional trailing `explorerId`; context menus pass it from the node metadata, keybindings fall back to `getActiveExplorer()`. Shared guards live in `studio/src/modules/std/initializers/commands/explorerGuards.ts`:

| Guard | Effect |
|-------|--------|
| `refuseOutsideStructuralExplorer` | Structural operations outside the Designer stop with "<Operation> only in the Designer explorer." |
| `refuseDirectoriesOutsideStructuralExplorer` | Folder rename and delete outside the Designer stop; single-file rename, delete and duplicate stay allowed |
| `refuseProtected` | In solution-source explorers, changing a protected node stops with a notice naming the view folder and the explorer that manages it |
| `confirmViewFolderChange` | Deleting, moving or renaming a folder that contains a view folder opens a danger dialog listing each view folder with its file count. Cancel is the default; the confirm button is dangerous |
| `updateOpenEditorDocuments` | After a move or rename, open documents at or below the old URI move to the new one. Runs before `followMovedViewFolders`, because the solution change that follows lets pages close documents their folder no longer covers |
| `followMovedViewFolders` | After a confirmed move or rename, `setViewFolder` points the entry at the new place. After a delete the entry stays, and the view reports the folder as missing |

Menus hide structural entries outside the Designer and changing entries on protected rows (dividers carry `visible` too).

### Delete and Rename on the selection

Without arguments, `std.solution.deleteSelectedElementsInFileExplorer` (Delete / Backspace, context menus) uses only selected items whose metadata `type` is `file` or `directory`. Project and solution roots carry their root directory as URI, so they are skipped and never deleted from disk; with only roots selected the command is disabled. Roots leave a solution only through "Remove from Solution". The multi-selection menu hides "Delete N Items" when no file or directory is selected.

Without arguments, `std.solution.renameFileOrDirectory` (F2 / Enter, context menus) is enabled only when exactly one item is selected and it is a file or directory. The keybinding mediator ignores disabled commands, so F2 / Enter do nothing for several items or a root.

### Drag & Drop (Internal)

- Uses `useDragSource` / `useDropTarget` from `components/DragAndDrop.ts` with item type `tree_item`. A tree item that cannot take the drop (itself, or a folder's own subfolder) refuses it; the drop does not fall through to the root zone
- Root drop zone for the project root directory
- On multi-selection, all selected URIs are used as sources
- Executes `std.fileExplorer.dropItems` with source URIs and target URI

### Drag & Drop (External Files from OS)

External files and folders can be dragged from the OS file manager into the Studio. Drop targets list `DRAG_TYPE_FILES` (`'files'`, exported from `components/DragAndDrop.ts`) in `accept`; it matches `dataTransfer.types` containing `Files`.

**Path extraction:** Browser `File` objects don't expose filesystem paths. Electron's `webUtils.getPathForFile(file)` provides local paths via the command `std.internal.getPathsFromFiles`. All drop handlers check `bifrost.commands.isRegistered()` for this command before proceeding (graceful degradation in non-Electron environments).

**Drop zone behavior:**

| Drop Zone | Solution open? | Behavior |
|-----------|---------------|----------|
| Tree item / root area | Yes | Copies all dropped files and folders into the target directory via `std.fileExplorer.copyExternalItems`. Drop on a file resolves to its parent directory. |
| Root area | Yes (multi-root) | Drop prevented (`canDrop` returns `false` when `projectRootUri` is null) — user must drop onto a specific project folder. |
| Empty state (nothing open) | No | `.bpmn` files opened as single files, `.bfwsln` files opened as solutions, folders prompt a dialog (create solution or open in separate windows). Other file types silently ignored. |
| Editor area | Either | Only `.bpmn` files are opened. Folders and other file types silently ignored. |

**Commands:**

| Command | Purpose |
|---------|---------|
| `std.internal.getPathsFromFiles` | Electron-only: extracts local paths from `File[]` via `webUtils.getPathForFile()` |
| `std.fileExplorer.copyExternalItems` | Copies external paths into a target directory (reuses `buildMovePlan` + `resolveConflicts`) |
| `std.fileExplorer.handleExternalDrop` | Handles drops when nothing is open: classifies, opens files, prompts dialog for folders |

**Global drag prevention:** A `useEffect` in `App.tsx` registers global `dragover` and `drop` handlers with `event.preventDefault()` to prevent Electron from navigating to dropped files.

### Context Menus

| Menu ID | Context |
|---------|---------|
| `std/file-explorer/solution` | Solution header (top-level section) |
| `std/file-explorer/project` | Project root (single-root mode) |
| `std/file-explorer/solution-root` | Project root (multi-root mode) — includes "Rename", "Remove Folder from Solution", "Add Folder to Solution" |
| `std/file-explorer/directory` | Directories — includes "Add Folder to Solution" |
| `std/file-explorer/file` | Files — includes "Add Folder to Solution" |

All file explorer context menus include "Add Folder to Solution ..." for discoverability. It is always placed directly after "New Directory ..." for consistent positioning.

BPMN linter Explorer items (`bpmn-linter/file/lint`, folder/project/solution-root Lint Folder, `bpmn-linter/solution/lint`, multi-select Lint N items) are always available — they are **not** gated on `bpmnLinter.enabled`. See [bpmn-linter.md](bpmn-linter.md) §Explorer menus.

---

## Search and Symbol Index

**Path:** `studio/src/bifrost/browser/SearchAndSymbolIndexMediator.ts`

Reacts to `EVENT_SOLUTION_CHANGED` and indexes all files of the Solution:

1. Tracks current project URIs in a `Set<string>`. On solution change, clears indexes for removed project URIs and re-indexes remaining ones.
2. Iterates over all projects: `solution.projects.forEach`
3. For each project: `traverseProject` with a callback that collects files for indexing
4. Loads each file, calls `searchIndex.index()` and `symbolIndex.index()`
5. Also updates the index on individual document changes (`EVENT_EDITOR_DOCUMENT_DATA_UPDATED`)

When closing a document, the index is only cleared if the file does not belong to the Solution (checked via `containsEditorDocumentWithUri`).

---

## Window Management and Session Restore

### Window Title

`Bifrost.updateWindowTitleIfElectron()` sets the window title:
- Without Solution: product name
- With single-folder Solution: `{DocumentName} — {FolderName}`
- With `.bfwsln` Solution: `{DocumentName} — {SolutionFileName}` (`.bfwsln` extension stripped)
- Without focused document: just the Solution label

### Session Restore

The Solution is persisted via `LocalStorageItem` (instance scope). On restart:

1. `SolutionMediator` constructor: If `restoreLastSession = true`, calls `deserialize()`
2. `Bifrost.postInitialize()`: Checks whether the saved Solution exists. For `.bfwsln` solutions, calls `openSolutionFile()`; for single-folder, calls `openDirectoryAsSolution()`.

The IPC `SOLUTION_CHANGED` message sends `solutionFileUri ?? baseUri` to the main process for window identity tracking.

### Multi-Window (Electron)

- `std.window.focusOrOpenWithSolution`: Checks whether a Solution is already open in a window; if so, focuses that window; if not, opens a new one
- `std.solution.openDirectory`: If a solution is already open, shows a dialog ("Cancel" / "Open Here" / "Open in New Window") with an optional "Remember my choice" checkbox. If remembered, the setting `std.solution.openDirectory.remember` / `std.solution.openDirectory.default` persists the preference and skips the dialog on future opens. Detects `.bfwsln` files and routes to `openSolutionFile()`; otherwise opens in-place. The command is decomposed into focused helper functions for validation, window deduplication, user prompting, and opening.

---

## Recently Opened

**Path:** `studio/src/bifrost/common/RecentlyOpenedMediator.ts`

Manages recently opened items in five categories:

| Category | Type | Max |
|----------|------|-----|
| `editor_document` | Tabs/documents | 30 |
| `files` | Files (file:// URIs) | 30 |
| `solution` | Solutions/folders | 30 |
| `command` | Recently executed commands | 30 |
| `search_term` | Search terms | 30 |

Persisted via `LocalStorageItem` in app scope (shared across windows).

---

## Settings

File Explorer settings below stay application-wide. Solution and project overrides for editor and linter settings are described in [settings.md](settings.md). Relevant application settings:

| Setting | Default | Purpose |
|---------|---------|---------|
| `std.fileExplorer.exclude` | `['.*', '**/.*', 'node_modules', '**/node_modules']` | Glob patterns for hidden files |
| `startpage.general.openOnStartupIfEmpty` | `true` | Whether the start page is shown on launch |

---

## File Path Reference

| Component | Path |
|-----------|------|
| Solution/Project types | `studio/src/bifrost/contracts/SolutionTypes.ts` |
| SolutionManager | `studio/src/bifrost/common/SolutionManager.ts` |
| SolutionFile (`.bfwsln` format) | `studio/src/bifrost/common/SolutionFile.ts` |
| SolutionMediator | `studio/src/bifrost/common/SolutionMediator.ts` |
| SolutionFunctions | `studio/src/bifrost/common/SolutionFunctions.ts` |
| FileHandlingService (abstract) | `studio/src/bifrost/common/FileHandlingService.ts` |
| FileHandlingServiceElectron | `studio/src/bifrost/electron-renderer/FileHandlingServiceElectron.ts` |
| FilePatternMatcher | `studio/src/bifrost/common/FilePatternMatcher.ts` |
| Explorer contract | `studio/src/bifrost/contracts/ExplorerTypes.ts` |
| ExplorerMediator (`bifrost.explorers`) | `studio/src/bifrost/common/ExplorerMediator.ts` |
| FileExplorerView | `studio/src/bifrost/common/activities/FileExplorerView.ts` |
| ExplorerPane | `studio/src/components/panes/activities/files/ExplorerPane.tsx` |
| Explorer command guards | `studio/src/modules/std/initializers/commands/explorerGuards.ts` |
| OpenEditorsPane | `studio/src/components/panes/activities/files/OpenEditorsPane.tsx` |
| TreeViewMediator | `studio/src/bifrost/browser/TreeViewMediator.ts` |
| Tree (React) | `studio/src/components/Tree/Tree.tsx` |
| TreeTypes | `studio/src/bifrost/contracts/TreeTypes.ts` |
| FileSystemTypes | `studio/src/bifrost/contracts/FileSystemTypes.ts` |
| IPC events | `studio/src/bifrost/contracts/IpcEvents.ts` |
| Main process handlers | `studio/src/bifrost/electron-main/entrypoint-electron-main.ts` |
| Solution commands | `studio/src/modules/std/initializers/commands/initializeSolutionCommands.ts` |
| Solution file commands | `studio/src/modules/std/initializers/commands/initializeSolutionFileCommands.ts` |
| Create Solution command | `studio/src/modules/std/initializers/commands/initializeCreateSolutionCommand.ts` |
| FileExplorer commands | `studio/src/modules/std/initializers/commands/initializeFileExplorerCommands.ts` |
| SearchAndSymbolIndexMediator | `studio/src/bifrost/browser/SearchAndSymbolIndexMediator.ts` |
| RecentlyOpenedMediator | `studio/src/bifrost/common/RecentlyOpenedMediator.ts` |
| Menu registration | `studio/src/modules/std/initializers/initializeMenus.ts` |
| Bifrost (main class) | `studio/src/bifrost/Bifrost.ts` |
