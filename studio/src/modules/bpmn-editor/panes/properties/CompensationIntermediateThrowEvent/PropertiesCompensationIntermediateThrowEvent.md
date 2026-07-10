---
title: Compensation Intermediate Throw Event
---

# Compensation Intermediate Throw Event

![Compensation Intermediate Throw Event](CompensationIntermediateThrowEvent.svg)

The `Compensation Intermediate Throw Event` is a specialized [Intermediate Event](help://bpmn/properties/intermediate_event) that triggers compensation of already-completed work, then **continues** along the outgoing sequence flow.

## Behavior

- Triggers compensation in **LIFO order** (last completed activity first).
- Waits for all compensation handlers to finish before continuing.
- Can be **broadcast** (compensates all completed activities with handlers) or **targeted** (compensates a specific activity via `activityRef`).

## Broadcast vs targeted

- **Broadcast** (no `activityRef`): all completed activities with compensation boundary events are compensated in reverse order.
- **Targeted** (`activityRef` set): only the specified activity is compensated.

## Continuation after compensation

Unlike the [Compensation End Event](help://bpmn/properties/compensation_end_event), the Intermediate Throw Event does not terminate the path. The process continues on the outgoing sequence flow after all handlers have completed.
