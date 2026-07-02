---
title: Send Task
---

# Send Task

![Send Task](SendTask.svg)

A `Send Task` sends a message and immediately continues. It is **fire-and-forget**: it never waits for anyone to receive the message. It behaves like a [Message Intermediate Throw Event](help://bpmn/properties/message_intermediate_throw_event); the task shape is simply an alternative notation.

## Configuration

- **`Message`** — the message to send. Messages are named once in the diagram and matched by that name.
- **`Input Mappings`** — optionally build the data that travels with the message. See [Input Mappings](help://bpmn/properties/input_mappings).
- **`Payload Contract`** — optionally describe the shape the outgoing message must have. See [Payload Contract](help://bpmn/properties/payload_contract).
- **`Correlation Retrieval Expression`** — optionally address the message to one specific waiting process. See [Correlation Retrieval Expression](help://bpmn/properties/correlation_retrieval_expression).
- **`Example Payload`** — a sample message for testing and simulation. It does not affect the running process. See [Example Payload](help://bpmn/properties/example_payload).

## Delivery

Any element that waits for this message — a message catch event or a [Receive Task](help://bpmn/properties/receive_task) — can pick it up, but the Send Task never blocks on that.
