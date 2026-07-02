---
title: Event Subprocess
---

# Event Subprocess

![Event Subprocess](EventSubprocess.svg)

> **Not executed by the current Engine.** You can draw and deploy an Event Subprocess, but the Engine will not run it. Avoid it in executable processes for now.

An `Event Subprocess` is an embedded [Subprocess](help://bpmn/properties/subprocess) that runs in reaction to an event rather than as part of the normal flow. It has no incoming or outgoing Sequence Flows and is triggered by its single Start Event.

## Alternative today

To react to events during an activity in an executable process, attach a **Boundary Event** to that activity instead:

- [Error Boundary Event](help://bpmn/properties/error_boundary_event)
- [Message Boundary Event](help://bpmn/properties/message_boundary_event)
- [Signal Boundary Event](help://bpmn/properties/signal_boundary_event)
- [Timer Boundary Event](help://bpmn/properties/timer_boundary_event)
- [Conditional Boundary Event](help://bpmn/properties/conditional_boundary_event)
- [Escalation Boundary Event](help://bpmn/properties/escalation_boundary_event)
