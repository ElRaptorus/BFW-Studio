# Workspace: Solutions, Projects, and File Handling

---

## Overview

File handling in the Studio consists of three layers:

1. **FileHandlingService** — Abstraction for file system access (read, write, traverse, watch)
2. **Solution/Project Model** — Data structure representing an open working directory
3. **FileExplorerView + SolutionPane** — UI layer rendering the file tree in the File Explorer

```
┌──────────────────────────────────────────────────────────────┐
│  SolutionPane (React component)                              │
│    └─ Tree (`studio/src/components/Tree/`)                   │
├──────────────────────────────────────────────────────────────┤
│  FileExplorerView (view data for the file tree)              │
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

The `.bfwsln` ("Bifrost Forge World Solution") file is a JSON file inspired by VS Code's `.code-workspace` format. The read/write functions (`readSolutionFile`, `writeSolutionFile`) and their types (`SolutionFileContent`, `SolutionFileFolder`) are co-located with `SolutionManager` in `studio/src/bifrost/common/SolutionManager.ts`.

```json
{
  "folders": [
    { "path": "/absolute/path/to/folder-a" },
    { "path": "/absolute/path/to/folder-b", "name": "Custom Name" }
  ],
  "settings": {}
}
```

- `folders[].path`: Absolute filesystem path. `name` is optional (defaults to the directory name).
- `settings`: Reserved for future per-solution settings. Currently written as `{}`.
- Read by `readSolutionFile()`, written by `writeSolutionFile()`.

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
5. **Solution entry URI cache:** Maintains a `Set<string>` of all file URIs in the Solution (via `FileExplorerView.traverse`)

**Default exclude patterns:** `['.*', '**/.*', 'node_modules', '**/node_modules']`

| Method | Purpose |
|--------|---------|
| `openDirectoryAsSolution(uri)` | Opens single-folder: creates Solution, watcher, records in Recently Opened |
| `openSolutionFile(solutionFileUri)` | Opens `.bfwsln` file: reads folders, creates multi-root Solution, per-project watchers |
| `saveSolutionFile(solutionFileUri)` | Writes the current Solution to a `.bfwsln` file |
| `addFolderToSolution(directoryUri)` | Adds a folder, sets up its watcher |
| `removeFolderFromSolution(projectId)` | Removes a folder, disposes its watcher, auto-saves `.bfwsln` |
| `renameProjectInSolution(projectId, newName)` | Renames a project, auto-saves `.bfwsln` |
| `isSolutionDirty()` | Whether the solution has unsaved changes |
| `closeSolution()` | Disposes all watchers, clears solution state |
| `containsEditorDocumentWithUri(uri)` | Checks whether a URI belongs to the open Solution |
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
    ├─ FileExplorerView.setSolution(solution)
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

## FileExplorerView

**Path:** `studio/src/bifrost/common/activities/FileExplorerView.ts`

Transforms a `Solution` into view data for the file tree.

### Data Types

```typescript
type SolutionViewData = {
  type: string;         // 'section'
  subtype: string;
  label: string;        // Solution name
  labelTooltip: string; // Local directory path
  menuId: string;       // 'std/file-explorer/solution'
  expanded: boolean;
  showHiddenFiles: boolean;
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

### Loading Process

1. `setSolution(solution)` is called
2. Immediately: Shows loading badge, emits `EVENT_FILE_EXPLORER_OPENED_SOLUTION`
3. After 30ms timeout: Asynchronously loads all project entries via `getProjectViewData()`
4. For each project: `getEntriesForFileList()` calls either `traverseProject` (with include/exclude) or `traverseDirectory` (all files)
5. Builds tree nodes via `buildTreeNode()`: directories and files with appropriate icon, menu ID, and metadata
6. Emits `EVENT_FILE_EXPLORER_OPENED_SOLUTION` again

### Tree Nodes

- **Directories:** `menuId: 'std/file-explorer/directory'`, `metadata: { openUriOnClick: false, uri }`
- **Files:** `menuId: 'std/file-explorer/file'`, `metadata: { openUriOnClick: true, uri }`

File type icons are resolved via `bifrost.editors.getDocumentTypeDefinitionByUri(uri)`.

---

## SolutionPane (UI)

**Path:** `studio/src/components/panes/activities/files/SolutionPane.tsx`

### Display Logic

The `PaneContent` component decides how the file tree is rendered:

- **No Solution:** Shows "Open Folder" button
- **One project (non-explicit):** Flattens the hierarchy — shows the project's files directly as root entries (without the project as an intermediate level). Entries are sorted: directories first, then alphabetically.
- **Explicit solution (even with one project) or multiple projects:** Shows each project as a top-level section with a distinct folder-tree icon (`std/tree/project-{closed:open}`). Projects retain their order from the `.bfwsln` file. Entries within each project are sorted independently.

Drag-and-drop `projectRootUri` is set to `null` in multi-root mode (no root-level drops across projects).

### TreeView Mediator

The `Tree` React component registers a `TreeViewMediator` instance under the ID `std/file-explorer/open-solution` with the `ViewMediatorManager`. The mediator acts as an imperative bridge between the React render cycle and command/keybinding code that runs outside it. Selection state, expand/collapse state, and data reconciliation are handled internally by the `Tree` component (via `@headless-tree/core`).

The `TreeViewMediator` exposes:

- `collapseAll()` / `expandAll()` — delegates to the Headless Tree instance
- `getSelectedMetadata()` — reads the current selection and returns each item's metadata
- `waitForAndSelectEntriesByMetadataFilter()` — waits for matching entries to appear, expands their parents, and selects them
- `getViewData()` — snapshot of the visible tree for testing/debugging
- `notifyEntriesChanged()` — emits `EVENT_TREEVIEW_ENTRIES_CHANGED` so external listeners can react to data changes

### Drag & Drop (Internal)

- Uses `react-dnd` with item type `tree_item`
- Root drop zone for the project root directory
- On multi-selection, all selected URIs are used as sources
- Executes `std.fileExplorer.dropItems` with source URIs and target URI

### Drag & Drop (External Files from OS)

External files and folders can be dragged from the OS file manager into the Studio. Uses `react-dnd`'s `NativeTypes.FILE` (constant `NATIVE_FILE_TYPE = '__NATIVE_FILE__'`, exported from `TreeItemRenderer`).

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

Settings are app-global (not per Solution or window). Relevant settings:

| Setting | Default | Purpose |
|---------|---------|---------|
| `std.fileExplorer.exclude` | `['.*', '**/.*', 'node_modules', '**/node_modules']` | Glob patterns for hidden files |
| `startpage.general.openOnStartupIfEmpty` | `true` | Whether the start page is shown on launch |

---

## File Path Reference

| Component | Path |
|-----------|------|
| Solution/Project types | `studio/src/bifrost/contracts/SolutionTypes.ts` |
| SolutionManager (+ .bfwsln I/O) | `studio/src/bifrost/common/SolutionManager.ts` |
| SolutionMediator | `studio/src/bifrost/common/SolutionMediator.ts` |
| SolutionFunctions | `studio/src/bifrost/common/SolutionFunctions.ts` |
| FileHandlingService (abstract) | `studio/src/bifrost/common/FileHandlingService.ts` |
| FileHandlingServiceElectron | `studio/src/bifrost/electron-renderer/FileHandlingServiceElectron.ts` |
| FilePatternMatcher | `studio/src/bifrost/common/FilePatternMatcher.ts` |
| FileExplorerView | `studio/src/bifrost/common/activities/FileExplorerView.ts` |
| SolutionPane | `studio/src/components/panes/activities/files/SolutionPane.tsx` |
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
