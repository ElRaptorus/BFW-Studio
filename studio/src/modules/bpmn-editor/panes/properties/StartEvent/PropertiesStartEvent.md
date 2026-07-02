---
title: Start Event
---

# Start Event

![StartEvent](StartEvent.svg)

The `Start Event` is where a process begins. It has no incoming flow and a single outgoing flow, and it sets the process running. A process can have several Start Events.

## Trigger types

A process can begin from a plain Start Event, or from one of these typed triggers:

- [Message Start Event](help://bpmn/properties/message_start_event) — starts when a matching Message arrives
- [Signal Start Event](help://bpmn/properties/signal_start_event) — starts when a matching Signal is broadcast
- [Timer Start Event](help://bpmn/properties/timer_start_event) — starts on a schedule

A [Conditional Start Event](help://bpmn/properties/conditional_start_event) can be modeled but is not started by the Engine at runtime. Error, Escalation, and Compensation triggers are not valid on a Start Event.
