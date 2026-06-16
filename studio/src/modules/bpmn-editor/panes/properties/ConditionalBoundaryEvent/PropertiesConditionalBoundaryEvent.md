---
# This is a comment, which might be helpful to explain the concept of help texts
title: Conditional Boundary Event
---

# Conditional Boundary Event

![Conditional Boundary Event](ConditionalBoundaryEvent.svg)

The `Conditional Boundary Event` is a specialized [Boundary Event](help://bpmn/properties/boundary_event) that is triggered when an annotated condition becomes true.
Conditions are modeled by using FEEL expressions.

This FEEL expression must evaluate to a **boolean** value. Otherwise, an error will be thrown.

## Scope

`Conditional Boundary Events` can currently only access data from the Process Instance in which they are executed.
FEEL expressions cannot access data from other process instances.

Therefore, it is currently not possible to listen for changes in a child process or a parent process.

## Non-Interrupting Conditional Boundary Event

If the `Conditional Boundary Event` is marked as **non-interrupting**, the decorated `Activity` won't be canceled when the Boundary Event triggers.

However, even a non-interrupting `Conditional Boundary Event` will only ever be **triggered once**. This is because this Event Type has no deterministic Event Source, but basically reacts to _any_ changes in the process instance.

So to prevent a host of unintented trigger occurences, the non-interrupting `Condition Boundary Event` will only wait until the condition is fulfilled once and then finish.
