---
# This is a comment, which might be helpful to explain the concept of help texts
title: Signal End Event
---

# Signal End Event

The `Signal End Event` is a specialized [End Event](help://bpmn/properties/end_event) that broadcasts a `Signal` at the end of the `Process`.

Other Processes can listen for this `Signal` with [Signal Start Events](help://bpmn/properties/signal_start_event), [Signal Boundary Events](help://bpmn/properties/signal_boundary_event) or [Intermediate Signal Catch Events](help://bpmn/properties/signal_intermediate_catch_event).

Signals carry **no payload** — they are pure broadcast notifications. The current `token` is not transmitted with the signal. If you need to send data to another process, use a [Message End Event](help://bpmn/properties/message_end_event) instead.
