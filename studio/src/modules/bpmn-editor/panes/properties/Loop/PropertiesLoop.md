---
title: Loops
---

# Loops

A `Loop` marker repeats a single step while a condition holds.

## Configuration

### Loop Condition

The `Loop Condition` is a [formula](help://bpmn/runtime_expressions) that decides whether the loop keeps going.

Example:

```feel
loop.completed < 5
```

### Evaluation Mode

Controls whether the loop condition is evaluated before (While-Do) or after (Do-While) the first iteration.

- **While-Do** — the condition is checked before the first iteration runs. If it is already false, the activity is skipped entirely.
- **Do-While** — the activity runs at least once; the condition is checked after each iteration.

### Max Iterations

The `Max Iterations` field is an optional cap on how many times the step repeats. Leave it empty for no fixed limit.

### Loop Interval

ISO 8601 duration between iterations. Example: `PT30S` for 30 seconds between each loop iteration. Useful for polling or healthcheck patterns where you want a pause between repetitions.

## Values you can use in each iteration

Inside a looped activity, your formulas can use the `loop` values:

- `loop.completed` — the number of iterations completed so far
- `loop.results` — the results from the iterations completed so far

## Standard loops vs. Multi-Instance

A standard loop repeats the same activity one iteration at a time based on a condition. If instead you want to process each item of a list — in sequence or in parallel — use a [Multi-Instance](help://bpmn/properties/parallel-multi-instance) marker.
