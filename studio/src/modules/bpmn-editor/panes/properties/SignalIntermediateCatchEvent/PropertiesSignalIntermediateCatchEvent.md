---
title: Signal Intermediate Catch Event
---

# Signal Intermediate Catch Event

![Signal Intermediate Catch Event](SignalIntermediateCatchEvent.svg)

A `Signal Intermediate Catch Event` pauses the flow until a matching signal is broadcast. A signal reaches every element listening for it at once.

## Configuration

- **`Signal`** — the signal to listen for. Signals are named once in the diagram and matched by that name.

A signal carries **no data**, so nothing is added to your process when it arrives. If you need to receive data, use a [Message Intermediate Catch Event](help://bpmn/properties/message_intermediate_catch_event) instead.

## Shaping the data

Although the signal brings no data, you can still tidy up the process data that continues after this event using [Output Mappings](help://bpmn/properties/output_mappings).
