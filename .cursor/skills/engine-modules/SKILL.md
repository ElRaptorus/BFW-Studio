---
name: engine-modules
description: >-
  Develop features for engine-related modules (engine-browser,
  engine-debugger, engine-bpmn-viewer). Use when adding engine
  commands, subscribing to engine events, working with process instances, or
  building UI for engine connectivity.
---

# Engine Module Development

Engine modules interact with external Engines via `bifrost.engines` (the `EngineManager`). This skill covers how to build features within this architecture.

For architectural details (event list, method signatures, settings, URI scheme), see [reference.md](reference.md).

## Dependency Rules

- `engine-core` and `EngineManager` are the shared foundation
- Consumer modules (`engine-browser`, `engine-debugger`, `engine-bpmn-viewer`) may depend on `engine-core`. The engine menubar is a sub-feature of `engine-browser` (`engine-browser/menubar/`).
- `engine-core` MUST NEVER depend on consumer modules
- When core operations need to notify consumers, emit events on `EngineManager` — consumers subscribe and react
- Cross-module feature access goes through commands (see the `bifrost-commands` skill)

## Getting an Engine Client

```typescript
const engineClient = bifrost.engines.getClient(engineUrl);
```

Returns a legacy `EngineClient`. Use it for API calls:

```typescript
const identity = bifrost.engines.getIdentityForRequest(engineUrl);
await engineClient.processInstances.query({ identity });
```

Always pass `identity` from `getIdentityForRequest` — it resolves the active user or falls back to the root access token.

## Checking Connectivity

```typescript
if (bifrost.engines.isCurrentlyOnline(engineUrl)) {
  // safe to make API calls
}
```

For document-level connectivity checks (e.g. `canOpen`):

```typescript
import { checkEngineConnectivity } from '../engine-browser/utils/engineConnectivityCheck';

canOpen: (uri: string) => checkEngineConnectivity(bifrost, uri),
```

## Subscribing to Engine Events

For the general Editor Document Model system (base class, lifecycle hooks, subscription patterns, model-to-renderer communication), see `docs/architecture/editor-documents.md`.

**Prefer subscribing in the Editor Document Model, not in `onLoad`.** Each model instance knows its own identity (engine URL, process instance ID) and can self-select relevant events. Cleanup is automatic via `onEditorDocumentWillClose`.

```typescript
this.internalEventSubscriptions.push(
  this.bifrost.engines.on(EVENT_ENGINE_CONNECTED, async (args: EngineEventArgs) => {
    if (args.url === this.engineUrl) {
      await this.refresh();
    }
  }),
);
```

Only subscribe in `onLoad` for module-wide concerns not tied to a specific document (e.g. updating a global activity bar view).

Key engine events to handle in document models:
- `EVENT_ENGINE_CONNECTED` / `EVENT_ENGINE_RECONNECTED` — refresh data, notify renderer
- `EVENT_ENGINE_CONNECTION_LOST` — show offline state
- `EVENT_ENGINE_ACTIVE_USER_CHANGED` — re-authenticate, refresh
- `EVENT_PROCESS_INSTANCE_RETRIED` — refresh if process model was updated

## Document URI Scheme

Engine documents encode parameters in the URI query string:

```typescript
const uri = `engineBrowser:MyView?engineUrl=${encodeURIComponent(engineUrl)}&processInstanceId=${id}`;
```

Parse with:

```typescript
import { getParametersFromDocumentUrl } from '../engine-core/UrlParser';

const params = getParametersFromDocumentUrl(document.uri);
const engineUrl = params.engineUrl;
const processInstanceId = params.processInstanceId;
```

## Registering Engine Commands

Shared engine operations belong in `engine-core`. Module-specific commands belong in the module itself.

**In engine-core** (shared operations):

```typescript
// studio/src/modules/engine-core/commands/MyOperation.ts
export default function registerMyCommands(bifrost: Bifrost): void {
  bifrost.commands.register('engine.myOperation', async (engineUrl: string) => {
    const client = bifrost.engines.getClient(engineUrl);
    const identity = bifrost.engines.getIdentityForRequest(engineUrl);
    await client.someApi.doSomething({ identity });
  });
}
```

Register in `engine-core/index.ts`:

```typescript
import registerMyCommands from './commands/MyOperation';
registerMyCommands(bifrost);
```

**In a consumer module** (module-specific):

```typescript
bifrost.commands.register('engineDebugger.myFeature', async (args) => {
  // module-specific logic
});
```

## Emitting Events from Engine-Core

When a core operation has side effects that consumers care about, add a public method on `EngineManager` and a corresponding event constant:

```typescript
// EngineManager.ts
export const EVENT_MY_OPERATION_COMPLETED = 'EVENT_MY_OPERATION_COMPLETED';

notifyMyOperationCompleted(engineUrl: string, data: SomeType): void {
  this.emit(EVENT_MY_OPERATION_COMPLETED, [{ engineUrl, data }]);
}
```

Call from the command:

```typescript
bifrost.engines.notifyMyOperationCompleted(engineUrl, result);
```

Note: `AbstractEmitter.emit()` is `protected`. Always add a public method on `EngineManager` rather than calling `emit` directly.

## Pane Data Access Pattern (Debugger Pattern)

Panes in engine modules access data from the `EditorDocumentModel`, never from `studio.getSharedRessource()` or by reading `editorDocument.data.current` for working data. The canonical pattern — established by the Debugger and adopted by all engine views — is:

1. The model stores working data (selections, parsed models, fetched lists) on **private fields** with **public getters**
2. Panes **cast** `props.editorDocumentModel` to the concrete model type and **call the getter**
3. To trigger pane re-renders on selection changes, the model increments a `selectionRevision` counter in metadata

```typescript
// In the pane
const model = props.editorDocumentModel as ProcessExplorerDocumentModel | null;
const selectedModels = model?.getSelectedModels() ?? [];
```

For full rules on what data belongs in `currentData`, `metadata`, and private fields, see the `editor-document-data-placement` cursor rule and `docs/architecture/editor-documents.md` §Data Placement Rules.

## Multi-Engine Isolation

Engine document models must scope all event handling to their own engine:

- Pass `engineId: this.engineId` when constructing `EventDrivenRefresh`
- Guard direct WebSocket event handlers with `if (payload?.engineId !== this.engineId) { return; }`
- Guard `engine:auth-token-changed` handlers with `if (event.engineId !== this.engineId) { return; }`

See `docs/architecture/engine.md` §Multi-Engine Isolation for architecture details.

## Version Checks

Some features require a minimum engine version:

```typescript
if (bifrost.engines.engineVersionMatches(engineUrl, '20.0.0')) {
  // feature available
}

if (bifrost.engines.engineVersionMatchesOneOf(engineUrl, ['19.5.0', '20.0.0'])) {
  // feature available in either version
}
```
