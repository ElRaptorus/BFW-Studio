---
# This is a comment, which might be helpful to explain the concept of help texts
title: Escalation End Event
---

# Escalation End Event

![Escalation End Event](EscalationEndEvent.svg)

The `Escalation End Event` is a specialized [End Event](help://bpmn/properties/end_event) that indicates that an `Escalation` should be triggered.

It is usually used by Subprocesses or processes that are designed to be started by a Call Activity.

The enclosing parent can use an [Escalation Boundary Event](help://bpmn/properties/escalation_boundary_event) to catch the `Escalation` thrown by the `Escalation End Event`.

It is important to note that an Escalation will be passed back up through the process chain, until it reaches the _first_ [Escalation Boundary Event](help://bpmn/properties/escalation_boundary_event) capable of handling it.

This means that each escalation will only ever be handled by a _single_ Escalation Boundary Event.

## Properties

The following properties can be configured:

### Escalation Code

The code of the `Escalation` that shall be caught by a catching escalation event.

### Escalation Name

A descriptive name for the event.
