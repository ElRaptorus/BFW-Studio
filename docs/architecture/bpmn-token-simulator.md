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

Consequences inside the active pool:

- There is exactly one instance per run. Message and signal throws never trigger Message or Signal Start Events; they only reach waiting points that are already armed.
- Messages and signals are never held as pending, unlike in the Engine. One delivered while nothing with its name is armed is dropped. A same-pool throw that happens before its catch is armed is therefore lost, and because the thrower exists, the catch does not auto-fire either; such a run needs step mode.
- The thrower index (`throwerNames`) only contains signal and message throwers of the active pool. A catch whose name has no thrower there keeps the timed auto-fire, because its trigger would come from outside the pool.

### No BPMN Validation

The simulator intentionally ignores invalid or missing element configuration. It operates in a fire-and-forget fashion:

- A signal with no name broadcasts to zero targets.
- A message throw with no matching waiting point and no outgoing message flow simply continues the token.
- Missing default flows on exclusive gateways fall through to the first available path.

Constructs that the Engine rejects at deploy time or fatals at runtime are simulated anyway:

- implicit splits and dead ends
- mixed gateways (many incoming and many outgoing)
- missing or ambiguous untyped start events
- a Cancel End Event outside a transaction
- unmarked non-default outgoing flows on Exclusive and Complex splits
- parallel multi-instance collections larger than `bfw:maxIterations` (the simulator caps the count instead)
- broken link pairs (a Link Throw without a catch in its scope ends its token)
- unpaired Complex joins
- `loopCardinality`

BPMN model validation is a separate concern, handled by the Studio's linter — not the simulator. This avoids coupling simulation behavior to configuration correctness and keeps the code path simple: if the configuration is absent, nothing special happens.

---

## Supported BPMN Elements

"Waiting point" means an entry in the engine's waiting-point registry (see Engine Layer). End Events consume their token silently, so the token visual stays on them.

| Element                               | Simulation Behavior                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| StartEvent                            | The global Start begins in the first pool that has a start event and enters its untyped start events, or all its start events when none is untyped. A root timer start with `timeDate` / `timeDuration` is a waiting point; every other start passes through                                                                                                                                                                         |
| EndEvent (None)                       | Consumes the token; the scope completes once nothing is left in it                                                                                                                                                                                                                                                                                                                                                                   |
| EndEvent (Terminate)                  | Sub-process: interrupts everything else in its scope, then the host exits normally. Root: halts the engine                                                                                                                                                                                                                                                                                                                           |
| EndEvent (Error)                      | Resolved by `eventResolver`: error event subprocess, else error boundary on the host (specific code before catch-all), else one level up. Uncaught: halts the engine (red error highlight)                                                                                                                                                                                                                                           |
| EndEvent (Escalation)                 | Resolved like errors; enters every matching non-interrupting catcher plus one interrupting one, then interrupts its siblings. Uncaught: the scope simply finishes                                                                                                                                                                                                                                                                    |
| EndEvent (Message)                    | Delivers its message by name (see IntermediateThrowEvent), then consumes the token                                                                                                                                                                                                                                                                                                                                                   |
| EndEvent (Signal)                     | Broadcasts its signal, then consumes the token                                                                                                                                                                                                                                                                                                                                                                                       |
| EndEvent (Compensation)               | Runs compensation (see IntermediateThrowEvent), then consumes the token                                                                                                                                                                                                                                                                                                                                                              |
| EndEvent (Cancel)                     | Inside a Transaction: interrupts the transaction's other tokens, compensates every completed activity, then enters the Cancel boundary (interrupting the transaction). Without a Cancel boundary: halts the engine in the error state                                                                                                                                                                                                |
| Task / CallActivity                   | Auto: timed delay. Step: waits for user click. Supports multi-instance and loop                                                                                                                                                                                                                                                                                                                                                      |
| SendTask                              | Like Task; delivers its message by name on every exit                                                                                                                                                                                                                                                                                                                                                                                |
| ReceiveTask                           | Waiting point per non-parallel iteration. Auto-fires only when no thrower of its message exists in the pool. Chosen by an event-based gateway: exits after the task delay                                                                                                                                                                                                                                                            |
| SubProcess / Transaction (expanded)   | Creates a child scope and enters its untyped start events. Supports MI/loop                                                                                                                                                                                                                                                                                                                                                          |
| SubProcess / Transaction (collapsed)  | Auto: double-length delay with processing indicator. Step: waits for click. Supports MI/loop                                                                                                                                                                                                                                                                                                                                         |
| Event SubProcess                      | Its message, signal, timer or conditional start is a waiting point armed when the enclosing scope is created. Interrupting: interrupts the rest of the scope and disarms the scope's other event-subprocess starts. Non-interrupting: runs alongside and stays armed (except one-shot date/duration timers). Error and escalation starts are reached only through the resolver; compensation starts only through compensation        |
| AdHocSubProcess                       | Starts every inner activity without incoming sequence flow exactly once: all at once (`Parallel`) or one at a time in model order (`Sequential`), then exits. `completionCondition`, `bfw:activeElements`, `cancelRemainingInstances` and loop markers on the shell are ignored. Collapsed: like a collapsed subprocess                                                                                                              |
| ExclusiveGateway                      | Step: user picks one branch. Auto: follows default/first flow. Pre-configurable                                                                                                                                                                                                                                                                                                                                                      |
| InclusiveGateway                      | Fork: every non-default flow, or the default flow when it is the only one (auto), or multi-select (step). Join: fires when no unsatisfied incoming flow has an upstream token (including tokens on flows); a repeated arrival is kept for the next firing. Pre-configurable                                                                                                                                                          |
| ComplexGateway                        | Split: like the inclusive fork. Join: fires at its threshold ("N of M" badge, default all), then interrupts every token in the region back to the nearest upstream Complex split                                                                                                                                                                                                                                                     |
| ParallelGateway                       | Fork: all outgoing. Join: waits for all incoming tokens                                                                                                                                                                                                                                                                                                                                                                              |
| EventBasedGateway                     | Keeps its token and arms one waiting point with its successors as candidates. Firing a candidate (click, delivery, or auto after the task delay among candidates that can auto-fire) consumes the gateway token and enters that successor only                                                                                                                                                                                       |
| IntermediateThrowEvent (None)         | Pass-through                                                                                                                                                                                                                                                                                                                                                                                                                         |
| IntermediateThrowEvent (Link)         | Continues at the Link Catch with the same name in the same scope                                                                                                                                                                                                                                                                                                                                                                     |
| IntermediateThrowEvent (Message)      | Delivers by name to every armed catch, Receive Task, message boundary and event-gateway candidate; if none, to every armed event-subprocess message start. Emits `message:send` (gold message-flow animation, pulse on targets), then continues                                                                                                                                                                                      |
| IntermediateThrowEvent (Signal)       | Fires every armed waiting point with that signal name in any scope (ripple animation), then continues                                                                                                                                                                                                                                                                                                                                |
| IntermediateThrowEvent (Escalation)   | Enters the catchers found by `resolveEscalation`, then continues its token                                                                                                                                                                                                                                                                                                                                                           |
| IntermediateThrowEvent (Compensation) | Compensates the throwing scope's completed activities last in, first out (only `activityRef` when set), each at most once; keeps its token until the last handler has finished                                                                                                                                                                                                                                                       |
| IntermediateCatchEvent                | Message, signal, timer and conditional catches are waiting points: step waits for a click; auto fires after the task delay unless a thrower of the same message or signal exists in the pool. Link and untyped catches pass through. Reached from an event-based gateway: exits after the task delay                                                                                                                                 |
| BoundaryEvent                         | Timer, message, signal and conditional boundaries are armed while their host holds a token; they auto-fire only when their checkbox is ticked. Interrupting: enters the boundary, then interrupts the host. Non-interrupting: enters the boundary; message, signal and cycle-timer ones stay armed. Error, escalation, compensation and cancel boundaries are reached only through the resolver, compensation and transaction cancel |
| MessageFlow                           | Animated gold token along message flow line when a message throw/end event or Send Task fires                                                                                                                                                                                                                                                                                                                                        |
| SequenceFlow                          | Animated token movement between elements (not routed through behaviors)                                                                                                                                                                                                                                                                                                                                                              |
| Association                           | Animated when a compensation handler is entered                                                                                                                                                                                                                                                                                                                                                                                      |

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

Central orchestrator. Maintains a job queue, emits events, and delegates to element behaviors. `enter` is queued; everything else runs synchronously inside the current job. Key responsibilities:

- **Timer scheduling**: `scheduleDelay(callback, delayMs)` / `cancelDelay(id)` — all timers are paused on `pause()`, resumed with remaining time on `resume()`, and cancelled on `reset()`. `scheduleElementDelay(element, scope, callback, delayMs)` additionally records the timer in `scope.elementTimers`, so interrupting the element cancels it. Every element-bound delay (tasks, collapsed subprocesses, parallel multi-instance batches, gateway auto-routing, catch auto-fire) uses it.
- **Scopes**: `createScope(element, parent)` creates every scope (root, subprocess, multi-instance child, compensation helper) and arms the message, signal, timer and conditional starts of the element's event subprocesses.
- **Token lifecycle**:
  - `enter(element, scope, viaFlow?)` adds the token, arms the element's timer/message/signal/conditional boundaries on its first token, and delegates to the behavior. Jobs for a scope that is no longer running are dropped.
  - `exit(element, scope)` returns when the element holds no token in that scope (this is what makes stale timers harmless), removes one token, disarms the element's boundaries when its last token leaves, and routes onward.
  - `consumeToken(element, scope)` removes a token without `token:exit` (End Events, dead ends), then checks completion.
  - `routeToOutgoing(element, scope)` records the element in `scope.compensationRegistry` when it has a compensation handler, then animates each outgoing sequence flow.
- **Live-token accounting and completion**:
  - `animateFlow(connection, scope, done)` records the token on the connection (`scope.addInFlight`) before emitting `flow:animate`. When the visual layer calls back, `done` runs only if the record still exists and the scope is running, so cancelled flows never deliver.
  - `tryCompleteScope(scope)` is queued. When it runs, it stops unless the scope is running and `isQuiescent()`. A sequential ad-hoc scope then starts its next pending activity instead of completing. Otherwise the scope completes, its waiting points are disarmed, and it calls `scope.onComplete` (compensation helper scopes), exits the host in the parent, or emits `simulation:complete` at the root.
- **Waiting points**: see below.
- **Interrupts**:
  - `interruptElement(element, scope)`, `interruptAllInScope(scope, keepElementIds)` and `interruptRegion(scope, regionIds)` remove every token of the matched elements together with their element timers, owned or hosted waiting points, running child scopes (recursively, ending in `destroy`), and loop, multi-instance and join state. `interruptAllInScope` also removes every token on a flow of the scope, and `interruptRegion` the tokens on flows inside the region; `interruptElement` leaves flows alone.
  - They emit `element:interrupted` per element (the scope-wide variants also one `flows:cancelled` with the cancelled connections and their animation ids), then check completion. A replacement token must therefore be entered before interrupting, which is why `enterCatch` enters first.
  - The scope's own element counts as token-holding, because a compensation helper scope holds the handler's token under the handler's id. `interruptAllInScope` and `interruptRegion` also interrupt running helper scopes (children with `onComplete`) whose handler matches, and interrupting a scope interrupts all of its running children before `destroy()`. An interrupted handler emits `element:interrupted` and never continues the compensation chain.
  - `enterCatch({ element, scope, host?, interrupting }, keepElementIds?)` enters a boundary or an event subprocess; an interrupting one then interrupts its host, or the rest of its scope except `keepElementIds` together with the scope's other event-subprocess starts. An Error End Event passes its own id, then consumes its token like every other end event.
- **Messages**: `deliverMessage(element, scope)` fires every armed waiting point (element or event-gateway candidate) with the same message name; only when there is none, every armed event-subprocess message start. It then emits `message:send` with the outgoing message flows and the fired `targets`. `getMessageName` falls back to the task's own `messageRef` for Send and Receive Tasks.
- **Signals**: `broadcastSignal(element, scope)` fires every armed waiting point with the same signal name, in every scope, and emits `signal:broadcast` with the fired `targets`.
- **Compensation**: `runCompensation(scope, activityReference, onDone)` takes the newest matching entry from `scope.compensationRegistry` (filtered by `activityRef`), removes it, animates the association, and enters the handler in a helper child scope whose element is the handler itself (or the compensation event subprocess of an expanded subprocess). The helper's `onComplete` recurses to the next entry; `onDone` follows the last one. The running helper scope keeps the throwing scope from completing.
- **Termination signals**: `signalTerminated()` and `signalErrorTerminated(scope, element)` halt the engine (cancel all timers, clear job queue) before emitting the corresponding event.
- **Multi-instance counts**: `multiInstanceCounts: Map<string, number>` stores user-configured iteration counts per element (default 3). Synced from the controller on each simulation start; cleared on `reset()`. `loopUtils.getIterationCount` caps the count by `loopMaximum` (Standard Loop) or `bfw:MaxIterations` (multi-instance).
- **Complex join thresholds**: `setComplexJoinThreshold(elementId, threshold)` / `getComplexJoinThreshold(element)`, defaulting to the number of incoming flows and clamped to 1..M.

#### Waiting Points

A waiting point is a place where a token waits for an external trigger. The registry lives in the engine:

```typescript
interface Wait {
  id: number;
  kind: 'catch' | 'boundary' | 'event-subprocess-start' | 'event-gateway';
  element: any; // the catch, Receive Task, boundary, event-subprocess start, or event-based gateway
  scope: Scope;
  host?: any; // boundary host, or the event subprocess shape
  candidates?: any[]; // event-gateway successors
  repeatable: boolean; // stays armed after firing
  fireCount: number; // fires so far, for repeatable waits
  timerId?: number; // auto-fire timer
}
```

| Method                                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `armWait(properties)`                     | Registers the waiting point, emits `wait:armed`, then `scheduleAutoFire`                                                                                                                                                                                                                                                                                                                                                                                              |
| `fireWait(waitId, candidate?)`            | Fires once (disarms unless repeatable): a catch exits; an event gateway consumes its token and animates the chosen successor's flow; a boundary or event-subprocess start goes through `enterCatch`. A repeatable wait counts the fire, is disarmed once `fireCount` reaches the `R<n>` of its timer cycle (`getTimerCycleRepetitions`), and otherwise schedules its next auto-fire. Without a count (`R/…`, message, signal) it repeats until its host or scope ends |
| `disarmWait(waitId)`                      | Removes it, cancels its auto-fire timer, emits `wait:disarmed`                                                                                                                                                                                                                                                                                                                                                                                                        |
| `getArmedWaits()`                         | Armed waiting points of running scopes                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `setBoundaryAutoFire(elementId, enabled)` | Checkbox state for boundaries and event-subprocess starts; schedules or cancels the auto-fire of waits already armed for that element                                                                                                                                                                                                                                                                                                                                 |
| `setMode(mode)`                           | Cancels every wait's auto-fire on `step` and schedules them on `auto`. Task and gateway delays already running still finish                                                                                                                                                                                                                                                                                                                                           |

`scheduleAutoFire(wait)` (private) schedules one fire after `getTaskDelay()` when the mode is auto, no timer is pending and `canAutoFire` allows it; `cancelAutoFire(wait)` cancels it. Because checkbox changes act on armed waits, Replay needs no special ordering: the controller re-sends the restored checkboxes after `start()` has armed the root's event-subprocess starts.

Auto-fire rules (`canAutoFire`): boundaries and event-subprocess starts only when their checkbox is ticked. Catches and Receive Tasks unless a thrower of the same message or signal exists in the active pool (`throwerNames`, collected in `start()` / `startFromElement()` from throw events, End Events and Send Tasks; keys are prefixed `signal:` / `message:`). Event gateways pick a random candidate among those that could auto-fire, and wait when there is none. Deliveries and clicks always fire.

#### Event Resolver

**Path:** `studio/src/modules/bpmn-token-simulator/core/eventResolver.ts`

`resolveError(scope, code, elementRegistry)` and `resolveEscalation(scope, code, elementRegistry)` walk upward from the throwing scope, in the Engine's order:

1. An error or escalation event subprocess of the scope. Its start is looked up via the element registry for collapsed event subprocesses.
2. A matching boundary on the scope's host.
3. The same one level up.

A catcher without a code catches everything; a thrower without a code is caught only by catch-all catchers. A specific code wins over catch-all. At a host, `resolveEscalation` returns every matching non-interrupting boundary plus one interrupting boundary. The results are `EventCatch` objects passed to `engine.enterCatch`.

#### Scope

**Path:** `studio/src/modules/bpmn-token-simulator/core/Scope.ts`

Represents a running scope (root process or child sub-process). Tracks several categories of state:

| State                         | Purpose                                                                                                                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTokenCounts`           | Reference-counted map of element IDs where tokens reside. Supports parallel forks with multiple tokens at one element                                                                                                        |
| In-flight connections         | `addInFlight(animationId, connection)` / `removeInFlight(animationId)` / `takeInFlight(predicate)` (returns `{ animationId, connection }[]`) — tokens currently travelling along a flow                                      |
| `elementTimers`               | Pending element-bound timer ids per element id, cancelled when the element is interrupted                                                                                                                                    |
| Join counters                 | `incrementJoinCounter` / `getJoinCounter` — parallel and Complex join synchronization                                                                                                                                        |
| `satisfiedJoinFlows`          | Inclusive join arrivals in order (one incoming-flow id per arrival). `consumeSatisfiedJoinFlows` removes the first arrival of each incoming flow and returns how many it removed; repeated arrivals stay for the next firing |
| `loopCounters`                | Sequential MI / standard loop iteration progress                                                                                                                                                                             |
| `parallelMiCounters`          | Parallel MI sub-process child scope completion tracking (`expected` vs `completed`)                                                                                                                                          |
| `compensationRegistry`        | Completed activities with a compensation handler, oldest first; an activity appears at most once                                                                                                                             |
| `onComplete`                  | Optional callback run instead of exiting the host when the scope completes (compensation helper scopes)                                                                                                                      |
| `pendingSequentialActivities` | Activities of a sequential ad-hoc subprocess still to start                                                                                                                                                                  |

`isQuiescent()` is true when the scope holds no token, nothing travels along a flow, and no child scope is running. Armed waiting points do not count.

`collectActiveTokens()` recursively gathers element IDs from this scope and all running child scopes into a `Set<string>` — used by the inclusive join's backward reachability check (`graphUtils.hasUpstreamToken`). For a token on a flow it reports the flow's **source**, so a token travelling into an inclusive join counts as upstream of that join. All state is cleared on `destroy()`, which recursively destroys running child scopes.

#### Behaviors

Each behavior implements the `{ enter, exit?, signal? }` interface:

```typescript
interface Behavior {
  enter(element: any, scope: Scope, engine: SimulationEngine, viaFlow?: any): void;
  exit?(element: any, scope: Scope, engine: SimulationEngine): void;
  signal?(element: any, scope: Scope, engine: SimulationEngine, data?: any): void;
}
```

Registration lives in `core/behaviors/index.ts`. Types without an exact registration fall back by name: `*Task` and `*Activity` to `TaskBehavior`.

| Behavior                         | Registered for            | Summary                                                                                                                                                                       |
| -------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StartEventBehavior`             | StartEvent, BoundaryEvent | Pass-through; a root timer start with date/duration arms a catch waiting point                                                                                                |
| `EndEventBehavior`               | EndEvent                  | Terminate, Error, Escalation, Compensation, Cancel, Message, Signal and None end events as in the table above; every path ends in `consumeToken` or an interrupt              |
| `TaskBehavior`                   | Task (and fallbacks)      | Timed exit (auto) or waits for click (step); Receive Task waiting point; Send Task delivery on exit. MI/loop via `loopUtils.ts`                                               |
| `SubProcessBehavior`             | SubProcess, Transaction   | Creates child scopes via `createScope` (expanded) or schedules delays (collapsed). MI/loop via `loopUtils.ts`                                                                 |
| `AdHocSubProcessBehavior`        | AdHocSubProcess           | Extends `SubProcessBehavior`; enters activities without incoming flow in parallel, or queues them in `pendingSequentialActivities`                                            |
| `ExclusiveGatewayBehavior`       | ExclusiveGateway          | User choice (step) or default/first flow (auto)                                                                                                                               |
| `InclusiveGatewayBehavior`       | InclusiveGateway          | Fork (`fork`, public): `selectInclusiveFlows` or multi-select. Join: reachability via `hasUpstreamToken`, re-checked every 500 ms while waiting                               |
| `ComplexGatewayBehavior`         | ComplexGateway            | Extends `InclusiveGatewayBehavior`; split reuses `fork`, join fires at the threshold and calls `interruptRegion(scope, findComplexRegion(join))`                              |
| `ParallelGatewayBehavior`        | ParallelGateway           | Fork: all outgoing. Join: waits for all incoming                                                                                                                              |
| `EventBasedGatewayBehavior`      | EventBasedGateway         | Arms one `event-gateway` waiting point with the successors as candidates                                                                                                      |
| `IntermediateThrowEventBehavior` | IntermediateThrowEvent    | Link (same scope), Message (`deliverMessage`), Signal (`broadcastSignal`), Escalation (`resolveEscalation`, then continues), Compensation (`runCompensation`, then continues) |
| `IntermediateCatchEventBehavior` | IntermediateCatchEvent    | Arms a catch waiting point for message, signal, timer and conditional catches; others pass through                                                                            |

Multi-instance and loop logic is shared between `TaskBehavior` and `SubProcessBehavior` via `core/loopUtils.ts` (`getLoopType`, `getIterationCount`).

#### Graph Utilities

**Path:** `studio/src/modules/bpmn-token-simulator/core/graphUtils.ts`

- `hasUpstreamToken(targetFlow, scope, excludeGatewayId)` — backward search from a join's incoming flow for any active token (including tokens on flows).
- `selectInclusiveFlows(gateway, outgoing)` — the non-default flows, or the default flow when it is the only one.
- `findComplexRegion(join)` — the element and flow ids reachable forward from the nearest upstream Complex split and backward from the join. Empty when no Complex split is upstream. Nested Complex pairs can pair with the wrong split (marked `ponytail:` in the code).

#### Event Definition Utilities

**Path:** `studio/src/modules/bpmn-token-simulator/core/eventDefUtils.ts`

Shared helpers for detecting BPMN event definitions and element kinds. Used by the behaviors, the resolver, the engine and the controller:

- `isMessageEvent` / `isSignalEvent` / `isLinkEvent` / `isErrorEvent` / `isEscalationEvent` / `isTerminateEvent` / `isTimerEvent` / `isTimerCycle` / `isConditionalEvent` / `isCompensateEvent` / `isCancelEvent` — detection via `element.businessObject.eventDefinitions`
- `getTimerCycleRepetitions` — the `n` of an `R<n>/…` cycle, `undefined` for `R/…` or a non-cycle timer
- `getSignalName`, `getMessageName` (falls back to the task's own `messageRef`), `getLinkName`, `getErrorCode` (inline `bfw:ErrorCode`, else `errorRef.errorCode`), `getEscalationCode`, `getCompensateActivityRef`
- `getCompensationHandler(boundary)` — the `isForCompensation` target of the boundary's association
- `selectStartEvents(container)` — untyped start events if any, else all; an event subprocess gets its single typed start event
- `isSubProcessType` (SubProcess, Transaction, AdHocSubProcess), `isEventSubProcess`, `isInterruptingStart`, `findEventSubProcessStart(eventSubProcess, elementRegistry)` (a collapsed event subprocess keeps its start on its own plane)
- `findBfwBody(owner, name)` — body of the `bfw:<name>` extension element
- `getMessageFlows(element)` — returns `element.outgoing` filtered to `bpmn:MessageFlow` connections

Sequence flows are not routed through behaviors — they are handled directly by `engine.animateFlow()` from `routeToOutgoing()`.

#### Engine Events

| Event                                                           | Purpose                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `token:enter` / `token:exit`                                    | Token lifecycle on elements                                                                                   |
| `flow:animate`                                                  | Request animation along a sequence flow; carries the engine's `animationId`                                   |
| `element:waiting`                                               | Element waiting for user interaction (step mode)                                                              |
| `gateway:choice`                                                | Exclusive gateway needs user branch selection (step mode)                                                     |
| `gateway:auto`                                                  | Exclusive gateway auto-routing; carries `chosenFlow`, `outgoing`, and a `cancel` callback                     |
| `gateway:inclusive-choice`                                      | Inclusive gateway needs user multi-select (step mode)                                                         |
| `gateway:inclusive-auto`                                        | Inclusive gateway auto-forking; interceptable                                                                 |
| `event-gateway:chosen`                                          | Event-based gateway fired; carries the chosen `flow` for the chosen-flow highlight                            |
| `wait:armed` / `wait:disarmed`                                  | Waiting point registered / removed; carries the `Wait`                                                        |
| `element:interrupted`                                           | An element's tokens were removed by an interrupt                                                              |
| `flows:cancelled`                                               | Tokens on these `connections` were removed; the visual layer cancels the animations with these `animationIds` |
| `message:send`                                                  | Message throw/end event or Send Task fired; carries outgoing `messageFlows[]` and the fired `targets[]`       |
| `signal:broadcast`                                              | Signal throw/end event fired; carries `signalName` and `targets[]` of the fired waiting points                |
| `scope:complete`                                                | Scope (root or child) has completed                                                                           |
| `simulation:terminated`                                         | Terminate end event destroyed the process scope                                                               |
| `simulation:error-terminated`                                   | Unhandled error end event at root level; carries the error element                                            |
| `simulation:start` / `simulation:reset` / `simulation:complete` | Simulation lifecycle                                                                                          |
| `simulation:pause` / `simulation:resume`                        | Pause/resume lifecycle                                                                                        |

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

Supports `pause()` / `resume()` — stores elapsed progress per animation on pause and adjusts start times on resume. `animate()` takes an optional fifth parameter `engineAnimationId`. `cancelAnimations(engineAnimationIds)` removes exactly those animations without calling their `done`, because the engine has already taken the tokens back; animations of other scopes on the same connection (parallel multi-instance) keep running. It is called only from the controller's `flows:cancelled` handler, which keeps the engine's token accounting and the animations in step.

#### ElementHighlighter

**Path:** `studio/src/modules/bpmn-token-simulator/visual/ElementHighlighter.ts`

Toggles CSS classes on element SVG groups via `elementRegistry.getGraphics()`:

| Class                               | Purpose                                               |
| ----------------------------------- | ----------------------------------------------------- |
| `token-sim-highlight-active`        | Green glow on the currently active element            |
| `token-sim-highlight-completed`     | Subtle completed indicator                            |
| `token-sim-highlight-visited`       | Persistent breadcrumb trail (survives until reset)    |
| `token-sim-highlight-flow-visited`  | Persistent flow breadcrumb trail                      |
| `token-sim-highlight-flow-chosen`   | Blue glow on chosen gateway outgoing flow             |
| `token-sim-highlight-error`         | Red error glow (double `drop-shadow`)                 |
| `token-sim-highlight-message-flow`  | Gold glow on message flow connections                 |
| `token-sim-highlight-message-pulse` | Brief gold pulse animation on message target elements |

`pulseElement(element)` applies the pulse class with a forced reflow to retrigger the CSS animation, then removes it after 1.2s. `clearActive(element)` removes the active glow without marking the element completed; the controller uses it for interrupted elements.

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

| Component                       | Role                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GatewayChoiceOverlay`          | Branch selection popup for exclusive gateways (step mode)                                                                                                                                      |
| `InclusiveGatewayChoiceOverlay` | Multi-select overlay for inclusive and Complex splits (step mode). `initialSelected` comes from `selectInclusiveFlows`; the `defaultFlowId` flow is mutually exclusive with the others         |
| `ElementPlayButton`             | Green play button on start events, tasks (step), and every armed waiting point in step mode (one per event-gateway candidate; on the shape of a collapsed event subprocess)                    |
| `GatewayConfigButton`           | Persistent signpost overlay on gateways for path pre-configuration                                                                                                                             |
| `BoundaryEventCheckbox`         | Persistent checkbox overlay for auto-fire configuration on timer, message, signal and conditional boundaries and event-subprocess starts (on the shape when the event subprocess is collapsed) |
| `MultiInstanceConfigButton`     | Persistent "Nx" badge overlay on MI/loop elements for iteration count configuration. Optional `badgeText`, `description`, `heading` and `maximum` props serve the Complex join "N of M" badge  |
| `MultiInstanceCountOverlay`     | Count picker behind the badge; honours `heading` and `maximum`                                                                                                                                 |
| `SimulationLogPanel`            | Scrollable timestamped event log panel below the toolbar                                                                                                                                       |
| `flowLabel` utility             | Shared `getFlowLabel(flow)` for deriving human-readable flow labels                                                                                                                            |

All overlay entries track their `ReactDOM.Root` for proper cleanup. Creation boilerplate is centralized in the controller's `createOverlay()` helper.

#### TokenSimulationController

**Path:** `studio/src/modules/bpmn-token-simulator/TokenSimulationController.ts`

Orchestrator that wires engine events to visual layer methods. Created lazily by the bridge's `toggle()` method. Key responsibilities:

- **Lifecycle management**: Manages `activate` / `deactivate` / `dispose` transitions. On activation, reads persisted settings, shows start event and MI config overlays, registers tooltips and keyboard shortcuts.
- **Engine-to-visual wiring**: Subscribes to all engine events and delegates to `TokenRenderer`, `FlowAnimator`, and `ElementHighlighter` accordingly.
- **Overlay management**: Creates and tracks overlays for gateways, boundary events, multi-instance config, Complex join thresholds, counters, and play buttons. Scans recursively via `forEachFlowElement()`, which descends into any shape with children.
- **Waiting points**: `wait:armed` adds a play button in step mode (overlay key `wait_<id>`, overlay type from `waitOverlayTypes`), `wait:disarmed` removes it, and `setMode('step')` adds buttons for every waiting point that is still armed.
- **Step buttons**: the play buttons of waiting tasks and collapsed subprocesses and the step buttons of exclusive, inclusive and Complex gateways get one overlay per waiting token, keyed `step:<scopeId>:<elementId>:<counter>`. A click removes only its own button, so stacked tokens and parallel multi-instance iterations each keep theirs. `removeStepOverlays(elementId, scopeId)` removes the rest when the scope's last token leaves the element or the element is interrupted.
- **Interrupts**: `element:interrupted` removes the element's tokens, active highlight (`ElementHighlighter.clearActive`), overlays and step buttons and, for subprocess types, its child visuals; `flows:cancelled` calls `FlowAnimator.cancelAnimations`.
- **Preference maps**: `gatewayPreferences`, `boundaryPreferences`, `multiInstanceConfig`, `complexJoinThresholds` — pushed to the engine (`setBoundaryAutoFire`, `setMultiInstanceCount`, `setComplexJoinThreshold`) and re-sent on `simulation:start`; gateway preferences are applied when a gateway emits its choice/auto event.
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

- **Auto mode**: Tokens flow automatically with configurable speed (0.1x–5.0x). All delays use engine-managed scheduling that respects pause/resume. A catch or Receive Task whose message or signal has a thrower in the pool waits for that throw instead of auto-firing; boundaries and event-subprocess starts auto-fire only when their checkbox is ticked, and ticking or unticking takes effect on waiting points that are already armed. A repeatable one fires again after each fire, up to the `R<n>` of a timer cycle, otherwise until its host or scope ends. If the run stalls on a waiting point, switch to step mode and click its play button.
- **Step mode**: Tokens pause at each activity and at every armed waiting point. User clicks play buttons to advance. Switching to step mode mid-run stops the pending auto-fire of every waiting point and adds play buttons to them; task and gateway delays already running still finish. Switching back to auto schedules the auto-fire of every armed waiting point again.
- **Pause/Resume**: Freezes all token movement, both engine timers and flow animations. Visual state is preserved.

### Gateway Pre-Configuration

Persistent signpost overlays appear on all exclusive/inclusive gateways (with >1 outgoing) when the simulator activates. Users can pre-select paths before starting or while a simulation runs. When a token reaches a pre-configured gateway, the preference is applied immediately. Preferences survive pause/resume and replay; cleared on reset/deactivate.

### Multi-Instance and Loop Activities

Tasks and sub-processes with `loopCharacteristics` are detected and simulated. Users configure the iteration count (default 3) via persistent "Nx" badge overlays shown on activation.

- **Parallel MI**: Schedules N independent timers (tasks) or creates N independent child scopes (expanded sub-processes) running simultaneously.
- **Sequential MI / Standard Loop**: Re-enters the element N times in series.
- **Step mode**: Parallel MI waits for a single click to start the batch; sequential MI requires one click per iteration.
- **Caps**: the configured count is capped by `loopMaximum` (Standard Loop) or `bfw:MaxIterations` (multi-instance). The visit counter uses the same capped count.

Configuration persists across replay; cleared on deactivate.

### Complex Join Threshold

Every Complex Gateway with more than one incoming flow gets a persistent "N of M" badge (built on `MultiInstanceConfigButton`). N defaults to M (wait for all branches) and can be set from 1 to M. The join fires once N branches have arrived, then interrupts the remaining tokens in its region. Thresholds persist across replay, are cleared on deactivate, and are not saved with the diagram.

### Token Counters and Simulation Log

- **Token counters**: Purple visit-count badges at the bottom-right of each visited element. Toggled via toolbar button.
- **Breadcrumb trail**: Visited elements and flows receive persistent subtle highlights that remain until reset.
- **Simulation log**: Timestamped in-memory event log, displayed in a scrollable panel below the toolbar. Toggled via toolbar button.
- **Trace export**: One-click JSON export of the simulation log (`simulation-trace-{timestamp}.json`).

### Keyboard Shortcuts

| Key    | Action            | Guard                                                            |
| ------ | ----------------- | ---------------------------------------------------------------- |
| Space  | Pause / Resume    | Ignored in input/textarea/select, or with Ctrl/Cmd/Alt modifiers |
| R      | Replay simulation | Same                                                             |
| Escape | Reset simulation  | Same                                                             |

### Hover Tooltips

Hovering over an element during an active simulation shows a tooltip with element name, type, and visit count. Tooltips appear near the cursor and disappear on `element.out`. Registered/unregistered on activate/deactivate via `eventBus` hover events.

---

## Settings Persistence

The module registers four settings via `bifrost.settings.register()` at load time. These persist toolbar preferences across sessions.

| Setting key                           | Type                       | Default | GUI | Description               |
| ------------------------------------- | -------------------------- | ------- | --- | ------------------------- |
| `tokenSimulator.toolbar.mode`         | `string` (`auto` / `step`) | `auto`  | Yes | Default simulation mode   |
| `tokenSimulator.toolbar.speed`        | `number` (0.1–5.0)         | `1.0`   | Yes | Default speed multiplier  |
| `tokenSimulator.toolbar.showCounters` | `boolean`                  | `false` | Yes | Show token counter badges |
| `tokenSimulator.toolbar.showLog`      | `boolean`                  | `false` | Yes | Show simulation log panel |

All four appear in the Settings editor under the **Token Simulator** category.

**Not persisted**: Gateway/boundary/multi-instance/Complex-threshold per-diagram preferences (transient, diagram-specific), active/inactive toggle state, running/paused state.

Settings are bridged into the diagram-js DI graph via the `TokenSimSettingsAccessor` value provider (see DI Module Registration above). The controller reads settings on `activate()` and writes back on each user interaction.

---

## Theme Integration

All colors are CSS variables defined in `token-simulation.scss` within the light and dark theme blocks (`.bifrost.bifrost-theme--light` / `.bifrost.bifrost-theme--dark`):

| Variable group                                                           | Purpose                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------- |
| `--token-sim-token-fill` / `--token-sim-token-stroke`                    | SVG token circles                                 |
| `--token-sim-active-shadow` / `--token-sim-completed-shadow`             | Element highlighting                              |
| `--token-sim-toolbar-*`                                                  | Toolbar appearance                                |
| `--token-sim-overlay-*`                                                  | Gateway choice / play button overlays             |
| `--token-sim-play-btn-color`                                             | Play button color                                 |
| `--token-sim-flow-chosen-color`                                          | Sequence flow highlight (blue/light blue)         |
| `--token-sim-visited-shadow` / `--token-sim-flow-visited-color`          | Breadcrumb trail highlighting (green tones)       |
| `--token-sim-counter-bg` / `--token-sim-counter-fg`                      | Token counter badges (purple)                     |
| `--token-sim-mi-badge-bg` / `--token-sim-mi-badge-fg`                    | Multi-instance badge (theme-specific)             |
| `--token-sim-message-flow-color` / `--token-sim-message-flow-token-fill` | Message flow gold highlight and animated token    |
| `--token-sim-message-pulse-shadow`                                       | Gold pulse animation on message target elements   |
| `--token-sim-signal-ripple-color`                                        | Signal broadcast ripple ring color (purple tones) |

The palette toggle entry uses `--theme-focus` for the active state highlight color (`.token-sim-palette-entry--active`).

The module's stylesheet references these variables exclusively.

---

## File Path Reference

| Component                     | Path                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Module entry point            | `studio/src/modules/bpmn-token-simulator/index.ts`                                                                          |
| Bridge module                 | `studio/src/modules/bpmn-token-simulator/TokenSimulationBridge.ts`                                                          |
| Palette provider              | `studio/src/modules/bpmn-token-simulator/TokenSimPaletteProvider.ts`                                                        |
| Controller                    | `studio/src/modules/bpmn-token-simulator/TokenSimulationController.ts`                                                      |
| Scope                         | `studio/src/modules/bpmn-token-simulator/core/Scope.ts`                                                                     |
| SimulationEngine              | `studio/src/modules/bpmn-token-simulator/core/SimulationEngine.ts`                                                          |
| Graph utilities               | `studio/src/modules/bpmn-token-simulator/core/graphUtils.ts`                                                                |
| Loop utilities                | `studio/src/modules/bpmn-token-simulator/core/loopUtils.ts`                                                                 |
| Event definition utilities    | `studio/src/modules/bpmn-token-simulator/core/eventDefUtils.ts`                                                             |
| Error/escalation resolver     | `studio/src/modules/bpmn-token-simulator/core/eventResolver.ts`                                                             |
| Behaviors                     | `studio/src/modules/bpmn-token-simulator/core/behaviors/` (incl. `ComplexGatewayBehavior.ts`, `AdHocSubProcessBehavior.ts`) |
| Engine unit tests             | `studio/test/unit/bpmn-token-simulator/simulationEngine.test.ts`                                                            |
| TokenRenderer                 | `studio/src/modules/bpmn-token-simulator/visual/TokenRenderer.ts`                                                           |
| FlowAnimator                  | `studio/src/modules/bpmn-token-simulator/visual/FlowAnimator.ts`                                                            |
| ElementHighlighter            | `studio/src/modules/bpmn-token-simulator/visual/ElementHighlighter.ts`                                                      |
| SimulationToolbar             | `studio/src/modules/bpmn-token-simulator/components/SimulationToolbar.tsx`                                                  |
| GatewayChoiceOverlay          | `studio/src/modules/bpmn-token-simulator/components/GatewayChoiceOverlay.tsx`                                               |
| InclusiveGatewayChoiceOverlay | `studio/src/modules/bpmn-token-simulator/components/InclusiveGatewayChoiceOverlay.tsx`                                      |
| ElementPlayButton             | `studio/src/modules/bpmn-token-simulator/components/ElementPlayButton.tsx`                                                  |
| GatewayConfigButton           | `studio/src/modules/bpmn-token-simulator/components/GatewayConfigButton.tsx`                                                |
| BoundaryEventCheckbox         | `studio/src/modules/bpmn-token-simulator/components/BoundaryEventCheckbox.tsx`                                              |
| SimulationLogPanel            | `studio/src/modules/bpmn-token-simulator/components/SimulationLogPanel.tsx`                                                 |
| MultiInstanceConfigButton     | `studio/src/modules/bpmn-token-simulator/components/MultiInstanceConfigButton.tsx`                                          |
| MultiInstanceCountOverlay     | `studio/src/modules/bpmn-token-simulator/components/MultiInstanceCountOverlay.tsx`                                          |
| flowLabel utility             | `studio/src/modules/bpmn-token-simulator/components/flowLabel.ts`                                                           |
| Styles + theme variables      | `studio/src/modules/bpmn-token-simulator/token-simulation.scss`                                                             |
