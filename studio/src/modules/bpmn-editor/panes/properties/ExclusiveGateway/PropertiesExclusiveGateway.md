---
title: Exclusive Gateway
---

# Exclusive Gateway

![ExclusiveGateway](ExclusiveGateway.svg)

![Gateway](Gateway.svg)

The `Exclusive Gateway` (also called XOR Gateway) routes the flow down **exactly one** path. A single gateway can both split and merge; the routing logic applies when it **splits**.

## Splitting

Each outgoing [Conditional Flow](help://bpmn/properties/conditional_flow) carries a [condition](help://bpmn/runtime_expressions). Exactly one of them should be true:

- If **one** condition is true, its path is taken.
- If **several** are true at once, the choice is ambiguous and the process stops with an error — design the conditions so only one can be true at a time.
- If **none** is true, the [Default Flow](help://bpmn/properties/default_flow) is taken. Without a default, the process stops with an error.

## Merging

When used as a merge, the Exclusive Gateway lets each incoming path pass straight through — it does not wait for the others.
