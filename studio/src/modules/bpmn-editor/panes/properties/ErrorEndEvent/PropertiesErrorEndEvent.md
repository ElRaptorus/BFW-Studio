---
# This is a comment, which might be helpful to explain the concept of help texts
title: Error End Event
---

# Error End Event

![Error End Event](ErrorEndEvent.svg)

The `Error End Event` is a specialized [End Event](help://bpmn/properties/end_event) that is used for throwing a named `Error`.

It is usually used by Subprocesses or Processes that are designed to be started by a `Call Activity`.

The enclosing parent can use an [Error Boundary Event](help://bpmn/properties/error_boundary_event) to catch the error thrown by the `Error End Event`.
