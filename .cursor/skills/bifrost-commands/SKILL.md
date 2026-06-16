---
name: bifrost-commands
description: >-
  Use Bifrost's command system for orchestrating user interactions and
  cross-module communication. Use when registering new commands, calling
  commands across modules, wiring up click handlers, or designing module
  APIs.
---

# Bifrost Command System

Modules MUST NOT call each other's functions directly. The command system is the sole mechanism for cross-module communication and user interaction orchestration.

For architectural details (internal classes, type definitions, execution flow), see [reference.md](reference.md).

## Registration

All commands are registered via a single `register` method. Optional behavior is controlled through a `CommandRegistrationOptions` object:

```typescript
type CommandRegistrationOptions = {
  description?: string | string[];
  visibleInSearch?: boolean;   // default: false
  expectsContext?: boolean;    // default: false
  enabledWhen?: CommandEnabledPredicateFn;
};
```

### Internal command (not visible in command search)

```typescript
bifrost.commands.register(
  'myModule.doSomething',
  (arg1: string, arg2: number) => {
    // implementation
  },
  { enabledWhen: () => someConditionIsTrue },
);
```

### Search-visible command (appears in Ctrl+Shift+P / Cmd+Shift+P)

```typescript
bifrost.commands.register(
  'myModule.doSomething',
  (arg1: string) => { /* impl */ },
  {
    visibleInSearch: true,
    description: 'My Module: Do Something',
    enabledWhen: () => bifrost.solution.hasOpenSolution(),
  },
);
```

The description can be a `string[]` for multiple search terms:

```typescript
bifrost.commands.register(
  'myModule.doSomething',
  () => { /* impl */ },
  {
    visibleInSearch: true,
    description: ['My Module: Do Something', 'Alias: Perform Action'],
  },
);
```

### Context-aware command

When the command needs to know HOW it was triggered (keyboard, mouse, etc.):

```typescript
bifrost.commands.register(
  'myModule.doSomething',
  (context: CommandContext, arg1: string) => {
    if (context?.type === 'mouse') {
      // triggered by click — context.mouseEvent available
    }
  },
  { expectsContext: true },
);
```

`CommandContext` variants: `'keybinding'` (has `keyboardEvent`), `'mouse'` (has `mouseEvent`), `'generic'` (has `data` and `event`), or `undefined`.

## Execution

```typescript
// Standard — throws on failure or if disabled
const result = bifrost.commands.executeCommand<ReturnType>('moduleB.getData', [arg1, arg2]);

// Safe — returns { success, returnValue/error } instead of throwing
const result = bifrost.commands.tryToExecuteCommand<ReturnType>('moduleB.getData', [arg1]);

// Check before calling
if (bifrost.commands.isRegistered('moduleB.getData')) {
  bifrost.commands.executeCommand('moduleB.getData', [arg1]);
}

// Check if enabled
if (bifrost.commands.isCommandEnabled('moduleB.getData', [arg1])) {
  bifrost.commands.executeCommand('moduleB.getData', [arg1]);
}
```

Arguments are always passed as an array. The return type is determined by the registered callback.

## Click Handler (React)

For wiring commands to React `onClick` handlers:

```typescript
const cmd = studio.commands.getClickHandler();

<button onClick={cmd('myModule.doSomething')}>Click</button>
<button onClick={cmd('myModule.doSomething', [arg1, arg2])}>Click</button>
```

`getClickHandler()` returns a curried function. The click event is captured as `CommandContext` with `type: 'mouse'`.

For conditional enabling:

```typescript
const cmd = studio.commands.getClickHandler();
const enabled = studio.commands.isCommandEnabled('myModule.doSomething');

<button
  onClick={enabled ? cmd('myModule.doSomething') : undefined}
  className={enabled ? '' : 'disabled'}
>
  Click
</button>
```

## Naming Convention

Command names follow the pattern `{module}.{domain}.{action}`:

```
std.editor.focusOrOpenDocument
std.solution.openDirectory
bpmn.editor.getAllStartEventsForProcessId
engineBrowser.processInstanceList.filter
engine.deployToEngine
```

- Prefix with the module name to avoid collisions
- Use camelCase for multi-word segments
- Names must match `[a-zA-Z0-9\-_.]+`

## Cross-Module Communication Patterns

### Pattern 1: Simple API command

Module A registers a command that Module B calls to get data or trigger an action.

**Provider (engine-browser):**

```typescript
bifrost.commands.register(
  'engineBrowser.processInstanceList.filter',
  (model, filterKey, filterValue) => {
    model.setFilter(filterKey, filterValue);
  },
);
```

**Consumer (engine-debugger):**

```typescript
await bifrost.commands.executeCommand('engineBrowser.processInstanceList.filter', [
  model, 'state', 'running',
]);
```

### Pattern 2: Render injection

One module provides a React component to another via a command. Multiple providers can contribute components — the receiver collects them into an array.

**Provider (engine-browser):**

```typescript
bifrost.commands.executeCommand('startpage.setExtraRenderer', [StartpageConnectionsRenderer]);
```

**Receiver (startpage):**

```typescript
let startPageExtraRenderer: React.JSX.Element[] = [];
bifrost.commands.register('startpage.setExtraRenderer', (reactComponent: React.JSX.Element) => {
  startPageExtraRenderer.push(reactComponent);
});
bifrost.commands.register('startpage.getExtraRenderer', () => startPageExtraRenderer);
```

### Pattern 3: Platform delegation

A generic command delegates to a platform-specific implementation when available.

```typescript
bifrost.commands.register('std.shell.openUrlInBrowser', (httpUrl: string) => {
  if (bifrost.commands.isRegistered('std.shell.openUrlInBrowser.electron')) {
    bifrost.commands.executeCommand('std.shell.openUrlInBrowser.electron', [httpUrl]);
  } else {
    window.open(httpUrl);
  }
});
```

### Pattern 4: Guarded cross-module call

When the providing module may or may not be loaded:

```typescript
if (
  bifrost.commands.isRegistered('moduleB.doSomething') &&
  bifrost.commands.isCommandEnabled('moduleB.doSomething', [arg])
) {
  bifrost.commands.executeCommand('moduleB.doSomething', [arg]);
}
```

### Pattern 5: Event-driven notification (for foundation → consumer)

When a foundation module (`engine-core`, `bpmn-core`) performs an operation that consumers need to react to, do NOT call consumer commands. Instead, emit an event on the shared mediator and let consumers subscribe. This preserves the dependency direction (consumers depend on core, never the reverse).

**Foundation (engine-core):**

```typescript
// After a core operation succeeds
bifrost.engines.notifyProcessInstanceRetried(engineUrl, processInstanceIds, processModelWasUpdated);
```

**Consumer (engine-debugger) — in the document model:**

```typescript
this.bifrost.engines.on(EVENT_PROCESS_INSTANCE_RETRIED, async (args) => {
  if (args.engineUrl === this.engineUrl) {
    await this.refresh();
  }
});
```

See the `engine-modules` skill for more detail on this pattern.

## Renderer Commands: Always Pass the Model

When a document renderer invokes a command — via `EditorToolbarButton`, `getClickHandler()`, or `executeCommand` — **always pass the `EditorDocumentModel` as a command argument**. Never re-derive the model inside the command handler with an async lookup; the renderer already holds it.

```typescript
// Registration — model is the first parameter
bifrost.commands.register(
  'myModule.resolve',
  (model: MyDocumentModel) => { model.resolve(); },
  {
    enabledWhen: (model: MyDocumentModel) => model != null && model.canResolve(),
  },
);

// Renderer — passes the model it already has
<EditorToolbarButton
  studio={bifrost}
  command="myModule.resolve"
  commandArgs={[this.model]}
/>
```

Why:

- The renderer resolves the model once (during mount or constructor). Re-deriving it in every command handler adds latency and duplication.
- The `enabledWhen` predicate must be synchronous — it cannot `await` a model lookup. Receiving the model as a parameter lets the predicate check model state directly (e.g., `model.getProgress().remaining > 1`).
- This applies equally to `EditorToolbarButton`, raw `<button onClick={cmd(...)}>`, and `executeCommand(...)` calls from within the renderer.

**Exception**: `std.editor.zoomToViewport.{docType}` / `zoomToActualSize` / `zoomToSelectedElement` receive `editorDocument` by convention to stay consistent across document types.

## Enabled Predicates

The optional `enabledWhen` option controls whether a command can be executed. It receives the same arguments as the command callback:

```typescript
bifrost.commands.register(
  'std.solution.refresh',
  () => bifrost.solution.onRefresh(),
  { enabledWhen: () => bifrost.solution.hasOpenSolution() },
);
```

When a command is disabled:
- `executeCommand` throws an error
- `isCommandEnabled` returns `false`
- Menu entries and toolbar buttons using this command appear grayed out
