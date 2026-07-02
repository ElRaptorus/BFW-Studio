---
title: Multi-Instance Extensions
---

# Multi-Instance Extensions

> **Not executed by the current Engine.** You can draw and deploy Multi-Instance loops, but the Engine will not run them. Avoid them in executable processes for now.

These are extra settings for a Multi-Instance activity.

## Loop Break Condition

The `Loop Break Condition` is a [formula](help://bpmn/runtime_expressions) checked after each round. When it becomes true, the loop stops early.

## Loop Interval

The `Loop Interval` is a waiting time inserted between rounds that run one after another — for example `PT5S` for five seconds. Useful for going easy on an external system.

## Max Iterations

The `Max Iterations` field caps how many rounds can run, as a safety limit.
