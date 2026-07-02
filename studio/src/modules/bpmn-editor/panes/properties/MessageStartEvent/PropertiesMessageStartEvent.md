---
title: Message Start Event
---

# Message Start Event

![Message Start Event](MessageStartEvent.svg)

A `Message Start Event` starts a new process when a matching message arrives. The message can be sent by another process in the same diagram or by a connected system. A process that begins this way can still also be started manually.

If several processes begin with a Message Start Event for the **same** message, all of them start when that message arrives.

## Configuration

- **`Message`** — the message this event waits for. Messages are named once in the diagram and shared by every element that sends or waits for them; they are matched by that name.
- **`Output Mappings`** — optionally copy values from the incoming message into your process data, so later steps can use them. See [Output Mappings](help://bpmn/properties/output_mappings).
- **`Result Contract`** — optionally describe the shape the incoming message must have. A message that does not fit is rejected. See [Result Contract](help://bpmn/properties/result_contract).
- **`Example Payload`** — a sample message you can define for testing and simulation. It does not affect the running process. See [Example Payload](help://bpmn/properties/example_payload).

## Reacting only to messages meant for one process

To start only from messages intended for a specific case (rather than every matching message), give the process a [Correlation Key](help://bpmn/properties/process). Without one, the event reacts to any message that carries the matching name.
