---
# This is a comment, which might be helpful to explain the concept of help texts
title: End Event
---

# End Event

![EndEvent](EndEvent.svg)

The `End Event` marks where a path through the process ends.

A process can have several End Events for its different outcomes. Each path that reaches one ends there; the whole process finishes once all of its active paths have ended.

There are several types of End Events:

## Untyped End Event

Finishes the Process normally.

## Message End Event

Finishes the Process with a success result and sends a specific `Message`.

See also: ([MessageEndEvent](help://bpmn/properties/message_end_event)).

## Signal End Event

Finishes the Process with a success result and sends a specific `Signal`.

See also: ([SignalEndEvent](help://bpmn/properties/signal_end_event)).

## Error End Event

Usually used by `Subprocesses` or Proceses that are meant to be started by `Call Activities`.

Ends the Process with an Error result, which the parent Process can react to with a matching `Error Boundary Event`.

See also: ([ErrorEndEvent](help://bpmn/properties/error_end_event)).

## Termination End Event

Immediately stops the whole process, including any other paths that are still running in parallel.

This is useful for processes that split into several parallel paths with `Parallel Gateways`.

See also: [Termination End Event](help://bpmn/properties/terminate_end_event).

## Escalation End Event

Finishes the Process and raises an `Escalation` that a parent process can react to with a matching [Escalation Boundary Event](help://bpmn/properties/escalation_boundary_event).

See also: ([EscalationEndEvent](help://bpmn/properties/escalation_end_event))

## Compensation End Event

> **Not executed by the current Engine.** You can draw and deploy this element, but the Engine will not run it. Avoid it in executable processes for now.

Finishes the Process and triggers `Compensation` for all previous Tasks with a [Compensation Boundary Event](help://bpmn/properties/compensation_boundary_event).

See also: ([CompensationEndEvent](help://bpmn/properties/compensation_end_event)).
