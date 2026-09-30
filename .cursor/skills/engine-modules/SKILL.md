---
name: engine-modules
description: >-
  Develop features for engine-related modules (engine-core, engine-workspace,
  engine-debugger, engine-model-viewer, engine-decision-viewer). Use when
  adding engine commands, calling the Engine API, subscribing to engine events,
  working with process instances or tasks, or building UI for engine connectivity.
---

# Engine Module Development

Engine modules talk to BFW-Engines through `EngineConnectionManager` (engine-core) and the `@elraptorus/bfw_engine_client` it creates per connection. Every operation that changes Engine state runs through a command.

For architectural details (command tables, events, URI scheme, file paths), see [reference.md](reference.md) → `docs/architecture/engine.md`.

## Dependency Rules

- `engine-core` is the shared foundation. `engine-workspace`, `engine-debugger`, `engine-model-viewer` and `engine-decision-viewer` may depend on it; `engine-core` never depends on them.
- `bpmn-core` / `bpmn-editor` never depend on engine modules. Engine modules may use `bpmn.*` commands.
- Cross-module feature access goes through commands (see the `bifrost-commands` skill). Command IDs of engine-core come from `ENGINE_COMMANDS` (`engine-core/commands/CommandContract.ts`), never string literals.

## The Connection Manager

`EngineConnectionManager` is registered as the shared resource `engineConnectionManager`. Models and command registrations resolve it once:

```typescript
const connectionManager = studio.getSharedRessource<EngineConnectionManager>('engineConnectionManager');
```

| Method | Use |
|---|---|
| `getConnection(engineId)` / `getConnectionByUrl(url)` | Connection (`engineId`, `url`, `state`, `client`, `info`) or `null` |
| `getClient(engineId)` | `BfwEngineClient` or `null` |
| `isConnected(engineId)` | Connectivity check, e.g. in `enabledWhen` |
| `extractEngineIdFromUri(uri)` | Engine ID from any engine document URI; do not write local URI parsers |
| `checkEngineConnectivity(uri)` | Document gate: `canOpen: (uri) => connectionManager.checkEngineConnectivity(uri)` |

A pane never parses the URI or resolves the client: it reads `model.getEngineId()` and runs commands.

## Where an Engine Call Lives

Components, panes, and renderers never call the client for an operation that changes Engine state. Read queries inside a document model's `refresh()` (GraphQL, `get`, `list`) are fine.

1. **engine-core primitive** (`ENGINE_COMMANDS`, `engine-core/commands/register*Commands.ts`) — an operation used by more than one module. Client call only, no UI, throws on failure. Examples: `engine.startProcess`, `engine.abortProcessInstance`, `engine.finishUserTask`, `engine.confirmManualTask`.
2. **`engine.configured*` command** (engine-core) — a confirmation dialog and readable error notifications shared by several modules, delegating to the primitive (`configuredAbortProcessInstance`, `configuredRetryProcessInstance`).
3. **Module command** — a dialog-guarded or view-specific variant with a single consumer lives in that module (`engine.debugger.taskView.cancelUserTask`).
4. **Workspace canonical command + view wrappers** — `engine.workspace.<operation>` is the one implementation for all workspace views (no UI). `engine.workspace.<view>.<verb>Single` / `<verb>Selected` add preflight and UI (selection, notification, refresh) and run the canonical command. Add a wrapper only when it adds behaviour.

```typescript
// engine-core/commands/registerTaskCommands.ts — a primitive
bifrost.commands.register(
  ENGINE_COMMANDS.confirmManualTask,
  async (engineId: string, flowNodeInstanceId: string) => {
    await requireClient(engineId).manualTasks.confirm(flowNodeInstanceId);
  },
  { enabledWhen: (engineId: string) => connectionManager.isConnected(engineId) },
);

// A consumer — never the client directly
await bifrost.commands.executeCommand(ENGINE_COMMANDS.confirmManualTask, [engineId, flowNodeInstanceId]);
```

A new primitive is added to `ENGINE_COMMANDS` and `EngineCommandArgs`, registered from `engine-core/index.ts`, and documented in `docs/architecture/engine.md`. Catch typed SDK errors (`FniNotWaitingError`, `ProcessInstanceAlreadyTerminalError`, …) in the command that owns the UI, not in the primitive.

## Subscribing to Engine Events

For the Editor Document Model system (lifecycle hooks, model-to-renderer communication), see `docs/architecture/editor-documents.md`.

**Subscribe in the Editor Document Model, not in `onLoad`.** Each model knows its engine and can filter events.

- Engine WebSocket events: `EventDrivenRefresh` with `relevantEventTypes` and `engineId: this.engineId`.
- Connection lifecycle: `connectionManager.on('engine:connected' | 'engine:disconnected' | 'engine:connection-lost' | 'engine:reconnected' | 'engine:state-changed' | 'engine:info-updated' | 'engine:auth-token-changed', …)`.

```typescript
this.autoRefresh = new EventDrivenRefresh({
  connectionManager: this.connectionManager,
  studio: this.studio,
  settingsKey: SETTINGS_KEYS.taskInboxAutoRefresh,
  relevantEventTypes: ['UserTaskCreated', 'UserTaskFinished'],
  onRefresh: () => void this.refresh(),
  engineId: this.engineId,
});

this.authTokenSubscription = this.connectionManager.on('engine:auth-token-changed', (event: { engineId: string }) => {
  if (event.engineId === this.engineId) {
    void this.refresh();
  }
});
```

Only subscribe in `onLoad` for module-wide concerns not tied to one document (for example the task count poller).

## Document URI Scheme

Engine documents put the engine ID in the URI path (`engine://processes/{engineId}`, `engine-task-inbox://{engineId}`, `engine-debug://{engineId}/{processInstanceId}`, …). The full table is `docs/architecture/engine.md` §Document URI Scheme. Read the ID back with `connectionManager.extractEngineIdFromUri(uri)`.

## Property panes

When adding or editing a `PaneProvider` (debugger, model viewer, decision viewer, workspace), follow the `studio-panes` skill and `docs/architecture/panes.md`. `shouldBeDisplayed` is the only visibility gate; do not restate it in `Pane` / `PaneContent`.

## Pane Data Access Pattern (Debugger Pattern)

Panes in engine modules access data from the `EditorDocumentModel`, never from `studio.getSharedRessource()` or by reading `editorDocument.data.current` for working data:

1. The model stores working data (selections, parsed models, fetched lists) on **private fields** with **public getters**
2. Panes **cast** `props.editorDocumentModel` to the concrete model type and **call the getter**
3. To trigger pane re-renders on selection changes, the model increments a `selectionRevision` counter in metadata

```typescript
const model = props.editorDocumentModel as ProcessExplorerDocumentModel | null;
const selectedModels = model?.getSelectedModels() ?? [];
```

For what belongs in `currentData`, `metadata`, and private fields, see the `editor-document-data-placement` cursor rule and `docs/architecture/editor-documents.md` §Data Placement Rules.

## Multi-Engine Isolation

Engine document models scope all event handling to their own engine:

- Pass `engineId: this.engineId` when constructing `EventDrivenRefresh`
- Guard direct WebSocket event handlers with `if (payload?.engineId !== this.engineId) { return; }`
- Guard `engine:auth-token-changed` handlers with `if (event.engineId !== this.engineId) { return; }`

See `docs/architecture/engine.md` §Multi-Engine Isolation.

## Version Checks

Features that need a minimum Engine version wrap their UI in `EngineVersionGate` (engine-core):

```tsx
<EngineVersionGate engineVersion={connection?.info?.version} minimumVersion="1.4.0">
  <NewFeature />
</EngineVersionGate>
```
