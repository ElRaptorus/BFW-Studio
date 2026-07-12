---
title: Boundary Event
---

# Boundary Event

![Boundary Event](BoundaryEvent.svg)

A `Boundary Event` is attached to the edge of an Activity and waits for something to happen **while that Activity runs**. When it fires, the flow continues along the path leaving the Boundary Event.

## Interrupting vs. non-interrupting

- **Interrupting** (solid border): the attached Activity is cancelled when the event fires.
- **Non-interrupting** (dashed border): the Activity keeps running and the event starts an additional, parallel path.

## Boundary Event types executed by the Engine

- [Message Boundary Event](help://bpmn/properties/message_boundary_event)
- [Signal Boundary Event](help://bpmn/properties/signal_boundary_event)
- [Timer Boundary Event](help://bpmn/properties/timer_boundary_event)
- [Error Boundary Event](help://bpmn/properties/error_boundary_event) (interrupting only)
- [Escalation Boundary Event](help://bpmn/properties/escalation_boundary_event)
- [Conditional Boundary Event](help://bpmn/properties/conditional_boundary_event)
- [Compensation Boundary Event](help://bpmn/properties/compensation_boundary_event) (always non-interrupting)
- [Cancel Boundary Event](help://bpmn/properties/cancel_boundary_event) (always interrupting; attached to a Transaction subprocess only)
