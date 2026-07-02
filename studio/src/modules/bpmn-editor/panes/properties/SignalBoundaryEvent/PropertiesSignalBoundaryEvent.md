---
title: Signal Boundary Event
---

# Signal Boundary Event

![Signal Boundary Event](SignalBoundaryEvent.svg)

A `Signal Boundary Event` sits on the edge of an activity and waits for a matching signal while that activity runs.

- **Interrupting** (solid border): the activity is cancelled when the signal arrives, and the flow continues from the boundary event.
- **Non-interrupting** (dashed border): the activity keeps running and an additional path starts alongside it.

You can attach several Signal Boundary Events to one activity.

## Configuration

- **`Signal`** — the signal to listen for. Signals are named once in the diagram and matched by that name.

A signal carries **no data**. To receive data alongside the trigger, use a [Message Boundary Event](help://bpmn/properties/message_boundary_event) instead.

## Shaping the data

Although the signal brings no data, you can still tidy up the process data that continues from the boundary using [Output Mappings](help://bpmn/properties/output_mappings).
