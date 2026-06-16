---
# This is a comment, which might be helpful to explain the concept of help texts
title: Inclusive Gateway
---

# Inclusive Gateway

![Inclusive Gateway](InclusiveGateway.svg)

The `Inclusive Gateway` is used to create both alternative and parallel paths within a process flow.
This differs from both the `Exclusive Gateway`, which only routes through one path based on the first condition that evaluates to true,
and the `Parallel Gateway`, which doesn't evaluate conditions and activates all outgoing flows simultaneously.
The `Inclusive Gateway` assesses all condition `Expression`s for each connected flow, allowing for one, some, or all paths to be activated.
If no conditions are met, the process will terminate and result in a runtime error.
To mitigate this, it's best practice to set up a [Default Flow](help://bpmn/properties/default_flow).
