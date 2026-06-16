# BPMN Token Simulator

---

## Overview

The `bpmn-token-simulator` module provides a Studio-native visual simulation of BPMN process token flow. Users can observe how tokens move through a diagram to validate process logic, run demonstrations, or learn BPMN semantics.

The module is the first consumer of the [BPMN modeler module discovery mechanism](bpmn-modeler-modules.md) and demonstrates the pattern for building modeler-extending features as fully decoupled modules.

---

## Design Principles

### Blackbox Pools

The simulator only executes the **active pool** — the one the user starts the simulation from. All other pools/participants in a collaboration are treated as opaque blackboxes. Message flows crossing pool boundaries produce a visual gold glow on the flow line and a brief pulse on the target element, but no tokens are created or advanced in external pools.

This keeps the simulation deterministic and avoids the complexity of coordinating multiple independent process instances with potentially conflicting timing. Users simulate one pool at a time; cross-pool effects are acknowledged visually but not executed.

### No BPMN Validation

The simulator intentionally ignores invalid or missing element configuration. It operates in a fire-and-forget fashion:

- A signal with no name broadcasts to zero targets.
- A message throw with no outgoing message flow simply continues the token.
- Missing default flows on gateways fall through to the first available path.

BPMN model validation is a separate concern, handled by the editor or a future linting mechanism — not the simulator. This avoids coupling simulation behavior to configuration correctness and keeps the code path simple: if the configuration is absent, nothing special happens.

---

## Supported BPMN Elements

| Element | Simulation Behavior |
|---------|---------------------|
| StartEvent | Immediate pass-through; tokens enter the process here |
| EndEvent (None) | Completes the current scope |
| EndEvent (Terminate) | Sub-process: destroys child scope, exits normally. Root: halts the engine |
| EndEvent (Error) | Routes to matching error boundary event, or halts engine at root level (red error highlight) |
| EndEvent (Escalation) | Routes to matching escalation boundary; non-interrupting forks a parallel token |
| Task / CallActivity | Auto: timed delay. Step: waits for user click. Supports multi-instance and loop |
| SubProcess (expanded) | Creates child scope; tokens flow through internal elements. Supports MI/loop |
| SubProcess (collapsed) | Auto: double-length delay with processing indicator. Step: waits for click. Supports MI/loop |
| ExclusiveGateway | Step: user picks one branch. Auto: follows default/first flow. Pre-configurable |
| InclusiveGateway | Fork: all flows (auto) or multi-select (step). Join: graph-reachability-based. Pre-configurable |
| ParallelGateway | Fork: all outgoing. Join: waits for all incoming tokens |
| EventBasedGateway | User picks which catch event fires (or auto-triggers first). Other branches cancelled |
| IntermediateThrowEvent (None/Link) | Pass-through. Link Throw Events teleport to matching Link Catch Event by name |
| IntermediateThrowEvent (Message) | Emits `message:send` with outgoing message flows (gold glow animation), then continues |
| IntermediateThrowEvent (Signal) | Broadcasts signal to matching catches within the active process (ripple animation), then continues |
| IntermediateThrowEvent (Escalation) | Triggers matching escalation boundary on enclosing subprocess (interrupting or non-interrupting), then continues |
| IntermediateCatchEvent | Step: waits for click. Auto: timed continuation. Signal catches are also triggered by matching signal broadcasts |
| EndEvent (Message) | Emits `message:send` with outgoing message flows, then completes scope |
| EndEvent (Signal) | Broadcasts signal to matching catches within the active process, then completes scope |
| BoundaryEvent | Interrupting: cancels host and child scopes. Non-interrupting: forks a new token. Signal boundary events are also triggered by matching signal broadcasts |
| MessageFlow | Animated gold token along message flow line when a message throw/end event fires |
| SequenceFlow | Animated token movement between elements (not routed through behaviors) |

---

## Architecture

The module is organized into three layers:

```
┌─────────────────────────────────────────────┐
│               Control Layer                  │
│  SimulationToolbar, PaletteProvider,        │
│  GatewayChoiceOverlay, ElementPlayButton     │
├─────────────────────────────────────────────┤
│               Visual Layer                   │
│  TokenRenderer, FlowAnimator,               │
│  ElementHighlighter                          │
├─────────────────────────────────────────────┤
│               Engine Layer                   │
│  SimulationEngine, Scope, Behaviors          │
│  (Pure TypeScript, no DOM)                   │
└─────────────────────────────────────────────┘
```

### Engine Layer (`core/`)

#### SimulationEngine

**Path:** `studio/src/modules/bpmn-token-simulator/core/SimulationEngine.ts`

Central orchestrator. Maintains a job queue, emits events, and delegates to element behaviors. Key responsibilities:

- **Timer scheduling**: `scheduleDelay(callback, delayMs)` / `cancelDelay(id)` — all timers are paused on `pause()`, resumed with remaining time on `resume()`, and cancelled on `reset()`.
- **Token lifecycle**: `enter(element, scope, viaFlow?)` registers the token via `scope.addToken()` and delegates to the element's behavior. Includes a scope state guard — if the scope has been destroyed, the job is silently dropped.
- **Termination signals**: `signalTerminated()` and `signalErrorTerminated(scope, element)` halt the engine (cancel all timers, clear job queue) before emitting the corresponding event.
- **Multi-instance counts**: `multiInstanceCounts: Map<string, number>` stores user-configured iteration counts per element (default 3). Synced from the controller on each simulation start; cleared on `reset()`.
- **Message sending**: `emitMessageSend(element, scope, messageFlows)` emits a `message:send` event for the visual layer to animate gold tokens along message flows.
- **Signal broadcasting**: `broadcastSignal(element, scope)` extracts the signal name, scans the root scope's process tree for matching signal catch events and signal boundary events, triggers those that are currently active (have tokens), and emits a `signal:broadcast` event. Includes interrupting/non-interrupting boundary event handling.

#### Scope

**Path:** `studio/src/modules/bpmn-token-simulator/core/Scope.ts`

Represents a running scope (root process or child sub-process). Tracks several categories of state:

| State | Purpose |
|-------|---------|
| `activeTokenCounts` | Reference-counted map of element IDs where tokens reside. Supports parallel forks with multiple tokens at one element |
| Join counters | `incrementJoinCounter` / `getJoinCounter` — parallel gateway join synchronization |
| `satisfiedJoinFlows` | Inclusive gateway join semantics — records which incoming flows have been satisfied |
| `loopCounters` | Sequential MI / standard loop iteration progress |
| `parallelMiCounters` | Parallel MI sub-process child scope completion tracking (`expected` vs `completed`) |

`collectActiveTokens()` recursively gathers element IDs from this scope and all child scopes into a `Set<string>` — used by the inclusive gateway join's backward BFS reachability check. All counters are cleared on `destroy()`.

#### Behaviors

Each behavior implements the `{ enter, exit?, signal? }` interface:

```typescript
interface ElementBehavior {
  enter(element: any, scope: Scope, viaFlow?: any): void;
  exit?(element: any, scope: Scope): void;
  signal?(element: any, scope: Scope, data?: any): void;
}
```

| Behavior | Summary |
|----------|---------|
| `StartEventBehavior` | Immediate pass-through |
| `EndEventBehavior` | Completes scope; special handling for Terminate, Error, Escalation, Message, and Signal end events |
| `TaskBehavior` | Timed exit (auto) or waits for click (step). Handles MI/loop via shared `loopUtils.ts` |
| `SubProcessBehavior` | Creates child scopes (expanded) or schedules delays (collapsed). Handles MI/loop via shared `loopUtils.ts` |
| `ExclusiveGatewayBehavior` | User choice (step) or default/first flow (auto) |
| `InclusiveGatewayBehavior` | Fork: all flows or multi-select. Join: graph-reachability with backward BFS and `isEngineIdle()` safety net |
| `ParallelGatewayBehavior` | Fork: all outgoing. Join: waits for all incoming |
| `EventBasedGatewayBehavior` | Emits token exit, signals catch event options for user selection |
| `IntermediateThrowEventBehavior` | Pass-through; Link events teleport, Message events emit to message flows, Signal events broadcast to matching catches, Escalation events trigger boundary on enclosing subprocess |
| `IntermediateCatchEventBehavior` | Timed exit (auto) or waits for click (step) |

Multi-instance and loop logic is shared between `TaskBehavior` and `SubProcessBehavior` via `core/loopUtils.ts` (`getLoopType`, `getIterationCount`).

#### Event Definition Utilities

**Path:** `studio/src/modules/bpmn-token-simulator/core/eventDefUtils.ts`

Shared helpers for detecting BPMN event definitions on elements. Used by `IntermediateThrowEventBehavior`, `EndEventBehavior`, and `SimulationEngine`:

- `isMessageEvent(element)` / `isSignalEvent(element)` / `isLinkEvent(element)` / `isErrorEvent(element)` / `isEscalationEvent(element)` / `isTerminateEvent(element)` — boolean detection via `element.businessObject.eventDefinitions`
- `getSignalName(element)` — extracts `signalRef.name` from the signal event definition
- `getMessageFlows(element)` — returns `element.outgoing` filtered to `bpmn:MessageFlow` connections

Sequence flows are not routed through behaviors — they are handled directly by `engine.animateFlow()` from `routeToOutgoing()`.

#### Engine Events

| Event | Purpose |
|-------|---------|
| `token:enter` / `token:exit` | Token lifecycle on elements |
| `flow:animate` | Request animation along a sequence flow |
| `element:waiting` | Element waiting for user interaction (step mode) |
| `gateway:choice` | Exclusive gateway needs user branch selection (step mode) |
| `gateway:auto` | Exclusive gateway auto-routing; carries `chosenFlow`, `outgoing`, and a `cancel` callback |
| `gateway:inclusive-choice` | Inclusive gateway needs user multi-select (step mode) |
| `gateway:inclusive-auto` | Inclusive gateway auto-forking; interceptable |
| `gateway:event-based` | Event-based gateway waiting; carries list of catch events |
| `message:send` | Message throw/end event fired; carries outgoing `messageFlows[]` for visual layer animation |
| `signal:broadcast` | Signal throw/end event fired; carries `signalName` and `targets[]` of triggered catch/boundary elements |
| `scope:complete` | Scope (root or child) has completed |
| `simulation:terminated` | Terminate end event destroyed the process scope |
| `simulation:error-terminated` | Unhandled error end event at root level; carries the error element |
| `simulation:start` / `simulation:reset` / `simulation:complete` | Simulation lifecycle |
| `simulation:pause` / `simulation:resume` | Pause/resume lifecycle |

---

### Visual Layer (`visual/`)

#### TokenRenderer

**Path:** `studio/src/modules/bpmn-token-simulator/visual/TokenRenderer.ts`

Creates SVG `<circle>` elements in a dedicated diagram-js canvas layer (`canvas.getLayer('token-simulation', 1)`). This layer sits inside the viewport transform group, so tokens stay correctly positioned during zoom and pan. Supports `fadeTokensForElement(elementId)` to reduce opacity to 0.3 for completed sub-process tokens.

#### FlowAnimator

**Path:** `studio/src/modules/bpmn-token-simulator/visual/FlowAnimator.ts`

Animates tokens along sequence flow waypoints using `requestAnimationFrame`, rendering into the same canvas layer. Duration scales with flow length and current speed setting. Uses ease-in-out-quad interpolation (`easeInOut(t)`) for natural movement.

`animate()` accepts an optional `tokenClass` parameter — defaults to the green sequence flow token but can be overridden (e.g. `token-sim-message-flow-token` for gold message flow animations).

`showRipple(element, durationMs)` creates staggered expanding SVG circles at an element's center for signal broadcast visualization. Three concentric rings animate with 150ms stagger and auto-remove after completion.

Supports `pause()` / `resume()` — stores elapsed progress per animation on pause and adjusts start times on resume. `cancelForElements(elementIds)` cancels only animations whose source or target is in the given set (used for interrupting boundary event cleanup).

#### ElementHighlighter

**Path:** `studio/src/modules/bpmn-token-simulator/visual/ElementHighlighter.ts`

Toggles CSS classes on element SVG groups via `elementRegistry.getGraphics()`:

| Class | Purpose |
|-------|---------|
| `token-sim-highlight-active` | Green glow on the currently active element |
| `token-sim-highlight-completed` | Subtle completed indicator |
| `token-sim-highlight-visited` | Persistent breadcrumb trail (survives until reset) |
| `token-sim-highlight-flow-visited` | Persistent flow breadcrumb trail |
| `token-sim-highlight-flow-chosen` | Blue glow on chosen gateway outgoing flow |
| `token-sim-highlight-error` | Red error glow (double `drop-shadow`) |
| `token-sim-highlight-message-flow` | Gold glow on message flow connections |
| `token-sim-highlight-message-pulse` | Brief gold pulse animation on message target elements |

`pulseElement(element)` applies the pulse class with a forced reflow to retrigger the CSS animation, then removes it after 1.2s.

CSS cascade order ensures `active` > `visited` > `completed` priority.

---

### Control Layer (`components/`)

#### SimulationToolbar

**Path:** `studio/src/modules/bpmn-token-simulator/components/SimulationToolbar.tsx`

React component positioned at top-center of the editor content area. Two rows:

- **Top row**: Start, Pause/Resume, Reset, Mode toggle, Close, plus always-visible token counter toggle, simulation log toggle, and trace export button.
- **Bottom row**: Non-linear speed slider (0.1x–5.0x, 18 discrete positions, 1.0x at center) with a clickable speed label that resets to default.

Rendered via `ReactDOM.createRoot` into a DOM element appended to `.editor__content`. The optional `SimulationLogPanel` renders below the speed row.

#### Overlay Components

| Component | Role |
|-----------|------|
| `GatewayChoiceOverlay` | Branch selection popup for exclusive gateways (step mode) |
| `InclusiveGatewayChoiceOverlay` | Multi-select overlay for inclusive gateways (step mode) |
| `ElementPlayButton` | Green play button on start events, tasks (step), catch events, boundary events |
| `GatewayConfigButton` | Persistent signpost overlay on gateways for path pre-configuration |
| `BoundaryEventCheckbox` | Persistent checkbox overlay on boundary events for auto-fire configuration |
| `MultiInstanceConfigButton` | Persistent "Nx" badge overlay on MI/loop elements for iteration count configuration |
| `MultiInstanceCountOverlay` | Displays configured iteration count as a badge |
| `SimulationLogPanel` | Scrollable timestamped event log panel below the toolbar |
| `flowLabel` utility | Shared `getFlowLabel(flow)` for deriving human-readable flow labels |

All overlay entries track their `ReactDOM.Root` for proper cleanup. Creation boilerplate is centralized in the controller's `createOverlay()` helper.

#### TokenSimulationController

**Path:** `studio/src/modules/bpmn-token-simulator/TokenSimulationController.ts`

Orchestrator that wires engine events to visual layer methods. Created lazily by the bridge's `toggle()` method. Key responsibilities:

- **Lifecycle management**: Manages `activate` / `deactivate` / `dispose` transitions. On activation, reads persisted settings, shows start event and MI config overlays, registers tooltips and keyboard shortcuts.
- **Engine-to-visual wiring**: Subscribes to all engine events and delegates to `TokenRenderer`, `FlowAnimator`, and `ElementHighlighter` accordingly.
- **Overlay management**: Creates and tracks overlays for gateways, boundary events, multi-instance config, counters, and play buttons. Scans recursively via `forEachFlowElement()` to cover nested sub-processes.
- **Preference maps**: `gatewayPreferences`, `boundaryPreferences`, `multiInstanceConfig` — intercepts gateway/boundary events to apply pre-configured choices.
- **Settings persistence**: Reads settings on `activate()` via `applyPersistedSettings()`. Writes back on each user interaction (`setSpeed`, `setMode`, `toggleCounters`, `toggleLog`).
- **Toolbar remounting**: Exposes `remountToolbar()` for the bridge to call after tab-switch DOM destruction (see Integration below).

---

### Integration

#### TokenSimulationBridge

**Path:** `studio/src/modules/bpmn-token-simulator/TokenSimulationBridge.ts`

Minimal diagram-js module that acts as the DI entry point. Injects `canvas`, `elementRegistry`, `overlays`, `eventBus`, and `tokenSimSettings`. Owns the `TokenSimulationController` lifecycle. Exposes `toggle()` and `isActive()` for the palette provider and command handler. Fires `tokenSimBridge.toggled` on `eventBus` when the active state changes.

#### DI Module Registration

The DI module is assembled inline in `index.ts` to include the settings accessor as a value provider and the palette provider alongside the bridge:

```typescript
const settingsAccessor: TokenSimSettingsAccessor = {
  get: (key: string) => bifrost.settings.get(key),
  set: (key: string, value: any) => bifrost.settings.set(key, value),
};

bifrost.commands.executeCommand('bpmn.modeler.registerModule', [
  {
    __init__: ['tokenSimulationBridge', 'tokenSimPaletteProvider'],
    tokenSimulationBridge: ['type', TokenSimulationBridge],
    tokenSimPaletteProvider: ['type', TokenSimPaletteProvider],
    tokenSimSettings: ['value', settingsAccessor],
  },
]);
```

#### TokenSimPaletteProvider

**Path:** `studio/src/modules/bpmn-token-simulator/TokenSimPaletteProvider.ts`

A diagram-js palette provider registered at priority **599** in the `z-extensions` group. Adds a "Toggle Token Simulation" entry that reflects the current active state. Listens to the `tokenSimBridge.toggled` event and rebuilds the palette to update the entry's CSS class and tooltip.

At command time, modules retrieve the bridge via:

```typescript
model.modelerAdapter.getModelerComponentByName<any>('tokenSimulationBridge');
```

Zero imports from `bpmn-core` or `bpmn-editor` — all communication through commands and SDK types.

#### Tab-Switch Resilience

The toolbar container is appended to `.editor__content`, which is a React-managed DOM node destroyed on tab switches. The `.bjs-container` (diagram-js) survives via bpmn-js's `attachTo()`/`detach()` mechanism. The palette (where the toggle entry lives) is part of `.bjs-container` and survives tab switches.

The bridge listens for the bpmn-js `attach` event to detect reattachment. If the simulation is active, it calls `controller.remountToolbar()` to recreate the toolbar in the new DOM context.

---

## User-Facing Features

### Simulation Modes

- **Auto mode**: Tokens flow automatically with configurable speed (0.1x–5.0x). All delays use engine-managed scheduling that respects pause/resume.
- **Step mode**: Tokens pause at each activity. User clicks play buttons to advance.
- **Pause/Resume**: Freezes all token movement, both engine timers and flow animations. Visual state is preserved.

### Gateway Pre-Configuration

Persistent signpost overlays appear on all exclusive/inclusive gateways (with >1 outgoing) when the simulator activates. Users can pre-select paths before starting or while a simulation runs. When a token reaches a pre-configured gateway, the preference is applied immediately. Preferences survive pause/resume and replay; cleared on reset/deactivate.

### Multi-Instance and Loop Activities

Tasks and sub-processes with `loopCharacteristics` are detected and simulated. Users configure the iteration count (default 3) via persistent "Nx" badge overlays shown on activation.

- **Parallel MI**: Schedules N independent timers (tasks) or creates N independent child scopes (expanded sub-processes) running simultaneously.
- **Sequential MI / Standard Loop**: Re-enters the element N times in series.
- **Step mode**: Parallel MI waits for a single click to start the batch; sequential MI requires one click per iteration.

Configuration persists across replay; cleared on deactivate.

### Token Counters and Simulation Log

- **Token counters**: Purple visit-count badges at the bottom-right of each visited element. Toggled via toolbar button.
- **Breadcrumb trail**: Visited elements and flows receive persistent subtle highlights that remain until reset.
- **Simulation log**: Timestamped in-memory event log, displayed in a scrollable panel below the toolbar. Toggled via toolbar button.
- **Trace export**: One-click JSON export of the simulation log (`simulation-trace-{timestamp}.json`).

### Keyboard Shortcuts

| Key | Action | Guard |
|-----|--------|-------|
| Space | Pause / Resume | Ignored in input/textarea/select, or with Ctrl/Cmd/Alt modifiers |
| R | Replay simulation | Same |
| Escape | Reset simulation | Same |

### Hover Tooltips

Hovering over an element during an active simulation shows a tooltip with element name, type, and visit count. Tooltips appear near the cursor and disappear on `element.out`. Registered/unregistered on activate/deactivate via `eventBus` hover events.

---

## Settings Persistence

The module registers four settings via `bifrost.settings.register()` at load time. These persist toolbar preferences across sessions.

| Setting key | Type | Default | GUI | Description |
|---|---|---|---|---|
| `tokenSimulator.toolbar.mode` | `string` (`auto` / `step`) | `auto` | Yes | Default simulation mode |
| `tokenSimulator.toolbar.speed` | `number` (0.1–5.0) | `1.0` | Yes | Default speed multiplier |
| `tokenSimulator.toolbar.showCounters` | `boolean` | `false` | Yes | Show token counter badges |
| `tokenSimulator.toolbar.showLog` | `boolean` | `false` | Yes | Show simulation log panel |

All four appear in the Settings editor under the **Token Simulator** category.

**Not persisted**: Gateway/boundary/multi-instance per-diagram preferences (transient, diagram-specific), active/inactive toggle state, running/paused state.

Settings are bridged into the diagram-js DI graph via the `TokenSimSettingsAccessor` value provider (see DI Module Registration above). The controller reads settings on `activate()` and writes back on each user interaction.

---

## Theme Integration

All colors are CSS variables defined in `token-simulation.scss` within the light and dark theme blocks (`.bifrost.bifrost-theme--light` / `.bifrost.bifrost-theme--dark`):

| Variable group | Purpose |
|----------------|---------|
| `--token-sim-token-fill` / `--token-sim-token-stroke` | SVG token circles |
| `--token-sim-active-shadow` / `--token-sim-completed-shadow` | Element highlighting |
| `--token-sim-toolbar-*` | Toolbar appearance |
| `--token-sim-overlay-*` | Gateway choice / play button overlays |
| `--token-sim-play-btn-color` | Play button color |
| `--token-sim-flow-chosen-color` | Sequence flow highlight (blue/light blue) |
| `--token-sim-visited-shadow` / `--token-sim-flow-visited-color` | Breadcrumb trail highlighting (green tones) |
| `--token-sim-counter-bg` / `--token-sim-counter-fg` | Token counter badges (purple) |
| `--token-sim-mi-badge-bg` / `--token-sim-mi-badge-fg` | Multi-instance badge (theme-specific) |
| `--token-sim-message-flow-color` / `--token-sim-message-flow-token-fill` | Message flow gold highlight and animated token |
| `--token-sim-message-pulse-shadow` | Gold pulse animation on message target elements |
| `--token-sim-signal-ripple-color` | Signal broadcast ripple ring color (purple tones) |

The palette toggle entry uses `--theme-focus` for the active state highlight color (`.token-sim-palette-entry--active`).

The module's stylesheet references these variables exclusively.

---

## File Path Reference

| Component | Path |
|-----------|------|
| Module entry point | `studio/src/modules/bpmn-token-simulator/index.ts` |
| Bridge module | `studio/src/modules/bpmn-token-simulator/TokenSimulationBridge.ts` |
| Palette provider | `studio/src/modules/bpmn-token-simulator/TokenSimPaletteProvider.ts` |
| Controller | `studio/src/modules/bpmn-token-simulator/TokenSimulationController.ts` |
| Scope | `studio/src/modules/bpmn-token-simulator/core/Scope.ts` |
| SimulationEngine | `studio/src/modules/bpmn-token-simulator/core/SimulationEngine.ts` |
| Graph utilities | `studio/src/modules/bpmn-token-simulator/core/graphUtils.ts` |
| Loop utilities | `studio/src/modules/bpmn-token-simulator/core/loopUtils.ts` |
| Event definition utilities | `studio/src/modules/bpmn-token-simulator/core/eventDefUtils.ts` |
| Behaviors | `studio/src/modules/bpmn-token-simulator/core/behaviors/` |
| TokenRenderer | `studio/src/modules/bpmn-token-simulator/visual/TokenRenderer.ts` |
| FlowAnimator | `studio/src/modules/bpmn-token-simulator/visual/FlowAnimator.ts` |
| ElementHighlighter | `studio/src/modules/bpmn-token-simulator/visual/ElementHighlighter.ts` |
| SimulationToolbar | `studio/src/modules/bpmn-token-simulator/components/SimulationToolbar.tsx` |
| GatewayChoiceOverlay | `studio/src/modules/bpmn-token-simulator/components/GatewayChoiceOverlay.tsx` |
| InclusiveGatewayChoiceOverlay | `studio/src/modules/bpmn-token-simulator/components/InclusiveGatewayChoiceOverlay.tsx` |
| ElementPlayButton | `studio/src/modules/bpmn-token-simulator/components/ElementPlayButton.tsx` |
| GatewayConfigButton | `studio/src/modules/bpmn-token-simulator/components/GatewayConfigButton.tsx` |
| BoundaryEventCheckbox | `studio/src/modules/bpmn-token-simulator/components/BoundaryEventCheckbox.tsx` |
| SimulationLogPanel | `studio/src/modules/bpmn-token-simulator/components/SimulationLogPanel.tsx` |
| MultiInstanceConfigButton | `studio/src/modules/bpmn-token-simulator/components/MultiInstanceConfigButton.tsx` |
| MultiInstanceCountOverlay | `studio/src/modules/bpmn-token-simulator/components/MultiInstanceCountOverlay.tsx` |
| flowLabel utility | `studio/src/modules/bpmn-token-simulator/components/flowLabel.ts` |
| Styles + theme variables | `studio/src/modules/bpmn-token-simulator/token-simulation.scss` |
