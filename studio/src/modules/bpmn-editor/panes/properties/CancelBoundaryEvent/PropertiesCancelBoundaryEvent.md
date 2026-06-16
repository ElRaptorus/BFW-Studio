---
# This is a comment, which might be helpful to explain the concept of help texts
title: Cancel Boundary Event
---

# Cancel Boundary Event

![Cancel Boundary Event](CancelBoundaryEvent.svg)

The `Cancel Boundary Event` is a specialized [Boundary Event](help://bpmn/properties/boundary_event) that is triggered if a `Cancel Event` is triggered in the `Transaction Sub-Process`.
The `Transaction Sub-Process` throws the `Cancel Event` if the [Cancel End Event](help://bpmn/properties/cancel_end_event) is reached or a `Cancel Message` is received during the execution.
