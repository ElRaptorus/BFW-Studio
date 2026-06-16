---
# This is a comment, which might be helpful to explain the concept of help texts
title: Timer Boundary Event
---

# Timer Boundary Events

![Timer Boundary Event](TimerBoundaryEvent.svg)

The `Timer Boundary Event` is a specialized [Boundary Event](help://bpmn/properties/boundary_event) that triggers, after the specified timer has expired.

There are two types of Timer Boundary Events:

- [Date Timer Boundary Events](help://bpmn/properties/timer_boundary_event_date)
- [Duration Timer Boundary Events](help://bpmn/properties/timer_boundary_event_duration).

If the `Timer Boundary Event` is set to **non-interrupting**, the decorated `Activity` will not be canceled by the Boundary Event.
