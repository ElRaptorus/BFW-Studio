---
title: Message End Event
---

# Message End Event

![Message End Event](MessageEndEvent.svg)

A `Message End Event` finishes the process and sends a message on the way out. Other processes can react to it with [Message Start Events](help://bpmn/properties/message_start_event), [Message Boundary Events](help://bpmn/properties/message_boundary_event), or [Message Intermediate Catch Events](help://bpmn/properties/message_intermediate_catch_event).

## Configuration

- **`Message`** — the message to send. Messages are named once in the diagram and matched by that name.
- **`Input Mappings`** — optionally build the data that travels with the message. See [Input Mappings](help://bpmn/properties/input_mappings).
- **`Payload Contract`** — optionally describe the shape the outgoing message must have. See [Payload Contract](help://bpmn/properties/payload_contract).
- **`Correlation Retrieval Expression`** — optionally address the message to one specific waiting process. See [Correlation Retrieval Expression](help://bpmn/properties/correlation_retrieval_expression).
- **`Example Payload`** — a sample message for testing and simulation. It does not affect the running process. See [Example Payload](help://bpmn/properties/example_payload).
