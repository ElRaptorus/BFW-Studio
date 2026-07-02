---
title: Signal Start Event
---

# Signal Start Event

![Signal Start Event](SignalStartEvent.svg)

A `Signal Start Event` starts a new process whenever a matching signal is broadcast. A signal is like a public announcement: every element listening for it reacts. The signal can come from another process in the diagram or from a connected system, and the process can still also be started manually.

If several processes start on the **same** signal, all of them start when it is broadcast.

## Configuration

- **`Signal`** — the signal to listen for. Signals are named once in the diagram and matched by that name.

A signal is a pure notification and carries **no data**. To start a process _with_ data, use a [Message Start Event](help://bpmn/properties/message_start_event) instead.

## Shaping the data

Although the signal brings no data, you can still prepare the process data the new run begins with using [Output Mappings](help://bpmn/properties/output_mappings).
