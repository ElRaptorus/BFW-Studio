---
title: Conditional Boundary Event
---

# Conditional Boundary Event

![Conditional Boundary Event](ConditionalBoundaryEvent.svg)

A `Conditional Boundary Event` is attached to an activity and fires when a condition becomes true while that activity is running.

## Configuration

- **`Condition`** — a [formula](help://bpmn/runtime_expressions) that results in `true` or `false`. It is re-checked every time the process data changes, and the event fires as soon as it becomes `true`.

If the formula returns something other than `true` or `false`, it is treated as "not yet true" and the event keeps waiting. This is not reported as an error.

The condition can only read data from its own process, not from a parent or child process.

## Interrupting vs. non-interrupting

- **Interrupting** (solid border): the activity is cancelled when the event fires.
- **Non-interrupting** (dashed border): the activity keeps running and an additional path starts alongside it.

Either way, the event fires **only once**. Because it reacts to ongoing changes rather than a single incoming trigger, it waits for the condition to become true one time and then completes — this avoids a flood of repeated triggers.
