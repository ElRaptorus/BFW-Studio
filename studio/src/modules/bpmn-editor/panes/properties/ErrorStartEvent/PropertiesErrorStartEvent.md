---
title: Error Start Event
---

# Error Start Event

![Error Start Event](ErrorStartEvent.svg)

> **Not executed by the current Engine.** You can draw and deploy this element, but the Engine will not run it. Avoid it in executable processes for now.

An `Error Start Event` is meant to start an Event Subprocess in reaction to an `Error` raised elsewhere in the process. The current Engine does not run Event Subprocesses, and a top-level [Start Event](help://bpmn/properties/start_event) only accepts plain, Message, Signal, Timer, or Conditional triggers — so an Error trigger on a Start Event will not execute.

To react to an error today, catch it with an [Error Boundary Event](help://bpmn/properties/error_boundary_event) on the Activity (or Call Activity) that can raise it.
