---
title: Receive Task
---

# Receive Task

![Receive Task](ReceiveTask.svg)

A `Receive Task` waits for a message to arrive, then continues. It is the counterpart to a message-sending element such as a [Send Task](help://bpmn/properties/send_task), and is often used for communication between two processes. It behaves like a message catch event; the task shape is simply an alternative notation.

The process pauses at the task until a matching message arrives, then continues.

## Configuration

- **`Message`** — the message this task waits for. Messages are named once in the diagram and shared by every element that sends or waits for them; they are matched by that name.
- **`Output Mappings`** — optionally copy values from the incoming message into your process data, so later steps can use them. See [Output Mappings](help://bpmn/properties/output_mappings).
- **`Result Contract`** — optionally describe the shape the incoming message must have. A message that does not fit is rejected. See [Result Contract](help://bpmn/properties/result_contract).
- **`Example Payload`** — a sample message you can define for testing and simulation. It does not affect the running process. See [Example Payload](help://bpmn/properties/example_payload).

## Reacting only to messages meant for one case

To wait only for a message intended for a specific case (rather than any message with the matching name), give the process a [Correlation Key](help://bpmn/properties/process). Without one, the task reacts to the first matching message by name.
