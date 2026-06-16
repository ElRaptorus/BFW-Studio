---
# This is a comment, which might be helpful to explain the concept of help texts
title: Timer Start Event
---

# Timer Start Events

![Timer Start Event](TimerStartEvent.svg)

The `Timer Start Event` is a specialized [Start Event](help://bpmn/properties/start_event) that can be used to trigger or delay a process by use of a timer.

There are three types of `Timer Start Event`:

- [Cyclic Timer Start Event](help://bpmn/properties/timer_start_event_cycle) - Triggers the process repeatedly, based on a configured interval
- [Date Timer Start Event](help://bpmn/properties/timer_start_event_date) - Delays the start of the process, until the specified datetime has passed
- [Duration Timer Start Event](help://bpmn/properties/timer_start_event_duration) - Delays the start of the process for the specified amount of time

**Note:**
When enabled, a `Cyclic Timer Start Event` triggers automatically, whenever the specified interval has elapsed.
Unlike the `Date Timer Start Event` and `Duration Timer Start Event`, which have to be started manually.
