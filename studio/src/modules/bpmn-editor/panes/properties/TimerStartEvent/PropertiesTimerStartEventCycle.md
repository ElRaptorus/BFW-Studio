---
title: Cyclic Timer Start Event
---

# Cyclic Timer Start Event

A Cyclic timer starts the process again and again on a schedule. Set the `Type` to **Cycle** and enter the schedule in the `Definition` field.

Use an ISO 8601 repeating interval:

- `R3/PT1H` — three times, once every hour
- `R/PT30M` — every 30 minutes, with no end
- `R5/P1D` — five times, once per day
- `R/2026-06-01T10:00:00Z/P1D` — starting on a specific date, then once per day with no end

The duration part (after the last `/`) uses the same format as the [Duration Timer Start Event](help://bpmn/properties/timer_start_event_duration). You can also enter a [formula](help://bpmn/runtime_expressions) that produces a repeating interval.
