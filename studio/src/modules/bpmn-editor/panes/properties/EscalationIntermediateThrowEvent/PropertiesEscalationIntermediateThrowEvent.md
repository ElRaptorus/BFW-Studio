---
# This is a comment, which might be helpful to explain the concept of help texts
title: Escalation Intermediate Throw Event
---

# Escalation Intermediate Throw Event

![Escalation Intermediate Throw Event](EscalationIntermediateThrowEvent.svg)

The `Escalation Intermediate Throw Event` is a specialized [Intermediate Event](help://bpmn/properties/intermediate_event) that raises an `Escalation` while the normal flow of the process proceeds.

It is usually used by Subprocesses or processes that are designed to be started by a Call Activity.

The enclosing parent can use an [Escalation Boundary Event](help://bpmn/properties/escalation_boundary_event) to catch the `Escalation` thrown by the `Escalation Intermediate Throw Event`.

It is important to note that an Escalation will be passed back up through the process chain, until it reaches the _first_ [Escalation Boundary Event](help://bpmn/properties/escalation_boundary_event) capable of handling it.

This means that each escalation will only ever be handled by a _single_ Escalation Boundary Event.

## Properties

The following properties can be configured:

### Escalation Code

The code of the `Escalation` that shall be caught by a catching escalation event.

### Escalation Name

A descriptive name for the event.
