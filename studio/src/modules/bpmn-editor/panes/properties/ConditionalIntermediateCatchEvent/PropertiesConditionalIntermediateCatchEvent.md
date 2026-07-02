---
title: Conditional Intermediate Catch Event
---

# Conditional Intermediate Catch Event

![Conditional Intermediate Catch Event](ConditionalIntermediateCatchEvent.svg)

A `Conditional Intermediate Catch Event` pauses the flow until a condition becomes true, then continues.

## Configuration

- **`Condition`** — a [formula](help://bpmn/runtime_expressions) that results in `true` or `false`. The event waits, re-checks the condition every time the process data changes, and continues as soon as it becomes `true`.

If the formula ever returns something other than `true` or `false`, it is treated as "not yet true" and the event keeps waiting. This is not reported as an error, so make sure your formula really resolves to `true` or `false`.

The condition can only read data from its own process, not from a parent or child process.
