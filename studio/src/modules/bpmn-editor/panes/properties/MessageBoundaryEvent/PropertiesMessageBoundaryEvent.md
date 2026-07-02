---
title: Message Boundary Event
---

# Message Boundary Event

![Message Boundary Event](MessageBoundaryEvent.svg)

A `Message Boundary Event` sits on the edge of an activity and waits for a matching message while that activity runs.

- **Interrupting** (solid border): the activity is cancelled when the message arrives, and the flow continues from the boundary event.
- **Non-interrupting** (dashed border): the activity keeps running and an additional path starts alongside it.

You can attach several Message Boundary Events to one activity to react to different messages.

## Configuration

- **`Message`** — the message this event waits for. Messages are named once in the diagram and matched by that name.
- **`Output Mappings`** — optionally copy values from the incoming message into your process data. See [Output Mappings](help://bpmn/properties/output_mappings).
- **`Result Contract`** — optionally describe the shape the incoming message must have. A message that does not fit is rejected. See [Result Contract](help://bpmn/properties/result_contract).
- **`Example Payload`** — a sample message for testing and simulation. It does not affect the running process. See [Example Payload](help://bpmn/properties/example_payload).

## Waiting for a message meant for this case

By default the event accepts any message with the matching name. To wait only for a message intended for this specific running process, give the process a [Correlation Key](help://bpmn/properties/process). The sender then marks its message with a matching value (see [Correlation Retrieval Expression](help://bpmn/properties/correlation_retrieval_expression)).
