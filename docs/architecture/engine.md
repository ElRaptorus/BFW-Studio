# Engine Connectivity

---

## Overview

The Studio communicates with one or more external Engines (ThomasTheDaemonEngine instances). The engine is not part of this application — it is accessed remotely via the published `@elraptorus/daemonengine_client` npm package.

Engine connectivity is split into five modules:

- **`engine-core`** — Shared foundation: `EngineConnectionManager`, `JwtIdentityManager`, `WebSocketBridge`, commands, settings, reusable components, and the `DaemonEngineClient` instance lifecycle. Frozen barrel (`index.ts`) — signature changes require all consumer modules to be coordinated.
- **`engine-workspace`** — Operations hub: Dashboard, Process Explorer (with context menu, multi-select, quick actions), Instance Search, Task Inbox (auto-refresh, sidebar badge), Decision Catalog, Timer Schedules, Engine Sidebar Pane, document type registration, menus, and Run Menu commands.
- **`engine-model-viewer`** — Read-only BPMN process model inspector: direct `BpmnViewerComponentAdapter` rendering, ~20 type-specific right panes for element metadata/extensions, version browser, `BpmnElementOverlayManager`-based overlays (per-start-event play buttons, Call Activity target links, Business Rule Task DMN drill-down links, not-executable badges via `OverlayFactory`), export suite.
- **`engine-decision-viewer`** — DMN decision model inspector: `DmnViewerComponentAdapter` (read-only `dmn-js/lib/NavigatedViewer`) rendering with full multi-view support (DRD, Decision Table, Literal Expression, Boxed Expression), BKM/ItemDefinition/DecisionService detail panes, ad-hoc evaluation panel, version browser, import chain visualization, export suite. Theming via shared `dmn.scss` overrides ensures visual parity with the DMN Editor.
- **`engine-debugger`** — Diagram-first process instance inspector: event-driven lazy-load architecture (subscribe → snapshot → on-demand FNI detail), FNI state overlay pipeline, 4 right-pane groups (~50 panes: property, dataflow, scripting, documentation), bottom document inspector (6 views including FEEL Expression Runner), canvas overlay actions (task completion, event triggers, retry, Business Rule Task DMN trace drill-down), BPMN context pad, View menu integration, 4 settings, keyboard shortcuts. **Notable right-panel panes:** Context Variables (process-level `startedWithContext` as JSON, shown when nothing is selected), Input Token / Output Token (FNI token data, shown when an executed flow node is selected — replaced the former bottom-inspector Token Inspector), FEEL Expression Runner (bottom inspector, replaced legacy JS `new Function()` runner with the shared `FeelSimulatorEditor` component pre-filled with runtime FNI context mapped to canonical FEEL bindings). Includes a **DMN Trace Fragment** (`engine-debug.dmn-trace`) — a non-singleton fragment document that renders the DMN evaluation trace for an executed Business Rule Task using `DmnViewerComponentAdapter`, with execution overlays, an Evaluation Order inspector, and decision-level trace detail panes.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  engine-workspace   engine-model-viewer   engine-decision-viewer   engine-debugger  │
│      (lists,          (BPMN model          (DMN dmn-js viewer,      (PI runtime,    │
│       tables)          definitions)          multi-view)             FNI overlays)  │
│          │                  │                      │                      │          │
│          └──────────────────┴──────────────────────┴──────────────────────┘          │
│                                          │                                           │
│                              engine-core (frozen barrel)                              │
│                    (commands, components, managers, settings)                         │
│                                          │                                           │
│                         @elraptorus/daemonengine_client (HTTP + WS)                  │
│                                          │                                           │
│                         @elraptorus/daemonengine_sdk (types, contracts)               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  Engine (external, remote)                                                           │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Principle

`engine-core` forms the shared foundation. It MUST NOT depend on or know about consumer modules (`engine-workspace`, `engine-model-viewer`, `engine-decision-viewer`, `engine-debugger`). The dependency arrow always points downward: consumers depend on core, never the reverse. Consumer modules also MUST NOT depend on each other — cross-view navigation uses command IDs and URI conventions, never direct imports.

When core operations need to notify consumers, they emit events on `EngineConnectionManager`. Consumers subscribe and react.

### Renderer+Model Pattern (mandatory for all engine views)

All engine views MUST use the **Renderer+Model** pattern established by every other editor document in the Studio. Each engine view consists of:

1. An **`EditorDocumentModel` subclass** — owns business logic, data fetching, refresh timers, selection state, and cross-pane communication. Lifecycle hooks (`onEditorDocumentModelDidRegister`, `onEditorDocumentDidFocus`, `onEditorDocumentDidBlur`, `onEditorDocumentWillClose`) manage timers and subscriptions.
2. A **thin Renderer** — reads data from `editorDocument.data.current`, calls model methods for actions, handles only rendering concerns.

The `useEditorModel<T>()` hook (in `engine-workspace/hooks/`) bridges functional components to model instances.

Current models:
- `DashboardDocumentModel` — auto-refresh timer, health/info/stats fetching, settings-reactive interval
- `ProcessExplorerDocumentModel` — GraphQL `queryProcessModels` with server-side filtering (including `ilike` for names), sorting, and offset pagination (`limit`/`offset`). Two-step filter resolution for version fields (process versions queried separately, then filtered via `processId`). Nested `versions` include for latest version/deployedAt enrichment. Event-driven auto-refresh subscribes to `ProcessDefinitionDeployed`, `ProcessDefinitionUndeployed`, `ProcessDefinitionEnabled`, and `ProcessDefinitionDisabled` engine WebSocket events.
- `InstanceSearchDocumentModel` — GraphQL `queryProcessInstances` with server-side filtering (`ilike` for ID/businessKey, enum multi-select for state, date-range for startedAt), sorting, and offset pagination. Two-step filter resolution for process name and version.
- `TaskInboxDocumentModel` — GraphQL `queryFlowNodeInstances` filtered to user tasks in waiting state. Server-side `ilike` filters, date-range filters, sorting, and offset pagination.
- `DecisionCatalogDocumentModel` — GraphQL `queryDecisionDefinitions` with server-side filtering, sorting, and offset pagination. Two-step filter resolution for version fields. Nested `versions` include.
- `TimerSchedulesDocumentModel` — REST-backed (client-side filtering/sorting only; no GraphQL endpoint for timer schedules).

All GraphQL-backed models use server-provided offset page metadata (`hasNextPage`, `hasPreviousPage`, `pageNumber`, `lastPage`, `count`). This enables full page navigation including direct page jumps, page size changes, and First/Last buttons.

Wave 2+ views (Debugger, Process Instance Detail, etc.) MUST follow this same pattern.

### Command Contract (FROZEN)

All engine-core commands are registered at runtime but their IDs and argument shapes are exported as a typed contract:

- **`ENGINE_COMMANDS`** — `as const` object mapping logical names to string command IDs. Use `ENGINE_COMMANDS.deploy` instead of `'engine.deploy'`.
- **`EngineCommandArgs`** — maps each command ID to its typed argument tuple.
- **File:** `studio/src/modules/engine-core/commands/CommandContract.ts`

21 commands are frozen: `connect`, `connectWithDialog`, `disconnect`, `removeFromHistory`, `setAuthToken`, `deploy`, `deployBatch`, `startProcess`, `configuredStartProcess`, `startProcessAndOpenDebugger`, `configuredStartProcessAndOpenDebugger`, `abortProcessInstance`, `configuredAbortProcessInstance`, `retryProcessInstance`, `configuredRetryProcessInstance`, `deleteProcessInstance`, `configuredDeleteProcessInstance`, `triggerMessage`, `triggerSignal`, `triggerEscalation`, `triggerTimerEvent`.

### SDK Imports

SDK re-exports were removed from the engine-core barrel. All consumer modules import SDK types directly from `@elraptorus/daemonengine_sdk` and client types from `@elraptorus/daemonengine_client`. Engine-core only exports its own types, components, commands, settings, and utilities.

## EngineConnectionManager

**Path:** `studio/src/modules/engine-core/EngineConnectionManager.ts`
**Access:** `bifrost.getSharedRessource('engineConnectionManager')`

Extends `AbstractEmitter`. Manages multi-engine connection lifecycle: connect/disconnect/reconnect, active engine selection, `DaemonEngineClient` per engine, JWT identity (`JwtIdentityManager`), health overrides, and persisted connection list.

### Events

| Event | Trigger |
|-------|---------|
| `engine:state-changed` | Engine state transition (connecting/connected/disconnected/error) |
| `engine:list-changed` | Engine added/removed from connection list |
| `engine:connected` | First successful connection |
| `engine:disconnected` | Engine disconnected |
| `engine:reconnected` | Reconnection after loss |
| `engine:event` | WebSocket event forwarded from engine |
| `engine:auth-token-changed` | JWT token set/changed for an engine |

### Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `engine.internal.connections` | `[]` | Array of persisted engine connections |
| `engine.internal.activeEngineId` | `null` | Currently selected engine ID |
| `engine.internal.infoCache` | `{}` | Cached engine metadata per ID |
| `engine.internal.lastDeploymentTargetId` | `null` | Last engine used for deployment |

---

## Engine-Core Commands

**Path:** `studio/src/modules/engine-core/commands/`

`engine-core` registers all shared engine commands via the frozen `ENGINE_COMMANDS` contract (`CommandContract.ts`).

### Connection

| Command | Purpose |
|---------|---------|
| `engine.connect` | Connects to an engine URL |
| `engine.connectWithDialog` | Opens connection dialog, then connects |
| `engine.disconnect` | Disconnects from an engine |
| `engine.removeFromHistory` | Removes an engine from history |

### Authentication

| Command | Purpose |
|---------|---------|
| `engine.setAuthToken` | Sets a JWT auth token for an engine |

### Process Operations

| Command | Purpose |
|---------|---------|
| `engine.deploy` | Deploys a BPMN/DMN file to an engine |
| `engine.deployBatch` | Deploys multiple BPMN/DMN files in one batch |
| `engine.startProcess` | Starts a process on an engine |
| `engine.configuredStartProcess` | Opens the Configured Start dialog (start event picker, payload JSON editor, business key) then starts |
| `engine.startProcessAndOpenDebugger` | Smart start: if 1 start event, starts immediately; if 2+, opens dialog. Opens debugger on success |
| `engine.configuredStartProcessAndOpenDebugger` | Always opens the Configured Start dialog, then opens debugger on success |
| `engine.abortProcessInstance` | Aborts a running process instance (thin REST wrapper, no UI) |
| `engine.configuredAbortProcessInstance` | Opens a confirmation dialog, then delegates to `abortProcessInstance`. Catches `ProcessInstanceAlreadyTerminalError` with a user-friendly notification. Returns `boolean` (true if aborted). **File:** `registerConfiguredAbortCommands.ts` |
| `engine.retryProcessInstance` | Retries a failed/aborted/error process instance (thin REST wrapper, no UI) |
| `engine.configuredRetryProcessInstance` | Opens a confirmation dialog with version picker (same version, latest, or specific deployed version), then delegates to `retryProcessInstance`. Catches `IncompatibleVersionMigrationError` and `ProcessInstanceNotRetriableError` with user-friendly notifications. Accepts optional `RetryContext` for checkpoint reset (debugger) and version pre-fill. Returns `RetryResult \| null`. **File:** `registerConfiguredRetryCommands.ts` |
| `engine.deleteProcessInstance` | Deletes a terminal process instance (thin REST wrapper, no UI) |
| `engine.configuredDeleteProcessInstance` | Opens a confirmation dialog, then delegates to `deleteProcessInstance`. Catches `ProcessInstanceNotTerminalError` with a user-friendly notification. Returns `boolean` (true if deleted). **File:** `registerConfiguredDeleteCommands.ts` |

### Events

| Command | Purpose |
|---------|---------|
| `engine.triggerMessage` | Triggers a message event on the engine |
| `engine.triggerSignal` | Triggers a signal event on the engine |
| `engine.triggerEscalation` | Triggers an escalation inject on the engine (engine-wide waiting catchers) |

### Configured Retry Architecture

**File:** `studio/src/modules/engine-core/commands/registerConfiguredRetryCommands.ts`

The `engine.configuredRetryProcessInstance` command follows the same pattern as `engine.configuredStartProcess`: dialog in engine-core, then delegation to the raw command. It provides a shared retry UX consumed by both the Debugger and Instance Search.

**`RetryContext` interface** (exported from engine-core barrel):

| Field | Type | Purpose |
|-------|------|---------|
| `processModelId` | `string?` | Needed to fetch deployed versions for the version picker |
| `currentVersion` | `string?` | Pre-fills the "Same version (X)" label |
| `resetToFlowNodeInstanceId` | `string?` | FNI checkpoint reset — debugger-only |
| `flowNodeName` | `string?` | Human-readable label for checkpoint warning text |

**`RetryResult` interface** (return value):

| Field | Type | Purpose |
|-------|------|---------|
| `retried` | `boolean` | Whether the retry API call succeeded |
| `retryRequest` | `RetryRequest?` | The options that were sent to the engine |

Returns `null` when the user cancels.

**Version picker entries:**
1. "Same version (current)" — default, sends no `version` field
2. "Latest enabled version" — sends `version: "latest"` (resolved server-side by the Engine SDK)
3. Specific deployed versions — fetched via `client.processes.getVersions(processModelId)` when available

**Consumers:**
- **Debugger** — `engine.debugger.retryWithConfirmation` passes `RetryContext` (with optional FNI checkpoint) and calls `model.refresh()` on success. Accepts an optional `processInstanceId` override in `resetOptions` to route retries to embedded subprocess child PIs instead of the root PI.
- **Instance Search (single)** — `engine.workspace.instanceSearch.retrySingle` delegates with enriched `processModelId` / `currentVersion`
- **Instance Search (bulk)** — `engine.workspace.instanceSearch.retrySelected` pre-filters to retryable states, shows a batch confirmation dialog, then loops `engine.retryProcessInstance` per instance with per-call error handling and a summary notification

**Subprocess retry routing:** When the retry overlay is on a flow node inside an embedded subprocess, the FNI's `processInstanceId` differs from the root PI (the Engine creates a child PI per subprocess activation). `RetryAtFlowNodeLink` detects this and passes the child PI ID as `resetOptions.processInstanceId`. `retryWithConfirmation` forwards this ID to `engine.configuredRetryProcessInstance`, which retries the child PI with the inner FNI as the checkpoint.

**Retry overlay eligibility** (`shouldDisplayRetryOverlay` in `OverlayFactory.ts`):
- PI must be in a retryable state (`fatal`, `aborted`, `error`)
- Excluded BPMN types: all gateways + boundary events
- No multi-instance loop characteristics
- Not directly following an Event-Based Gateway (structural check via predecessor FNI's `flowNodeType`)
- Not an Event-Based Gateway loser (FNI state `aborted` + `typeProperties.reason === 'event_based_gateway_sibling_cancelled'`)
- Not in an open parallel branch (split gateway without matching join before the node)

**Debugger toolbar `enabledWhen` guards:**
- `engine.debugger.abortProcessInstance` — wraps the core `engine.configuredAbortProcessInstance` command (confirmation dialog); enabled only when the PI is in `Running` state
- `engine.debugger.retryWithConfirmation` — enabled only when the PI is in a retryable state (`Fatal`, `Aborted`, `Error`)

### Event Subprocess debugging

Event Subprocesses (ESPs) reuse the existing embedded-subprocess child-PI machinery with no debugger-specific code path. An ESP shell is a `bpmn:SubProcess` (`FlowNodeType.SubProcess`) that spawns a child PI; the Engine emits `SubProcessChildStarted` and stamps `type_properties.child_process_instance_id` on the shell FNI, exactly like an embedded subprocess.

- **Child-PI FNI loading:** `EngineAdapter.loadEmbeddedSubprocessChildFnis` collects child PI IDs from any `SubProcess` FNI's `childProcessInstanceId` and recursively fetches their FNIs. `loadNewSubprocessChildFnis` reacts to real-time `SubProcessChildStarted` events (`SnapshotEventType` `subprocess-child`). ESP children flow through this unchanged.
- **Inline rendering:** bpmn-js keeps ESPs expanded, so inner-scope nodes live on the same visible plane and carry their own BPMN element IDs. `OverlayFactory` maps FNIs to flow nodes by element ID, so inner-ESP FNIs render inline just like inner embedded-subprocess FNIs. No drill-down is offered (ESPs are never collapsed).
- **Non-interrupting multi-instance:** a non-interrupting ESP can spawn several concurrent child PIs whose inner nodes share the same BPMN element IDs. Each activation produces a distinct FNI on the same node; `ExecutableFlowNode.flowNodeInstances` accumulates all of them. The **Flow Node Instance selector** (`FlowNodeInstancePane.tsx`) lets the user pick between concurrent instances, the execution-count badge shows the total, and the "has unfinished instances" badge flags still-running ones — the same UX used for multi-instance loops. `getSelectedFlowNodeInstanceByFlowNode` provides the default selection.

- **ESP badge:** `SubProcessChildProcessInstancePane.tsx` reads `typeProperties.isEventSubprocess` from the selected FNI. When `true`, a Bootstrap badge ("Event Sub-Process") renders above the child-PI link, allowing users to distinguish an ESP shell from a plain embedded subprocess. The flag is propagated in two paths: (1) at snapshot load time, the engine persists `is_event_subprocess: true` in the FNI's `type_properties` (camelCased on wire to `isEventSubprocess`); (2) at real-time `SubProcessChildStarted` delivery, `SubscribeThenSnapshot.handleSubProcessChild` stamps `isEventSubprocess` into the in-memory FNI's `typeProperties`.

> **Pending (blocked on engine SDK):** the `interrupted_by_event_subprocess` FNI-reason label depends on the engine surfacing this reason in the SDK's type definitions. Once available, map it to a readable label in `engine-core/Formatters.ts`.

### Ad-hoc Sub-Process debugging

An Ad-hoc Sub-Process shell is a `bpmn:AdHocSubProcess` (still `FlowNodeType.SubProcess` on the wire, discriminated via `typeProperties.isAdHocSubprocess` / persisted `is_ad_hoc`) that spawns a child PI exactly like an embedded subprocess or Transaction shell. `BpmnProcessHelpers.ts` provides the detection helpers used throughout the debugger:

| Helper | Purpose |
|--------|---------|
| `isAdHocSubprocess(flowNode)` | `SubProcessTypeData.isAdHoc === true` on the model's flow node |
| `getAdHocInnerActivities(flowNode)` | Non-event inner activities of an ad-hoc subprocess (mirrors the linter's activity filter) |
| `isAdHocSubprocessFni(fni)` | Checks both `typeProperties.is_ad_hoc` (persisted, snake_case, from initial GraphQL snapshot load) and `typeProperties.isAdHocSubprocess` (camelCase, from the real-time `SubProcessChildStarted` event) defensively — either key marks the FNI as an ad-hoc shell |

- **Event handling (`SubscribeThenSnapshot.ts`):** `AdHocActivityActivated` and `AdHocSubProcessCompleted` are new `SnapshotEventType`s. `handleAdHocActivityActivated` increments `activationCount` and sets `lastActivatedFlowNodeId` on the shell FNI's `typeProperties` on every activation (an inner activity may activate multiple times — AH-D16). `handleAdHocSubProcessCompleted` sets `totalActivations` and `completionReason` when the shell finishes. `handleSubProcessChild` propagates `event.isAdHocSubprocess` into the shell FNI's `typeProperties`, mirroring the ESP `isEventSubprocess` flag.
- **Definition pane:** `AdHocSubProcessDefinitionPane.tsx` (registered for `shouldDisplayAdHocSubProcessInstancePane` in `ShouldBeDisplayedConditions.ts`) shows ordering, completion condition, `cancelRemainingInstances`, implementation, total activations, and completion reason, plus a live list of inner activities with their current status — derived from the child PI's FNIs, not from the shell FNI itself.
- **Child-PI badge:** `SubProcessChildProcessInstancePane.tsx` shows an "Ad-hoc Sub-Process" badge (via `isAdHocSubprocessFni`) above the child-PI link, the same UX pattern as the ESP badge.
- **Overlay badge:** `OverlayFactory.createFlowNodeInstanceOverlays()` renders `AdHocActivationCountBadge` below ad-hoc shell FNIs, showing `totalActivations` (once completed) or `activationCount` (while running). The flow-node backdrop additionally gets a `bpmn-element-overlay-backdrop--adhoc-subprocess` class for visual distinction from plain/transaction subprocess shells.
- **Inline rendering:** like Transaction and embedded subprocess shells, an ad-hoc shell can be collapsed or expanded in bpmn-js; inner activities are on their own plane and are reached via the same drill-down mechanism (`isInsideSubprocessPlane()` — see `docs/architecture/bpmn-editor-properties.md` §Subprocess Plane Behavior for the shared `$instanceOf('bpmn:SubProcess')` detection fix that also covers ad-hoc).

### Configured Abort Architecture

**File:** `studio/src/modules/engine-core/commands/registerConfiguredAbortCommands.ts`

The `engine.configuredAbortProcessInstance` command shows a confirmation dialog before aborting. Unlike retry, abort has no options — the dialog is purely a safety gate.

**Consumers:**
- **Debugger** — `engine.debugger.abortProcessInstance` delegates to `configuredAbortProcessInstance` and refreshes the model on success
- **Instance Search (single)** — `engine.workspace.instanceSearch.abortSingle` delegates to `configuredAbortProcessInstance` (context menu, shown only for running instances)
- **Instance Search (bulk)** — `engine.workspace.instanceSearch.abortSelected` pre-filters to running instances, shows a bulk confirmation dialog, then loops `engine.abortProcessInstance` per instance with per-call error handling and a summary notification

### Configured Delete Architecture

**File:** `studio/src/modules/engine-core/commands/registerConfiguredDeleteCommands.ts`

The `engine.configuredDeleteProcessInstance` command shows a confirmation dialog before permanently deleting a terminal process instance and all its data.

**Consumers:**
- **Debugger** — not wired; delete is a housekeeping action and belongs in the instance list only
- **Instance Search (single)** — `engine.workspace.instanceSearch.deleteSingle` delegates to `configuredDeleteProcessInstance` (context menu, shown only for terminal instances)
- **Instance Search (bulk)** — `engine.workspace.instanceSearch.deleteSelected` pre-filters to terminal instances, shows a bulk confirmation dialog, then loops `engine.deleteProcessInstance` per instance with per-call error handling and a summary notification

### Debugger Event Trigger Commands

These commands are registered by `engine-debugger`, not `engine-core`, but interact with the core trigger commands:

| Command | Purpose |
|---------|---------|
| `engine.debugger.triggerMessageEvent` | Opens message trigger dialog (payload pre-filled from `studio.examplePayload` if set on the catch element), then triggers via `engine.triggerMessage` scoped to the current process instance |
| `engine.debugger.triggerSignalEvent` | Opens signal trigger confirmation (no payload — signals are broadcast-only), then triggers via `engine.triggerSignal` |
| `engine.debugger.triggerEscalationEvent` | Opens escalation trigger confirmation (engine-wide inject, not a modeled throw), then triggers via `engine.triggerEscalation` |
| `engine.debugger.triggerTimerEvent` | Opens timer trigger confirmation, then triggers via `engine.triggerTimerEvent` |

#### Event Trigger Dialog Architecture

Each event type has its own dedicated confirmation dialog, split from the former shared `getMessageSignalEventDialogContent`:

- **Message**: `askMessageTriggerConfirmation` → `getMessageEventDialogContent`. Shows a JSON payload field pre-filled with `studio.examplePayload` (read from the moddle via `BpmnCustomPropertyAccessor`). Always scoped to the current process instance.
- **Signal**: `askSignalTriggerConfirmation`. Simple confirmation with a caution note. No payload field — the engine's signal API is broadcast-only with no payload.
- **Escalation**: `askEscalationTriggerConfirmation`. Simple confirmation that the inject is engine-wide (waiting boundaries and Event Subprocess starts), not a modeled throw. No payload field. OverlayFactory resolves the path code from `processDefinition.escalations` via `escalationRef` (`resolveEscalationCode`); catch-all boundaries (no ref / blank code) send the non-blank sentinel `__catchall__`.
- **Timer**: `askTimerTriggerConfirmation`. Simple confirmation stating the timer will be skipped.

**File:** `studio/src/modules/engine-debugger/libs/BpmnCustomPropertyAccessor.ts` — reads `evil:Property` values from the raw moddle `businessObject.extensionElements`, bypassing the SDK-parsed model.

### Engine-Workspace Commands (Run Menu & Menubar)

**Path:** `studio/src/modules/engine-workspace/initializers/initializeRunMenu.ts`

These commands are registered by `engine-workspace` and orchestrate deploy+start workflows, menubar interactions, and multi-engine state.

| Command | Purpose |
|---------|---------|
| `engine.deployCurrentProcess` | Deploys the currently focused BPMN/DMN file (F3) |
| `engine.deployAndOpenCurrentProcess` | Deploys and opens the Process Explorer (Shift+F3) |
| `engine.deploySolution` | Deploys all BPMN/DMN files in the current solution |
| `engine.quickDeployAndDebug` | Deploys the focused BPMN file, then starts in debugger (F5) |
| `engine.quickDeployAndConfiguredDebug` | Deploys the focused BPMN file, then opens Configured Start dialog (Shift+F5) |
| `engine.menubar.startCurrentProcessInDebugger` | Starts the currently focused process without deploying |
| `engine.menubar.configuredStartCurrentProcessInDebugger` | Configured Start for the currently focused process without deploying |
| `engine.menubar.playButton` | Shift-aware play button router (registered with `{ expectsContext: true }`). Click = start, Shift+Click = configured start. Context-aware: detects whether focused doc is a local BPMN file or an engine model viewer |
| `engine.menubar.deployButton` | Shift-aware deploy button router. Click = deploy, Shift+Click = deploy & open |
| `engine.menubar.setActiveEngine` | Engine dropdown onChange handler, calls `connectionManager.setActiveEngine()` |

**Shared deploy pipeline:** The four BPMN deploy commands (`deployCurrentProcess`, `deployAndOpenCurrentProcess`, `quickDeployAndDebug`, `quickDeployAndConfiguredDebug`) all call the shared `deployFocusedBpmnFile()` helper which encapsulates: file read → `ensureProcessVersions()` → deploy with `resolveVersionConflicts()` retry loop (max 3). Each command only differs in its post-deploy action. DMN deploy logic is handled inline in `deployCurrentProcess` and `deployAndOpenCurrentProcess` only (no version checks or conflict resolution for DMN).

### Menubar Structure

The engine menubar (center area) contains:

1. **Open Engine Dashboard** button — gauge icon, visible only when active engine is connected
2. **Play** button — Shift+Click enabled. Tooltip dynamically adapts to focused document type (local BPMN vs. model viewer)
3. **Deploy** button — Shift+Click enabled (Shift = deploy & open). Only visible when a deployable document is focused
4. **Engine Selector** dropdown (`MenuBarItem_Select`) — lists all connected/recent engines with `[OFFLINE]` prefix for disconnected ones. Falls back to a "(No engine)" text label when no engines exist

The menubar subscribes to `engine:list-changed`, `engine:state-changed`, `engine:disconnected`, `engine:connected`, and `engine:reconnected` events to trigger automatic rebuilds when engine state changes.

### File Explorer deploy menus

**Path:** `studio/src/modules/engine-workspace/initializers/initializeMenus.ts`

`engine-workspace` registers modifiers on the File Explorer context menus. Visibility uses the same rule as the menubar Deploy button: the **active engine is connected** (`getActiveEngineId()` + `isConnected`). JWT `deploy_bpmn` / `deploy_dmn` claims are **not** required to show the item — local engines often have no token, and the menubar already offers deploy in that case. The engine still enforces claims on the actual deploy call.

| Menu | Id | Label | Placement |
|------|----|-------|-----------|
| `std/file-explorer/file` | `engine-workspace/file/deploy` | Deploy to Engine | after `divider-before-compare-to`, own group, then a trailing divider. `.bpmn` / `.dmn` only. |
| `std/file-explorer/directory` | `engine-workspace/directory/deploy` | Deploy folder to Engine | after `divider-before-rename`, own group |
| `std/file-explorer/project` | `engine-workspace/project/deploy` | Deploy project to Engine | after `divider-before-rename-project`, own group |
| `std/file-explorer/solution-root` | `engine-workspace/solution-root/deploy` | Deploy folder to Engine | after `divider-before-rename`, own group |
| `std/file-explorer/multi-selection` | `engine-workspace/multi-selection/deploy` | Deploy N files to Engine | after `divider-before-delete`, own group |

File-menu order when both linter and deploy apply: New File group → **Deploy to Engine** → **Lint File** + Compare to → copy/rename/delete.

The context menu is rebuilt on every right-click (`getMenu`); no menubar-style event subscription is needed.

### Configured Start Dialog

**Path:** `studio/src/modules/engine-core/commands/registerConfiguredStartCommands.ts`

The Configured Start dialog opens when:
- The user explicitly requests it (Shift+Click, Shift+F5, or a "Configured Start" menu item)
- The `engine.startProcessAndOpenDebugger` command detects that the process has multiple start events (auto-fallback)

The dialog fetches the BPMN XML from the engine via `client.processes.get(processModelId, { includeXml: true })`, parses it with `DOMParser` to extract start events, and presents:

1. **Start Event** select (or text input if XML unavailable) — defaults to the first plain (None) start event
2. **Payload** key-value builder — a `key_value_builder` dialog content type for flat key-value pairs. Values are smart-parsed: `true`/`false` → boolean, valid numbers → number, `null` → null, everything else → string. No nested objects or arrays in v1.
3. **Context Variables** key-value builder — same builder UX, stored as a separate `context` field in the start request. Context variables are immutable process-level values accessible as `context.*` in FEEL expressions, independent from the token payload.
4. **Business Key** text input (optional)

Validation checks both builders for duplicate keys and incomplete rows (key without value or vice versa). Both builders are optional — zero rows is valid. The dialog calls `engine.startProcess` with the assembled `StartRequest` including `payload`, `context`, and `businessKey`.

---

## Document URI Scheme

Engine-related documents encode the engine ID and resource identifiers in the URI path.

### URI Patterns

| Module | Document Type | URI Pattern |
|--------|---------------|-------------|
| engine-workspace | `engine-dashboard` | `engine://dashboard/{engineId}` |
| engine-workspace | `engine-process-explorer` | `engine://processes/{engineId}` |
| engine-workspace | `engine-instance-search` | `engine://instances/{engineId}` |
| engine-workspace | `engine-task-inbox` | `engine-task-inbox://{engineId}` |
| engine-workspace | `engine-decision-catalog` | `engine://decisions/{engineId}` |
| engine-workspace | `engine-timer-schedules` | `engine://timers/{engineId}` |
| engine-model-viewer | `engine-model-viewer` | `engine-model://{engineId}/{processModelId}` |
| engine-decision-viewer | `engine-decision-viewer` | `engine-decision://{engineId}/{decisionModelId}` |
| engine-debugger | `engine-debugger` | `engine-debug://{engineId}/{processInstanceId}` |
| engine-debugger | `engine-debug.user-task-view` | `fragment+engine-debug.user-task-view:…` |
| engine-debugger | `engine-debugger.json-property` | `fragment+engine-debug.json-property:…` |
| engine-debugger | `engine-debugger.process-json-property` | `fragment+engine-debug.process-json-property:…` |
| engine-debugger | `engine-debugger.docs` | `fragment+engine-debug.docs:…` |
| engine-debugger | `engine-debugger.inspector-item` | `fragment+engine-debug.inspector-item:…` |
| engine-debugger | `engine-debug.dmn-trace` | `fragment+engine-debug.dmn-trace:…` |

### Parsing

**Path:** `studio/src/modules/engine-core/helpers/checkEngineConnectivity.ts`

- `extractEngineIdFromUri(uri)` → `string` — extracts the engine ID from any engine document URI

All engine document types use `canOpen: (uri) => checkEngineConnectivity(bifrost, uri)` to verify the target engine is online before opening.

---

## Engine Editor Documents

Engine modules register editor document types for engine-related views. For the general Editor Document system (type registration, model base class, renderer/inspector contracts, model-to-renderer communication patterns, subscription best practices), see [editor-documents.md](editor-documents.md).

### Engine Event Subscriptions in Models

Engine document models subscribe to `EngineConnectionManager` events to react to connectivity changes and engine operations. Subscriptions are stored and disposed in `onEditorDocumentWillClose`. Each model self-selects events by comparing the event's `engineId` against its own engine ID.

Key events handled by engine document models:
- `engine:connected` / `engine:reconnected` — refresh data
- `engine:disconnected` — show offline state
- `engine:auth-token-changed` — re-authenticate, refresh
- `engine:event` — WebSocket events (process deployed/undeployed, state changes) filtered by `engineId`

---

## DMN Trace Fragment

The DMN Trace Fragment (`engine-debug.dmn-trace`) is a non-singleton fragment document that renders the DMN evaluation trace produced by an executed Business Rule Task. Each fragment is bound to a specific Flow Node Instance and operates independently of the Debugger's current selection.

### Architecture

- **Document Type:** `engine-debug.dmn-trace`
- **URI:** Built with `getUrlForOpenInNewTab('engine-debug.dmn-trace', parentDebuggerUri, flowNodeInstanceId, { engineId, processInstanceId, flowNodeInstanceId })`. Conforms to the standard fragment URI contract (`fragmentId` = FNI ID, parent = debugger session URI `engine-debug://{engineId}/{processInstanceId}`).
- **Model:** `DmnTraceFragmentModel` (`engine-debugger/dmn-trace/DmnTraceFragmentModel.ts`) — full `EditorDocumentModel` subclass that fetches the FNI detail (including `typeProperties` with DMN trace data in snake_case), retrieves the DMN XML via `client.decisions.get(decisionRef, { includeXml: true })`, parses it with `parseDmn()`, and manages DRG selection state via private model fields with public getters.
- **Renderer:** `DmnTraceFragmentRenderer` (`engine-debugger/dmn-trace/DmnTraceFragmentRenderer.tsx`) — renders the DRG canvas using `DmnViewerComponentAdapter` (shared with `engine-decision-viewer`), applies execution overlays, and provides toolbar actions for zoom, "View Definition" (opens `engine-decision-viewer`), and inspector toggle.
- **Inspector:** `DmnTraceInspector` (`engine-debugger/dmn-trace/DmnTraceInspector.tsx`) — "Evaluation Order" table showing decisions in sequential evaluation order with hit policies, matched rules, results, and durations.

### Data Flow

1. Debugger overlay on executed BRT → `engine.debugger.openDmnTrace` command
2. `DmnTraceFragmentModel` parses URI → fetches FNI via GraphQL (`getFlowNodeInstance` with `typeProperties`) → extracts `decision_ref` from `typeProperties`
3. Model fetches DMN XML via `client.decisions.get(decisionRef, { includeXml: true })` → parses with `parseDmn()`
4. Renderer creates `DmnViewerComponentAdapter`, initializes with DMN XML, applies trace overlays
5. Selection events propagate to right-side property panes via model getters (panes cast `props.editorDocumentModel` to `DmnTraceFragmentModel`)

### Execution Overlays

- **Evaluated decisions:** Green badge with duration (ms) and matched rule count, positioned at bottom-right of each DRG decision shape
- **Unevaluated decisions:** Dimmed semi-transparent overlay covering the entire shape

### Property Panes (right-side)

| Pane | Shows When | Content |
|------|-----------|---------|
| Trace Overview | No DRG element selected | Decision ref, hit policy, duration, FNI metadata |
| Decision Trace Detail | Decision element selected | Hit policy, duration, inputs, matched/unmatched rules, result |
| Coercion Trace | No DRG element selected (if coercions exist) | Input coercion details: original value, coerced value, target type |
| BKM Trace | Decision with BKM invocations selected | Hierarchical BKM invocation tree with parameters, results, nested calls |

### Type Properties (snake_case)

DMN trace data in `FlowNodeInstance.typeProperties` uses snake_case keys (not camelCase like REST `evaluate()` responses). Key interfaces are defined in `DmnTraceTypes.ts`:

- `DmnFlowNodeTypeProperties` — top-level: `mode`, `decision_ref`, `hit_policy`, `matched_rules`, `result`, `duration_us`, `trace`
- `SnakeCaseEvaluationTrace` — `decisions`, `input_coercions`
- `SnakeCaseDecisionTrace` — `decision_model_id`, `decision_name`, `hit_policy`, `matched_rules`, `unmatched_rules`, `result`, `duration_microseconds`, `bkm_traces`, `import_traces`

### Commands

| Command | Purpose |
|---------|---------|
| `engine.debugger.openDmnTrace` | Opens the DMN trace fragment for a given engineId/processInstanceId/flowNodeInstanceId |
| `std.editor.zoomToViewport.engine-debug.dmn-trace` | Zoom DRG canvas to viewport |
| `std.editor.zoomToActualSize.engine-debug.dmn-trace` | Zoom DRG canvas to 1:1 |
| `engine.debugger.dmnTrace.viewDefinition` | Open the referenced DMN definition in `engine-decision-viewer` |

---

## SDK and Client Packages

Engine modules import types and client directly from the published npm packages:

```typescript
import type { ProcessInstance } from '@elraptorus/daemonengine_sdk';
import { DaemonEngineClient } from '@elraptorus/daemonengine_client';
```

The `EngineConnectionManager` creates and manages `DaemonEngineClient` instances per connected engine. Engine-core exports its own types, components, commands, settings, and utilities via its barrel (`index.ts`), but does not re-export SDK or client types.

---

## Multi-Engine Isolation

The Studio supports multiple simultaneous engine connections. Each engine view (Process Explorer, Decision Catalog, Dashboard, Task Inbox, Instance Search, Timer Schedules, Model Viewer, Decision Viewer) is scoped to a single engine via the `engineId` embedded in its document URI. Isolation is enforced at three layers:

### Engine-scoped event filtering

**`EventDrivenRefresh`** accepts an optional `engineId` in its constructor options. When set, the `eventHandler` compares `payload.engineId` against the configured value and ignores events from other engines. All six workspace models pass `engineId: this.engineId` when constructing their `EventDrivenRefresh` instance.

**Model Viewer and Decision Viewer** subscribe directly to WebSocket events via `engine:event`. Their handlers include an `if (payload?.engineId !== this.engineId) { return; }` guard.

**`engine:auth-token-changed`** handlers in all models compare the event's `engineId` against `this.engineId` before triggering a refresh, preventing cross-engine re-authentication cascades.

### Document-scoped data via model getters

All selection state and working data (parsed models, fetched lists, computed state) live on private model fields exposed through public getters. Panes access data by casting `props.editorDocumentModel` to the concrete model type — the same pattern the Debugger has always used. See the Data Placement Rules section in `docs/architecture/editor-documents.md` for details.

### Future work: replace `engineId` with engine URL

The current `engineId` is a synthetic Studio-generated identifier (`engine-{timestamp}-{random}`). Since the engine URL is already the true unique identifier (duplicate connections are prevented by `findByUrl()`), a future cleanup should remove `engineId` entirely and re-key all internal structures, document URIs, and event filtering by normalized URL. This is tracked as a separate refactoring.

---

## Deployment Version Workflow

The engine requires every deployed BPMN process to carry an `evil:version` extension element. The Studio implements a multi-layered assistance workflow to ensure this requirement is met without disrupting the user's flow.

### Default Version in Templates

The empty BPMN document template (`bpmn-editor/BpmnEmptyDocument.bpmn`) includes `<evil:version>1.0.0</evil:version>` on the default process. The `bpmn.diagram.resetRelevantIds` command (which processes the template for each new file) uses `BpmnModdle` with the evil moddle extension registered, ensuring the version element survives the `fromXML`/`toXML` roundtrip.

### Auto-Version on Pool Creation

`AutoVersionOnPoolBehavior` (`bpmn-core/bpmn-js/behaviors/AutoVersionOnPoolBehavior.ts`) is a diagram-js behavior that hooks into `commandStack.shape.create.postExecuted`. When a Participant (pool) is created, it checks whether the referenced process already has an `evil:Version` extension. If not, it injects version `1.0.0` via the command stack, making the operation undo-able.

### Version Utility Module

`engine-workspace/helpers/versionUtils.ts` provides shared version logic used by all deploy entry points:

| Function | Purpose |
|----------|---------|
| `suggestNextVersion(current)` | Bumps the patch segment of SemVer, increments plain integers, increments trailing numbers, or appends `-1` for non-deterministic strings |
| `discoverLatestVersion(client, processId)` | Queries the engine via `client.processes.get(processId)` for the latest deployed version; returns `null` on 404 or network error |
| `ensureProcessVersions(xml, bifrost, client)` | Parses XML, finds processes missing `evil:Version`, runs discovery, shows "Missing Versions" dialog with pre-filled suggestions, injects versions on confirm |
| `resolveVersionConflicts(xml, conflicts, bifrost, client)` | Post-409 handler: runs discovery to find the true latest version, shows "Version Conflict" dialog with accurate suggestions, injects new versions on confirm |

### Pre-Deploy Version Check

Before every deployment (all 5 Run Menu commands + file explorer deploy), `ensureProcessVersions` is called on BPMN files. If any process lacks a version, the "Missing Versions" dialog appears with suggestions based on engine discovery. The user must always confirm — there is no auto-skip. If confirmed, versions are written back to the XML and saved to disk.

### Version Conflict Resolution

When any BPMN deploy command receives a 409 `version_exists` error, `resolveVersionConflicts` shows the "Version Conflict" dialog. It queries the engine for the latest deployed version (which may be higher than the conflicting version) and suggests `suggestNextVersion(max(local, deployed))`. On confirm, the updated XML is saved to disk and deployment is retried automatically, up to 3 times.

All four BPMN deploy commands (`deployCurrentProcess`, `deployAndOpenCurrentProcess`, `quickDeployAndDebug`, `quickDeployAndConfiguredDebug`) share the same deploy pipeline via the `deployFocusedBpmnFile()` helper. This ensures consistent version checking and conflict resolution regardless of the entry point. The commands differ only in their post-deploy action (notification, open viewer, start debugger, or configured start).

### Bump Version Command

`bpmn.process.bumpVersion` (registered in `bpmn-editor/initializers/initializeBpmnCommands.ts`) is available in the command palette and the Run menu. It applies `suggestNextVersion` to all processes in the focused diagram that already have a version, operates through the modeler command stack (undo-able), and shows a notification with the version transitions.

---

## BPMN Model graph (runtime read path)

Deployed-process semantics come from the Engine GraphQL Model graph, not from re-parsing XML in the debugger or model viewer. `parseBpmn()` remains the authoring-path parser (linter, modeler, sanitizer).

#### Converter

**Path:** `studio/src/modules/engine-core/bpmn/graphqlProcessModelToSdk.ts`

GraphQL `*Node` types flatten type-specific fields (`httpUrl` on the node). SDK `FlowNode` uses a `typeData` discriminant. `convertGraphqlProcessModel` is the boundary so existing debugger accessors keep working.

The client's `camelizeKeys` rewrites `__typename` to `_Typename` (`_t` matches the snake_case converter). The converter discriminates event definitions by payload fields first, then `_Typename`. Message event definitions map only `messageRef` and `correlationRetrievalExpression` — there is no `payloadExpression` or `eventMapping` (MSG-D1).

#### Debugger load

**Path:** `studio/src/modules/engine-debugger/libs/EngineAdapter.ts`

`loadProcessWithXml` calls `getProcessInstanceWithModel` (PI + `bpmnXml` + `processModel` + FNIs) plus a parallel `queryDataObjectValues`. Missing `processModel` is a hard error. Canvas rendering still uses `bpmnXml`. `parseBpmn()` is not used on this path.

Flow-node and sequence-flow lookups in `BpmnProcessHelpers.ts` are O(1) via per-process `WeakMap` indexes.

#### Model viewer load

**Path:** `studio/src/modules/engine-model-viewer/models/ModelViewerDocumentModel.ts`

`hydrateProcessModel` calls `getProcessVersionWithModel` and stores the converted `BpmnProcess` on a private field (`getBpmnProcess()`). Missing `processModel` is a hard error. Panes in `engine-model-viewer/panes/` read SDK `typeData` only.

The general PaneProvider contract (`shouldBeDisplayed` vs renderer, `PaneWrapper` gating) is documented in **[panes.md](panes.md)**. Debugger and model-viewer **mapping / contract pane visibility** follows the consumed pipeline (`hasInputMappings` / `hasOutputMappings` in `BpmnFlowNodeAccessors.ts`), not the authoring `allowedIn` lists. GraphQL `SendTaskNode` / `ReceiveTaskNode` still expose both mapping arrays for XML fidelity; the unused side is ignored at Engine runtime and is not shown in Studio panes:

- Input mappings: throw-side events (`EndEvent`, `IntermediateThrowEvent`), `SendTask`, and two-sided tasks (`UserTask`, `ServiceTask`, `ScriptTask`, `BusinessRuleTask`, `CallActivity`, `SubProcess`). **Not** StartEvent or ReceiveTask.
- Output mappings: catch-side events (`IntermediateCatchEvent`, `BoundaryEvent`), `ReceiveTask`, and the same two-sided tasks. **Not** StartEvent or SendTask.
- Payload / result contracts: SubProcess shells are included; CallActivity is **not** (the Engine `CallActivityNode` has mappings only).
- HTTP Service Task debugger panes include `httpResponseHeaders` (definition + evaluated `typeProperties`).
- Throw-side message events show `correlationRetrievalExpression` in the debugger. SendTask correlation at runtime is the process-level `correlationKey`; GraphQL `SendTaskNode` has no retrieval-expression field.

#### Moddle ↔ manifest conformance

**Path:** `studio/src/modules/bpmn-core/moddle/verifyModdleConformance.ts`

`evil-platform.json` stays Studio-owned. `verifyModdleConformance` asserts bidirectional vocabulary match against `extensionManifest` from `@elraptorus/daemonengine_sdk`, including `allowedIn ⊆ applicableTo` (the Studio may be stricter, never more permissive). Invoked from `studio/test/unit/bpmn-core/moddleManifestConformance.test.ts`.

---

## Multi-Instance & Standard Loop (Debugger)

The debugger visualises Multi-Instance (parallel/sequential) and Standard Loop execution at runtime. The implementation spans three layers: data model, canvas overlays, and property panes.

### Data Model

- `FniSnapshot` (`engine-core/types.ts`) carries `multiInstanceId` and `iterationIndex` from the engine SDK's `FlowNodeInstance`.
- `ALL_FNI_FIELDS` (`engine-debugger/libs/EngineAdapter.ts`) includes `'multiInstanceId'` and `'iterationIndex'` so GraphQL detail queries fetch iteration metadata.
- `SubscribeThenSnapshot` (`engine-core/SubscribeThenSnapshot.ts`) maps these fields from the `FlowNodeInstanceStarted` WebSocket event and handles `MultiInstanceStarted`/`MultiInstanceCompleted` events by queueing the shell FNI for a detail refresh.

### Grouping (MultiInstanceGroup)

`buildMultiInstanceGroups()` in `engine-debugger/libs/SelectableElement.ts` groups flow node instances by `multiInstanceId`:

- The FNI with `iterationIndex === null` becomes the **shell** FNI.
- All other FNIs sharing the same `multiInstanceId` become **iteration** FNIs, sorted by `iterationIndex`.
- `loopType` (`parallel_mi` | `sequential_mi` | `standard_loop`) is determined from the BPMN model's `FlowNode.multiInstance` / `FlowNode.standardLoop`.

`ExecutableFlowNode` carries `multiInstanceGroups: MultiInstanceGroup[]`, populated in `EngineBpmnDebuggerEditorDocumentModel.mapFlowNodeInstancesToFlowNodes()`.

### Canvas Overlays

- `OverlayFactory.createFlowNodeInstanceOverlays()` detects MI/loop flow nodes and generates a progress badge (`completedIterations / totalIterations`) instead of a plain execution count.
- Retry overlays are suppressed for any element with loop characteristics (`hasLoopCharacteristics()`).
- `FlowNodeExecutionCountBadge` accepts an optional `customLabel` prop for iteration progress display.

### Property Panes

| Pane | File | Condition |
|------|------|-----------|
| Multi-Instance Configuration | `property-panel/FlowNode/SequentialMultiInstancePane.tsx` | `hasMultiInstance(flowNodeModel)` — mode-aware: title is "Parallel Multi-Instance Configuration" or "Sequential Multi-Instance Configuration"; Break Condition and Loop Interval are hidden for parallel MI |
| Standard Loop Configuration | `property-panel/FlowNode/LoopConfigurationPane.tsx` | `isStandardLoop(flowNodeModel)` — shows testBefore, loopCondition, loopMaximum, loopInterval |
| Iteration Progress | `property-panel/FlowNode/MultiInstanceProgressPane.tsx` | Any loop with active `multiInstanceGroups` — shows type, shell state, total/completed/active/failed counts |
| FNI Instance Pane | `property-panel/FlowNode/FlowNodeInstancePane.tsx` | Two-tier `MultiInstanceSelector` for MI/loop elements (shell selector + iteration selector); plain selector for non-loop elements |

### Selection

`EngineBpmnDebuggerEditorDocumentModel` tracks `_selectedMultiInstanceId` to support shell-level selection independent of individual FNI selection. `selectMultiInstance(id)` sets this and triggers pane re-rendering.

---

## File Path Reference

| Component | Path |
|-----------|------|
| EngineConnectionManager | `studio/src/modules/engine-core/EngineConnectionManager.ts` |
| JwtIdentityManager | `studio/src/modules/engine-core/JwtIdentityManager.ts` |
| WebSocketBridge | `studio/src/modules/engine-core/WebSocketBridge.ts` |
| Command Contract | `studio/src/modules/engine-core/commands/CommandContract.ts` |
| engine-core entry | `studio/src/modules/engine-core/index.ts` |
| engine-workspace entry | `studio/src/modules/engine-workspace/index.ts` |
| engine-workspace menubar | `studio/src/modules/engine-workspace/initializers/initializeRunMenu.ts` |
| engine-workspace explorer menus | `studio/src/modules/engine-workspace/initializers/initializeMenus.ts` |
| engine-model-viewer entry | `studio/src/modules/engine-model-viewer/index.ts` |
| engine-decision-viewer entry | `studio/src/modules/engine-decision-viewer/index.ts` |
| engine-debugger entry | `studio/src/modules/engine-debugger/index.tsx` |
| GraphQL → SDK converter | `studio/src/modules/engine-core/bpmn/graphqlProcessModelToSdk.ts` |
| EngineAdapter | `studio/src/modules/engine-debugger/libs/EngineAdapter.ts` |
| BpmnProcessHelpers | `studio/src/modules/engine-debugger/libs/BpmnProcessHelpers.ts` |
| Model viewer document model | `studio/src/modules/engine-model-viewer/models/ModelViewerDocumentModel.ts` |
| Moddle conformance | `studio/src/modules/bpmn-core/moddle/verifyModdleConformance.ts` |
| Engine ID extraction | `studio/src/modules/engine-core/helpers/checkEngineConnectivity.ts` |
| Version utilities | `studio/src/modules/engine-workspace/helpers/versionUtils.ts` |
| AutoVersionOnPoolBehavior | `studio/src/modules/bpmn-core/bpmn-js/behaviors/AutoVersionOnPoolBehavior.ts` |
| BPMN empty template | `studio/src/modules/bpmn-editor/BpmnEmptyDocument.bpmn` |
