---
title: Sequential Iteration Settings
---

# Sequential Iteration Settings

These settings control the sequential iteration behavior of a Multi-Instance activity. They only apply when the Multi-Instance is configured as **sequential** (one iteration at a time).

## Loop Break Condition

The `Loop Break Condition` is a [formula](help://bpmn/runtime_expressions) checked after each iteration completes. When it evaluates to `true`, the remaining iterations are skipped.

## Loop Interval

The `Loop Interval` is a waiting time inserted between consecutive iterations — for example `PT5S` for five seconds. Useful for rate-limiting calls to an external system.

## Max Iterations

The `Max Iterations` field caps how many items from the input collection are processed. Items beyond this limit are silently skipped.
