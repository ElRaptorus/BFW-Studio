---
title: Event Based Gateway
---

# Event Based Gateway

![Event Based Gateway](EventBasedGateway.svg)

The `Event Based Gateway` is a **diverging** branching point where the path taken is decided by **whichever event happens first**, rather than by data conditions. It models a race between several waiting events.

When the flow reaches the gateway, it starts watching every outgoing branch at once and waits. The **first** branch to occur wins: its path continues and all the other waiting branches are cancelled.

## Allowed successors

Each outgoing [Sequence Flow](help://bpmn/properties/sequence_flow) must lead directly to a waiting element:

- a [Message Intermediate Catch Event](help://bpmn/properties/message_intermediate_catch_event)
- a [Timer Intermediate Event](help://bpmn/properties/timer_intermediate_event)
- a [Signal Intermediate Catch Event](help://bpmn/properties/signal_intermediate_catch_event)
- a [Conditional Intermediate Catch Event](help://bpmn/properties/conditional_intermediate_catch_event)
- a [Receive Task](help://bpmn/properties/receive_task)

A [Receive Task](help://bpmn/properties/receive_task) that follows an Event Based Gateway must not carry Boundary Events.

The gateway is diverging only — it never merges branches back together.
