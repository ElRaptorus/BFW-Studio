---
# This is a comment, which might be helpful to explain the concept of help texts
title: End Event
---

# End Event

![EndEvent](EndEvent.svg)

The `End Event` is the last element in a Process and indicates its end.

When the Process arrives at the End Event, the Process Instance is finished.
It is possible to define multiple End Events in one Process. However, only _one_ End Event may ever be reached for each Process Instance.

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

Immediately stops the Process Instance and all its Flow Node Instances.

This is useful for Processes that make use of `Parallel Gateways`.

See also: [Termination End Event](help://bpmn/properties/terminate_end_event).

## Escalation End Event

**Currently not supported by the engine**.

Finishes the Process with a success result and triggers an `Escalation` Event.

See also: ([EscalationEndEvent](help://bpmn/properties/escalation_end_event))

## Compensation End Event

**Currently not supported by the engine**.

Finishes the Process and triggers `Compensation` for all previous Tasks with a [Compensation Boundary Event](help://bpmn/properties/compensation_boundary_event).

See also: ([CompensationEndEvent](help://bpmn/properties/compensation_end_event)).
