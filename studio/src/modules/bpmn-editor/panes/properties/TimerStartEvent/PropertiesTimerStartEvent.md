---
title: Timer Start Event
---

# Timer Start Event

![Timer Start Event](TimerStartEvent.svg)

A `Timer Start Event` starts a process based on time. Choose the timer `Type` — **Date**, **Duration**, or **Cycle** — and enter its value in the `Definition` field.

- [Cyclic Timer Start Event](help://bpmn/properties/timer_start_event_cycle) — starts the process again and again on a recurring schedule
- [Date Timer Start Event](help://bpmn/properties/timer_start_event_date) — starts the process once, at a specific date and time
- [Duration Timer Start Event](help://bpmn/properties/timer_start_event_duration) — starts the process once, after a delay

A cyclic Timer Start Event starts the process automatically each time its interval elapses, as long as it is enabled.
