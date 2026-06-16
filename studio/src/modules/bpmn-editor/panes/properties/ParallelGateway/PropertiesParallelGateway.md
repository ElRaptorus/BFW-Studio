---
# This is a comment, which might be helpful to explain the concept of help texts
title: Parallel Gateway
---

# Parallel Gateway

![Parallel Gateway](ParallelGateway.svg)

The `Parallel Gateway` is a specific `Gateway` to create and combine multiple parallel `Flows` in a `Process`.
The `Parallel Gateway` creates paths without checking any condition.
Each outgoing [Sequence Flow](help://bpmn/properties/sequence_flow) receives a token from the `Gateway`.
For incoming `Flows` the `Parallel Gateway` waits until all incoming `Flows` arrive, before it is triggering its outgoing [Sequence Flow](help://bpmn/properties/sequence_flow).
