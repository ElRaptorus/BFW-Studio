---
title: Ad-hoc Sub-Process
---

# Ad-hoc Sub-Process

![Ad-hoc Sub-Process](AdHocSubprocess.svg)

An `Ad-hoc Sub-Process` is an unstructured "menu" of activities that carry **no sequence flows between them**. Instead of a fixed order, its inner activities are activated based on the `Active Elements` FEEL expression, and the whole sub-process finishes once its `Completion Condition` becomes true (or, absent one, once every activity has run in `Sequential` ordering, or immediately in `Parallel` ordering once no more activities can be activated).

## Ordering

| Ordering       | Behaviour                                                                      |
| -------------- | ------------------------------------------------------------------------------ |
| **Parallel**   | All currently-active inner elements run concurrently.                          |
| **Sequential** | Only one inner element runs at a time, in the order the engine activates them. |

## Active Elements

A FEEL expression, evaluated **once** when the Ad-hoc Sub-Process starts, against the current token (the standard `token` / `this` / `context` / `dataObjects` / `process` / `processInstance` / `identity` bindings). It **must evaluate to a list of strings** — the element `id`s of the inner activities to activate immediately. Any other shape (a single string, a number, an object, `null`) — or a FEEL evaluation error — is treated as "no restriction": the Engine falls back to activating every eligible inner activity, the same as leaving this field empty.

**Example.** Given an Ad-hoc Sub-Process with three inner tasks `Task_LookupOrder`, `Task_CheckInventory`, and `Task_SendEmail`, an expression like

```feel
if token.priority = "high" then ["Task_LookupOrder", "Task_SendEmail"] else ["Task_LookupOrder"]
```

activates `Look Up Order` and `Send Email` for high-priority tokens, or only `Look Up Order` otherwise — `Check Inventory` never runs unless it is also referenced by a later evaluation path (`activate_activity`, or a subsequent activation once `Look Up Order` completes, if it has an incoming sequence flow from it).

This field is only consulted in **engine-managed** mode (`Implementation` empty). In **plugin-managed** mode the plugin decides activation via the facade, so this field is ignored — leave it empty when `Implementation` is set. Note also that with `Ordering` set to `Sequential` and `Implementation` empty, this field becomes **required**: the list's order **is** the execution order, since the Engine has no other basis for picking the next activity.

## Completion Condition

A FEEL expression re-evaluated after each inner activity finishes. Once it evaluates to `true`, the Ad-hoc Sub-Process completes — any still-running activities are interrupted only if `Cancel Remaining Instances` is enabled.

## Cancel Remaining Instances

- **Yes (interrupt on completion)** — as soon as the completion condition is met, all still-active inner activities are interrupted immediately.
- **No (drain naturally)** — already-running inner activities are allowed to finish before the sub-process completes.

## Implementation

Setting this field switches the Ad-hoc Sub-Process from **engine-managed** to **plugin-managed** mode. It is **not** a registry-keyed dispatch like the `implementation` attribute on a Service Task (which the Engine uses to look up a specific registered handler, e.g. `http`). For an Ad-hoc Sub-Process, the value is purely a **flag plus a human-readable label** — as soon as it is non-empty, the Engine stops auto-activating anything on its own (`Active Elements` and the "no incoming flow" default are both skipped) and waits for an external actor — a plugin, or a human via REST — to drive activation through the `adhoc_subprocesses` facade namespace / `/adhoc-subprocesses/{id}/*` REST endpoints (`get_enabled_activities`, `activate_activity`, `complete`).

Any plugin can subscribe to this by registering an Event Sink and reacting to `SubProcessChildStarted` events where `isAdHocSubprocess` is `true` — the Engine does **not** filter or route by the `Implementation` string. Convention is what ties a diagram's `Implementation` value to the plugin meant to handle it (e.g. naming the sink after the value), not engine-enforced dispatch. If multiple plugins are listening, all of them see every plugin-managed Ad-hoc Sub-Process that starts, regardless of its `Implementation` value.

**Example.** Setting `Implementation` to `ai-toolbox` on a "Resolve Inquiry" Ad-hoc Sub-Process containing tasks `Look Up Order`, `Check Inventory`, `Create Ticket`, `Send Email`, and `Escalate To Human` produces this concrete sequence at runtime:

1. The shell activates; the Engine performs **no** automatic activation because `Implementation` is set.
2. The Engine emits `SubProcessChildStarted` with `isAdHocSubprocess: true`.
3. A plugin's Event Sink (e.g. registered as `facade.register_event_sink.("ai-toolbox", MyToolboxSink, ...)` — the `"ai-toolbox"` name here is just this plugin's own registration label, chosen to match the diagram for readability) receives that event, calls `facade.adhoc_subprocesses.get_enabled_activities.(childProcessInstanceId)` to see what is available, then calls `facade.adhoc_subprocesses.activate_activity.(childProcessInstanceId, "Task_LookupOrder")` to start the first tool.
4. Each time an activated task finishes, the plugin reacts to `FlowNodeInstanceFinished`, decides the next tool (or that it's done) via its own logic, and either activates another task or calls `facade.adhoc_subprocesses.complete.(childProcessInstanceId)`.

Leave this field empty for engine-managed mode. A full worked reference implementation of the above (including the sink module and BPMN fixture) lives in `examples/plugins/adhoc/ai_toolbox/` in the Engine repository.
