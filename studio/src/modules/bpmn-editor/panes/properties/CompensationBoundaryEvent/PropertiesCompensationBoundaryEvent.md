---
title: Compensation Boundary Event
---

# Compensation Boundary Event

![Compensation Boundary Event](CompensationBoundaryEvent.svg)

The `Compensation Boundary Event` is a specialized [Boundary Event](help://bpmn/properties/boundary_event) that registers a compensation handler for its attached activity. It is always **non-interrupting** — it does not fire while the activity is running.

## How it works

1. **Registration**: When the attached activity completes successfully, the Engine registers the compensation boundary event and its linked handler activity.
2. **Triggering**: When a [Compensation Throw Event](help://bpmn/properties/compensation_intermediate_throw_event) or [Compensation End Event](help://bpmn/properties/compensation_end_event) is reached, the Engine runs the compensation handlers in **reverse order** (LIFO — last completed, first compensated).
3. **Handler execution**: The handler activity linked via a `bpmn:Association` runs to undo the original activity's effect.

## Wiring the handler

Connect this boundary event to the handler activity using a `bpmn:Association` (not a Sequence Flow). The handler activity must have `isForCompensation` set to `true`. The linter rule **BSC-011** enforces that compensation boundary events do not have outgoing sequence flows.

## Compensation Event Subprocess precedence

If the process also contains a [Compensation Event Subprocess](help://bpmn/properties/compensation_start_event), broadcast compensation triggers the Event Subprocess **instead of** the individual boundary handlers. Targeted compensation (specifying an `activityRef`) always uses the boundary handler directly and skips the Event Subprocess.
