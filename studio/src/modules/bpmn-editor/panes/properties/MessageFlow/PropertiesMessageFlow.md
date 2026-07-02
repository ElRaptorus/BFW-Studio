---
title: Message Flow
---

# Message Flow

![Message Flow](MessageFlow.svg)

A `Message Flow` is a **diagram-level** connector in a Collaboration. It shows that a Message travels from one participant to another; it is a documentation aid and is not itself an executable step.

Its source should be a message-sending element — a [Send Task](help://bpmn/properties/send_task), a [Message End Event](help://bpmn/properties/message_end_event), a [Message Intermediate Throw Event](help://bpmn/properties/message_intermediate_throw_event), or a Participant. Its target should be a message-receiving element — a [Receive Task](help://bpmn/properties/receive_task), a [Message Start Event](help://bpmn/properties/message_start_event), a [Message Intermediate Catch Event](help://bpmn/properties/message_intermediate_catch_event), or a Participant.

At runtime, delivery is driven by the Message name and correlation on those message elements — not by the Message Flow line itself. See [Correlation Retrieval Expression](help://bpmn/properties/correlation_retrieval_expression) and the process [Correlation Key](help://bpmn/properties/process).
