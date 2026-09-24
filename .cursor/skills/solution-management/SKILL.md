---
name: solution-management
description: >-
  Guide for working with the Studio's Solution and Project system, including
  single-folder and multi-root (.bfwsln) solutions. Use when modifying solution
  management, file explorer behavior, project watchers, or the .bfwsln file
  format.
---

# Solution Management

The Studio's workspace model is built around Solutions and Projects. A Solution contains one or more Projects (folders). This skill covers the architectural layers, data flow, and conventions for modifying this system.

For full architectural reference, see [reference.md](reference.md).

## Core Concepts

- **Single-folder solution**: One directory opened as a Solution with one Project. No `.bfwsln` file. `solutionFileUri` is `undefined`, `isExplicitSolution` is `false`/`undefined`. This is the default mode.
- **Explicit solution**: A solution promoted to multi-root via "Add Folder" or opened from `.bfwsln`. `isExplicitSolution = true`. Always shows project root entries in the tree, even with one project.
- **Multi-folder solution**: Multiple directories managed via a `.bfwsln` file. `solutionFileUri` points to the file. Each directory is a separate Project.
- **`.bfwsln` access**: every read and write goes through `studio/src/bifrost/common/SolutionFile.ts`. Callers of `saveSolutionFile` get `false` when the file is unreadable and the user declines the repair dialog. The solution stays dirty.
- **Backwards compatibility**: Single-folder mode must always work identically to how it did before multi-root was added. Never introduce `.bfwsln`-specific logic that breaks the single-folder path.

## Layered Architecture

```
SolutionPane (React UI)  →  display and interaction
FileExplorerView          →  transforms Solution into tree view data
SolutionMediator          →  orchestration: I/O, watchers, persistence, events
SolutionManager           →  pure state management + .bfwsln file read/write
```

The `.bfwsln` I/O functions (`readSolutionFile`, `writeSolutionFolders`, `updateSolutionSettings`, `readSolutionSettings`, `readSolutionSettingsText`, `repairSolutionFile`) live in `SolutionFile.ts`. `SolutionManager` holds state only and has no file I/O.

State mutations always flow through `SolutionManager`. The `SolutionMediator` orchestrates side effects (watchers, persistence, recently opened). Never mutate `Solution` objects directly — use `SolutionManager` methods.

## Adding a New Solution Operation

1. Add the state mutation method to `SolutionManager` (emits `EVENT_SOLUTION_CHANGED`)
2. Add the orchestration method to `SolutionMediator` (manages watchers, auto-saves `.bfwsln`)
3. Types live on `SolutionMediator` / `SolutionTypes` in Studio (`studio/src/bifrost/common/SolutionMediator.ts`, `studio/src/bifrost/contracts/SolutionTypes.ts`)
4. Register the command in `initializeSolutionFileCommands.ts` (or `initializeSolutionCommands.ts` for non-multi-root commands, or a dedicated file like `initializeCreateSolutionCommand.ts` for self-contained features)
5. Add the command to the **File menu** and relevant **context menus** in `initializeMenus.ts` (see `gui-command-design` skill)

## `.bfwsln` File Format

```json
{
  "folders": [
    { "path": "/absolute/path/to/folder" },
    { "path": "/other/folder", "name": "Custom Display Name" }
  ],
  "settings": {}
}
```

- Paths are always absolute filesystem paths
- `name` is optional; defaults to the last path segment
- `settings` holds solution-scoped settings and is preserved when the solution file is rewritten

## Multi-Root UI Conventions

- Single-root (non-explicit): Project node is flattened away; files appear directly under the solution header
- Explicit solution (even with one project): Shows project root entries with icon `std/tree/project-{closed:open}` and menu `std/file-explorer/solution-root`
- Multi-root: Each project is a top-level entry with icon `std/tree/project-{closed:open}` and menu `std/file-explorer/solution-root`
- Project order matches the `.bfwsln` file order; entries within each project are sorted (directories first, then alphabetical)
- `projectRootUri` for drag-and-drop is `null` for explicit solutions and multi-root mode
- Start page uses `ph-fill ph-tree-view` icon for `.bfwsln` solutions and strips the `.bfwsln` extension from the label

## Dirty Tracking and Close

- `SolutionManager.isSolutionDirty()` returns `true` when the solution has unsaved structural changes (add/remove/rename/reorder) or is an explicit solution without a saved `.bfwsln` file
- `std.solution.closeSolution` prompts the user to save if dirty, then disposes all watchers and clears the solution
- All solution commands are accessible through both the command search and the File menu / context menus

## External Drag & Drop

External files and folders can be dragged from the OS into the Studio:

- **Solution open (File Explorer):** All file types accepted, copied into the target directory via `std.fileExplorer.copyExternalItems`. Uses `resolveTargetDirectory` (drop on file resolves to parent). Multi-root solutions prevent root-area drops — user must target a specific project.
- **Nothing open (File Explorer):** `.bpmn` files opened as single files, `.bfwsln` files opened as solutions, folders prompt a dialog to create a solution (pre-populates the Solution Wizard via `initialFolders` parameter on `std.solution.createSolution`) or open each in a separate window.
- **Editor area:** Only `.bpmn` files are opened. Folders and other file types are silently ignored.
- Path extraction uses `std.internal.getPathsFromFiles` (Electron-only, `webUtils.getPathForFile`). All handlers guard with `bifrost.commands.isRegistered()`.

## Edge Case Guards

- `addFolder()` rejects duplicate URIs and overlapping roots (parent/child relationships)
- `removeFolder()` prevents removing the last project
- Opening a solution when one is already open shows Cancel/Open Here/Open in New Window dialog
- Session restore detects `.bfwsln` by file extension and routes to `openSolutionFile()`
- Window title strips `.bfwsln` extension for display
