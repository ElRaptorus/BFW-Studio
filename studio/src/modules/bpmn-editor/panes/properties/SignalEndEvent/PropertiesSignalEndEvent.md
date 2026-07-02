---
title: Signal End Event
---

# Signal End Event

A `Signal End Event` finishes the process and broadcasts a signal on the way out. Other processes can react with [Signal Start Events](help://bpmn/properties/signal_start_event), [Signal Boundary Events](help://bpmn/properties/signal_boundary_event), or [Signal Intermediate Catch Events](help://bpmn/properties/signal_intermediate_catch_event).

## Configuration

- **`Signal`** — the signal to broadcast. Signals are named once in the diagram and matched by that name.

A signal carries **no data** — it is a pure announcement. To send data to another process, use a [Message End Event](help://bpmn/properties/message_end_event) instead.

## Shaping the data

Although the signal carries no data, you can still tidy up the final process data using [Input Mappings](help://bpmn/properties/input_mappings).
