---
title: Escalation Start Event
---

# Escalation Start Event

![Escalation Start Event](EscalationStartEvent.svg)

> **Not executed by the current Engine.** You can draw and deploy this element, but the Engine will not run it. Avoid it in executable processes for now.

An `Escalation Start Event` is meant to start an Event Subprocess in reaction to an `Escalation`. The current Engine does not run Event Subprocesses, and a top-level [Start Event](help://bpmn/properties/start_event) only accepts plain, Message, Signal, Timer, or Conditional triggers — so an Escalation trigger on a Start Event will not execute.

To react to an escalation today, use an [Escalation Boundary Event](help://bpmn/properties/escalation_boundary_event) on the activity that raises it.
