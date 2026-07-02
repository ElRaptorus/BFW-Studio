---
title: Intermediate Duration Timer Catch Event
---

# Intermediate Duration Timer Catch Event

An Intermediate Duration timer continues the flow after a delay. Set the `Type` to **Duration** and enter the delay in the `Definition` field.

The delay uses the ISO 8601 duration format, for example `P1Y2M4DT5H6M7S`. It always begins with `P`, each part is a number followed by a unit (`1Y` = one year), and `T` separates the date parts from the time parts.

- `Y` — years
- `M` (before `T`) — months
- `D` — days
- `T` — separates the date and time parts
- `H` — hours
- `M` (after `T`) — minutes
- `S` — seconds

For example, `PT5S` means five seconds and `P1D` means one day.

You can also enter a [formula](help://bpmn/runtime_expressions) that produces a duration.
