---
title: Signal Intermediate Throw Event
---

# Signal Intermediate Throw Event

![Signal Intermediate Throw Event](SignalIntermediateThrowEvent.svg)

A `Signal Intermediate Throw Event` broadcasts a signal to every listening process and immediately continues — it does not pause the flow.

## Configuration

- **`Signal`** — the signal to broadcast. Signals are named once in the diagram and matched by that name.

A signal carries **no data** — it is a pure announcement. To send data to another process, use a [Message Intermediate Throw Event](help://bpmn/properties/message_intermediate_throw_event) instead.

## Shaping the data

Although the signal carries no data, you can still tidy up the process data passing through this element using [Input Mappings](help://bpmn/properties/input_mappings).
