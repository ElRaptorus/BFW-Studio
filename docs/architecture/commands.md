# Command System

---

## Overview

The command system is the primary mechanism for orchestrating user interactions and enabling communication between modules. All interactions — button clicks, keybindings, menu entries, and cross-module calls — flow through `bifrost.commands.executeCommand()`.

Modules MUST NOT call each other's functions directly. Instead, the **providing** module registers a command and the **consuming** module calls it via `executeCommand`. This decouples modules, ensures consistent error handling, and allows commands to be disabled, searched, and bound to keybindings.

## Architecture

### CommandManager (Internal)

**Path:** `studio/src/bifrost/common/CommandManager.ts`

Low-level command storage and execution. Stores commands in `commands: { [name: string]: Command }`.

- `doRegisterCommand` builds the `Command` object with `name`, `description`, `visibleInSearch`, `callbackFn`, `enabledPredicateFn`, `expectsCommandContext`
- `CommandMediator.register()` maps `CommandRegistrationOptions` to these fields: `enabledWhen` → `enabledPredicateFn`, `expectsContext` → `expectsCommandContext`
- When `expectsCommandContext` is `true`, the callback receives `[commandContext, ...args]` instead of `args` only
- Command names must match `[a-zA-Z0-9\-_.]+`

### CommandMediator (Public API)

**Path:** `studio/src/bifrost/browser/CommandMediator.ts`
**SDK type declaration:** `studio-sdk/types/browser/CommandMediator.ts`

Orchestration layer around `CommandManager`. Adds performance marks, error handling, and user notifications.

| Method | Signature | Purpose |
|--------|-----------|---------|
| `executeCommand` | `executeCommand<T>(name, commandArgs?, commandContext?): T` | Runs a command; throws if disabled or execution fails |
| `tryToExecuteCommand` | `tryToExecuteCommand<T>(name, commandArgs?, commandContext?): CommandResult<T>` | Returns `{ success, returnValue/error }` instead of throwing |
| `isCommandEnabled` | `isCommandEnabled(name, commandArgs?): boolean` | Checks if the command is enabled; unknown commands return `false` (one `console.error` per name); predicate errors show at most one error notification per `(name, message)` |
| `isRegistered` | `isRegistered(commandName): boolean` | Checks if the command exists |
| `getClickHandler` | `getClickHandler(): (commandName, commandArgs?) => (event) => void` | Returns a curried click handler for React |
| `getCommands` | `getCommands(): Command[]` | Returns all registered commands (internal only) |
| `getEnabledCommandsVisibleInSearch` | `getEnabledCommandsVisibleInSearch(): Command[]` | Returns search-visible, currently enabled commands (internal only) |
| `register` | `register<T>(name, callbackFn, options?): void` | Registers a command; options control search visibility, description, context expectation, and enabled predicate |

### Execution Flow

1. `executeCommand(name, args)` calls `isCommandEnabled(name, args)`
2. If disabled → throws `Error`
3. If enabled → delegates to `commandManager.executeCommand<T>()`
4. Performance marks: `bifrost:executeCommand ${name} #start` / `#end`

### Enabled Predicates

- `isCommandEnabled` calls `commandManager.isCommandEnabled(name, args)`
- If the command is not registered, `CommandManager` returns `false` (does not throw), so UI that calls this during render does not trigger the mediator’s error-notification path
- Otherwise it invokes the command's `enabledPredicateFn` with `commandArgs` (or `[]`)
- If the predicate throws, `CommandMediator` shows an error notification at most once per distinct `(command name, error message)` and returns `false` (deduplication avoids a notify → workbench re-render → `isCommandEnabled` loop)

### Click Handler

`getClickHandler()` returns a curried function: `cmd(commandName, commandArgs?)` → `(event) => void`. It wraps the click event in a `CommandContext` with `type: 'mouse'` and passes it to `executeCommand`.

### Type Definitions

**Path:** `studio-sdk/types/contracts/CommandTypes.ts`

```typescript
type Command = {
  readonly name: string;
  readonly description: string | string[];
  readonly visibleInSearch: boolean;
  readonly callbackFn: (...args: any[]) => any;
  readonly enabledPredicateFn: CommandEnabledPredicateFn;
};

type CommandEnabledPredicateFn = (...commandsArgs: any[]) => boolean;

type CommandContext =
  | CommandContext_Keybinding
  | CommandContext_Mouse
  | CommandContext_Generic
  | undefined;

type CommandContext_Keybinding = {
  readonly type: 'keybinding';
  readonly keyboardEvent: KeyboardEvent;
};

type CommandContext_Mouse = {
  readonly type: 'mouse';
  readonly mouseEvent: MouseEvent;
};

type CommandContext_Generic = {
  readonly type: 'generic';
  readonly data: any;
  readonly event?: any;
};

type CommandResult<T> = CommandResult_Success<T> | CommandResult_Failure;

type CommandRegistrationOptions = {
  description?: string | string[];
  visibleInSearch?: boolean;   // default: false
  expectsContext?: boolean;    // default: false
  enabledWhen?: CommandEnabledPredicateFn;
};
```

## Command Registration

All commands are registered through a single `register(name, callback, options?)` method. The optional `CommandRegistrationOptions` object replaces the former four separate registration methods (`register`, `registerInCommandSearch`, `registerWithContext`, `registerInCommandSearchWithContext`).

| Option | Default | Purpose |
|--------|---------|---------|
| `visibleInSearch` | `false` | When `true`, the command appears in the command search palette |
| `description` | `undefined` | Human-readable label (or array of search aliases) shown in the palette; required when `visibleInSearch` is `true` |
| `expectsContext` | `false` | When `true`, the callback receives `CommandContext` as its first argument |
| `enabledWhen` | always enabled | Synchronous predicate; receives the same args as the callback (excluding context) |

**Internal command** (callable but not searchable):

```typescript
bifrost.commands.register('myModule.refresh', () => { /* ... */ });
```

**Search-visible command**:

```typescript
bifrost.commands.register(
  'myModule.openDashboard',
  () => { /* ... */ },
  { visibleInSearch: true, description: 'My Module: Open Dashboard' },
);
```

**Command with context** (e.g. keybinding or click handler that needs the triggering event):

```typescript
bifrost.commands.register(
  'myModule.handleKey',
  (context: CommandContext, arg: string) => { /* context.type is 'keybinding' | 'mouse' | 'generic' */ },
  { expectsContext: true },
);
```

**Search-visible command with enabled predicate**:

```typescript
bifrost.commands.register(
  'myModule.save',
  () => { /* ... */ },
  {
    visibleInSearch: true,
    description: 'My Module: Save',
    enabledWhen: () => hasUnsavedChanges(),
  },
);
```

Each command ID may be registered exactly once. Combine all desired behaviour in a single `register` call with the appropriate options.

## Renderer → Command: Pass the Model

When a document renderer triggers a command via `EditorToolbarButton`, `getClickHandler()`, or `executeCommand`, it should pass the `EditorDocumentModel` as a command argument rather than forcing the command handler to re-derive it asynchronously.

The renderer always has access to the model (resolved once during mount or constructor). Passing it directly:

- Eliminates redundant async lookups in the command handler
- Enables synchronous `enabledPredicateFn` checks on model state (e.g., checking progress, readiness)
- Reduces code duplication between renderer and handler

```typescript
// Registration — receives the model directly
bifrost.commands.register(
  'myModule.resolve',
  (model: MyDocumentModel) => { model.resolve(); },
  { enabledWhen: (model: MyDocumentModel) => model != null && model.canResolve() },
);

// Renderer — passes the model it already holds
<EditorToolbarButton
  studio={bifrost}
  command="myExtension.resolve"
  commandArgs={[this.model]}
/>

// Or with getClickHandler:
<button onClick={cmd('myModule.resolve', [this.model])}>Resolve</button>

// Or with executeCommand:
bifrost.commands.executeCommand('myModule.resolve', [this.model, additionalArg]);
```

**Exception**: The `std.editor.zoomToViewport.{documentType}` / `zoomToActualSize` / `zoomToSelectedElement` commands follow a convention of receiving `editorDocument` and resolving the model internally. This keeps them consistent across all document types that implement the zoom pattern.

## Naming Convention

Command names follow the strict schema `{group}.{module-segment}.{domain}.{action}`:

```
std.editor.focusOrOpenDocument
std.solution.openDirectory
bpmn.editor.getAllStartEventsForProcessId
engine.workspace.openProcessExplorer
engine.deploy
git.commit
dev.machineSanctum.open
```

The **first dotted segment** is the **permission group** and determines which `commands.{group}` plugin permission controls access. The seven groups are:

| Group | Description |
|-------|-------------|
| `std` | Core workbench, editor, solution, shell, window, settings, startpage, help, about |
| `bpmn` | BPMN editor, diff, linter, token simulator, FEEL |
| `dmn` | DMN editor, diff |
| `engine` | Engine core, workspace, model-viewer, decision-viewer, debugger, menubar |
| `git` | Git operations, merge |
| `plugins` | Plugin management |
| `dev` | Internal dev/lab tools |

Remaining segments are module-internal structure, using camelCase within each segment. Names must match `[a-zA-Z0-9\-_.]+`. Pattern regex: `[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+`

**Document-type qualifier convention**: Modules register per-document-type command variants by appending a type suffix: `std.editor.zoomToViewport.bpmn`, `git.merge.acceptOursForElement.dmn`. This cross-prefix pattern is accepted and documented.

## Cross-Module Communication Patterns

### Simple API command

Module A registers a command that Module B calls to get data or trigger an action.

Example: `engine-workspace` registers `engine.workspace.openProcessExplorer`, which `engine-model-viewer` calls to navigate to the process list.

### Render injection

One module provides content to another via a command. Example: `git-cruiser` calls `std.startpage.registerHeroCard` to inject a hero card descriptor into the start page. The legacy `std.startpage.setExtraRenderer` (raw JSX injection) is preserved for backward compatibility.

### Platform delegation

A generic command delegates to a platform-specific implementation when available. Example: `std.shell.openUrlInBrowser` checks for `std.shell.openUrlInBrowser.electron` and delegates if present, otherwise falls back to `window.open`.

### Guarded cross-module call

When the providing module may or may not be loaded, the caller checks `isRegistered` and optionally `isCommandEnabled` before calling `executeCommand`.

### Event-driven notification (foundation → consumer)

When a foundation module (`engine-core`, `bpmn-core`) performs an operation that consumers need to react to, it MUST NOT call consumer commands or manipulate consumer documents. Instead, the foundation emits an event on `EngineConnectionManager`, and consumers subscribe and react independently.

This preserves the dependency direction: consumers depend on core, never the reverse.

Example: `engine-core` emits `engine:event` on `EngineConnectionManager` after an engine WebSocket event arrives. `engine-debugger`'s document model subscribes to this event, filters by `engineId`, and refreshes itself when relevant. For details on how document models subscribe to events and communicate with renderers, see [editor-documents.md](editor-documents.md).

## Solution Commands

**Path:** `studio/src/modules/std/initializers/commands/initializeSolutionCommands.ts`

| Command | Purpose |
|---------|---------|
| `std.solution.openDirectory` | Opens a directory (or `.essln` file) as a Solution |
| `std.solution.refresh` | Triggers a Solution reload |
| `std.solution.addDirectory` | Creates a new directory within the Solution |
| `std.solution.newFile` | Creates a new file |
| `std.solution.duplicateFile` | Duplicates a file |
| `std.solution.renameFileOrDirectory` | Renames a file/directory |
| `std.solution.deleteSelectedElementsInFileExplorer` | Deletes selected elements |
| `std.solution.toggleHiddenFiles` | Toggles hidden file display |

## Solution File Commands (Multi-Root)

**Path:** `studio/src/modules/std/initializers/commands/initializeSolutionFileCommands.ts`

| Command | Purpose |
|---------|---------|
| `std.solution.addFolder` | Adds a folder to the Solution; auto-saves `.essln` if one exists |
| `std.solution.removeFolder` | Removes a folder from the Solution (with confirmation dialog) |
| `std.solution.renameProjectLabel` | Renames a project's label in the file explorer (via dialog) |
| `std.solution.closeSolution` | Closes the current solution (prompts to save if dirty) |
| `std.solution.saveSolution` | Saves the current Solution to its existing `.essln` file; falls back to "Save As" for unnamed solutions |
| `std.solution.saveSolutionAs` | Saves the current Solution to a new `.essln` file (shows Save dialog) |
| `std.solution.openSolutionFile` | Opens a `.essln` solution file (via dialog or given URI) |

## Create Solution Command

**Path:** `studio/src/modules/std/initializers/commands/initializeCreateSolutionCommand.ts`

| Command | Purpose |
|---------|---------|
| `std.solution.createSolution` | Opens a wizard dialog to create a new `.essln` solution file with selected directories |

The wizard uses a `text_input` control for the solution name and a `path_list` control for directory selection. After validation, it opens a native "Save As" dialog, writes the `.essln` file, and opens the new solution. Available from the command search, File menu, startpage, and empty state view.

`std.solution.saveSolution` and `std.solution.saveSolutionAs` are only enabled when `isExplicitSolution` is `true` (i.e., the solution was opened from `.essln` or promoted via "Add Folder").

### Opening Behavior

When `std.solution.openDirectory` is called with a solution already open, a dialog is shown:
- **Cancel**: No action
- **Open Here**: Replaces the current solution
- **Open in New Window** (Electron only): Opens in a new window

The dialog includes a "Remember my choice" checkbox. If checked, the preference is persisted in settings (`std.solution.openDirectory.remember`, `std.solution.openDirectory.default`) and future opens skip the dialog.

The command implementation is decomposed into focused helper functions: `removeStaleRecentEntry` (cleanup for missing paths), `isTargetAlreadyOpenHere` (window dedup), `promptForOpenAction` (dialog/preference logic), and `openSolutionOrDirectory` (dispatches between `.essln` and directory).

## File Explorer Commands

**Path:** `studio/src/modules/std/initializers/commands/initializeFileExplorerCommands.ts`

| Command | Purpose |
|---------|---------|
| `std.fileExplorer.dropItems` | Moves/copies files via drag & drop |
| `std.fileExplorer.hideDirByName` | Adds a directory name to exclude patterns |
| `std.fileExplorer.hideDirByPath` | Adds a relative path to exclude patterns |
| `std.fileExplorer.collapseAll` | Collapses all tree nodes |
| `std.fileExplorer.expandAll` | Expands all tree nodes |

## Editor Commands (file-related)

| Command | Purpose |
|---------|---------|
| `std.editor.openFolderAsSolution` | Opens a folder dialog and opens as Solution |
| `std.editor.focusOrOpenDocument` | Opens a document or focuses it if already open |
| `std.editor.openDocument` | Opens a document via dialog |

---

## Test Commands (`APP_TEST` only)

When `APP_TEST=true`, `initializeTestCommands()` in `studio/src/modules/std/initializers/initializeCommands.ts` registers additional commands for integration testing. These commands are invoked through the command search by `StudioAgent`, simulating real user interactions rather than executing JavaScript directly in the renderer.

Test commands that accept parameters use `bifrost.dialog.prompt()`, which `StudioAgent` fills in automatically. See [testing.md](../testing.md) for the full list and usage patterns.

---

## File Path Reference

| Component | Path |
|-----------|------|
| CommandManager | `studio/src/bifrost/common/CommandManager.ts` |
| CommandMediator | `studio/src/bifrost/browser/CommandMediator.ts` |
| CommandMediator SDK types | `studio-sdk/types/browser/CommandMediator.ts` |
| Command types | `studio-sdk/types/contracts/CommandTypes.ts` |
| Solution commands | `studio/src/modules/std/initializers/commands/initializeSolutionCommands.ts` |
| Solution file commands | `studio/src/modules/std/initializers/commands/initializeSolutionFileCommands.ts` |
| Create Solution command | `studio/src/modules/std/initializers/commands/initializeCreateSolutionCommand.ts` |
| FileExplorer commands | `studio/src/modules/std/initializers/commands/initializeFileExplorerCommands.ts` |
| Standard command initializers | `studio/src/modules/std/initializers/commands/` |
