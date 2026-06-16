---
# This is a comment, which might be helpful to explain the concept of help texts
title: Cancel End Event
---

# Cancel End Event

![Cancel End Event](CancelEndEvent.svg)

The `Cancel End Event` is a specialized [End Event](help://bpmn/properties/end_event) that is designed to `Cancel` a `Transaction Sub-Process`.
The `Cancel End Event` triggers a [Cancel Boundary Event](help://bpmn/properties/cancel_boundary_event) and emits the `Cancel Message` to any `Entity` that is involved in the Transaction.
