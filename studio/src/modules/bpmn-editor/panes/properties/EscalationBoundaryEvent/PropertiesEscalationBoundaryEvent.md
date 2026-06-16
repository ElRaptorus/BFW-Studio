---
# This is a comment, which might be helpful to explain the concept of help texts
title: Escalation Boundary Event
---

# Escalation Boundary Event

![Escalation Boundary Event](EscalationBoundaryEvent.svg)

The `Escalation Boundary Event` is a specialized [Boundary Event](help://bpmn/properties/boundary_event) that is triggered when a specific `Escalation` is thrown.

If the `Escalation Boundary Event` is modeled as an **interrupting** Event, the decorated `Activity` will be canceled when the `Escalation Boundary Event` is triggered.

The `Escalation Event` only acts inside the process chain it's running in.

Thrown escalations can only be caught by **one** catching event.

Also an `Escalation Event` does not cancel the process it occurs in.

## Properties

The following properties can be configured:

### Escalation Code

The code of the `Escalation` that the `Escalation Boundary Event` should listen for.
If the `Escalation Boundary Event` isn't given an `escalation code` it will catch the first incoming escalation from the same process chain.
`Escalation Boundary Events` with a matching escalation code have priority over the unspecific ones.

### Escalation Name

A descriptive name for the event.
