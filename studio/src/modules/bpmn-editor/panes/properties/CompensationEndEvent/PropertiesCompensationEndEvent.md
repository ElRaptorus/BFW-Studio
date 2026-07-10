---
title: Compensation End Event
---

# Compensation End Event

![Compensation End Event](CompensationEndEvent.svg)

The `Compensation End Event` is a specialized [End Event](help://bpmn/properties/end_event) that triggers compensation for all completed activities in the current process scope, then terminates the path.

## Behavior

- Triggers compensation in **LIFO order** (last completed activity first).
- Waits for all compensation handlers to finish.
- The process instance transitions to the **Compensated** terminal state.
- Unlike the [Compensation Intermediate Throw Event](help://bpmn/properties/compensation_intermediate_throw_event), the flow does **not** continue after a Compensation End Event — it ends the path.

## When to use

Use a Compensation End Event when compensation is the final action of the process (or a branch). For mid-flow compensation where the process should continue afterwards, use the [Compensation Intermediate Throw Event](help://bpmn/properties/compensation_intermediate_throw_event) instead.
