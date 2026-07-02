---
title: Timer Boundary Event
---

# Timer Boundary Event

![Timer Boundary Event](TimerBoundaryEvent.svg)

A `Timer Boundary Event` sits on the edge of an activity and fires after its timer elapses while that activity runs. Choose the timer `Type` — **Date**, **Duration**, or **Cycle** — and enter its value in the `Definition` field.

- [Date Timer Boundary Event](help://bpmn/properties/timer_boundary_event_date) — fires at a specific date and time
- [Duration Timer Boundary Event](help://bpmn/properties/timer_boundary_event_duration) — fires after a delay

If set to **non-interrupting**, the activity keeps running when the event fires.

## Repeating (cyclic) timer boundary

A Timer Boundary Event can also use a repeating **Cycle**. An **interrupting** cyclic boundary fires once and cancels the activity. A **non-interrupting** cyclic boundary fires again on each interval while the activity keeps running — useful for periodic reminders or escalations. Repeating intervals use the ISO 8601 form `R3/PT1H` (or `R/PT1H` for no end).
