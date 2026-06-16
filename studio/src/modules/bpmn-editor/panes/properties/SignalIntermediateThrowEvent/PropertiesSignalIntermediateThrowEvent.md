---
# This is a comment, which might be helpful to explain the concept of help texts
title: Signal Intermediate Throw Event
---

# Signal Intermediate Throw Event

![Signal Intermediate Throw Event](SignalIntermediateThrowEvent.svg)

The `Signal Intermediate Throw Event` is a specialized [Intermediate Event](help://bpmn/properties/intermediate_event) that broadcasts a specific `Signal` to all listening Processes when it is triggered.
The `Process` will not pause the flow while the `Signal Intermediate Throw Event` sends the `Signal`.

Signals carry **no payload** — they are pure broadcast notifications. The current `token` is not transmitted with the signal. If you need to send data to another process, use a [Message Intermediate Throw Event](help://bpmn/properties/message_intermediate_throw_event) instead.
