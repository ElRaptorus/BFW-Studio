---
# This is a comment, which might be helpful to explain the concept of help texts
title: Signal Boundary Event
---

# Signal Boundary Event

![Signal Boundary Event](SignalBoundaryEvent.svg)

The `Signal Boundary Event` is a specialized [Boundary Event](help://bpmn/properties/boundary_event) that is triggered, when a `Signal` with a matching name is received.

If the `Signal Boundary Event` is modeled as an **interrupting** Event, the decorated `Activity` will be canceled when the `Signal Boundary Event` is triggered.

It is possible to attach multiple `Signal Boundary Events` to the same Activity, to implement different handlers for multiple `Signals`.

## Properties

The following properties can be configured:

### Name

The name of the `Signal` that the `Signal Boundary Event` should listen for.
