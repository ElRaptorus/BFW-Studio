---
title: Message Intermediate Throw Event
---

# Message Intermediate Throw Event

![Message Intermediate Throw Event](MessageIntermediateThrowEvent.svg)

A `Message Intermediate Throw Event` sends a message and immediately continues — it does not wait for anyone to receive it. It behaves like a [Send Task](help://bpmn/properties/send_task); the two are just different notations for the same thing.

## Configuration

- **`Message`** — the message to send. Messages are named once in the diagram and matched by that name.
- **`Input Mappings`** — optionally build the data that travels with the message. See [Input Mappings](help://bpmn/properties/input_mappings).
- **`Payload Contract`** — optionally describe the shape the outgoing message must have. See [Payload Contract](help://bpmn/properties/payload_contract).
- **`Correlation Retrieval Expression`** — optionally address the message to one specific waiting process. See [Correlation Retrieval Expression](help://bpmn/properties/correlation_retrieval_expression).
- **`Example Payload`** — a sample message for testing and simulation. It does not affect the running process. See [Example Payload](help://bpmn/properties/example_payload).

## Delivery

Any element that waits for this message — a message catch event or a [Receive Task](help://bpmn/properties/receive_task) — can pick it up. If you set a correlation value, the message is delivered to the matching case; otherwise every waiting element with the matching name receives it.
