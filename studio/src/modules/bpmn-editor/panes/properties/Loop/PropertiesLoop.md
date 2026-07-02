---
title: Loops
---

# Loops

> **Not executed by the current Engine.** You can draw and deploy a standard loop, but the Engine will not run it. To repeat work in an executable process, build the loop explicitly with a gateway and a Sequence Flow that leads back to the activity.

A `Loop` marker repeats a single step while a condition holds. It is configured with two fields.

## Configuration

### Loop Condition

The `Loop Condition` is a [formula](help://bpmn/runtime_expressions) that decides whether the loop keeps going.

Example:

```feel
token.result < 5
```

### Max Iterations

The `Max Iterations` field is an optional cap on how many times the step repeats. Leave it empty for no fixed limit.

## Standard loops vs. Multi-Instance

A standard loop repeats the same activity one iteration at a time based on a condition. If instead you want to process each item of a list — in sequence or in parallel — use a [Multi-Instance](help://bpmn/properties/parallel-multi-instance) marker.
