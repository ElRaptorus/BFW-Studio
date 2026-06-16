---
# This is a comment, which might be helpful to explain the concept of help texts
title: Message Boundary Event
---

# Message Boundary Event

![Message Boundary Event](MessageBoundaryEvent.svg)

The `Message Boundary Event` is a specialized [Boundary Event](help://bpmn/properties/boundary_event) that is triggered, when a `Message` with a matching name is received.

If the `Message Boundary Event` is modeled as an **interrupting** Event, the decorated `Activity` will be canceled when the `Message Boundary Event` is triggered.

It is possible to attach multiple `Message Boundary Events` to the same Activity, to implement different handlers for multiple `Messages`.

## Properties

The following properties can be configured:

### Name

The name of the `Message` that the `Message Boundary Event` should listen for.
