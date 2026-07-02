---
title: Inclusive Gateway
---

# Inclusive Gateway

![Inclusive Gateway](InclusiveGateway.svg)

The `Inclusive Gateway` can activate one, several, or all of its outgoing paths at once. It sits between the [Exclusive Gateway](help://bpmn/properties/exclusive_gateway) (exactly one path) and the [Parallel Gateway](help://bpmn/properties/parallel_gateway) (always all paths).

## Splitting

The gateway checks the [condition](help://bpmn/runtime_expressions) on **every** outgoing [Conditional Flow](help://bpmn/properties/conditional_flow) and follows each path whose condition is true. An outgoing flow **without** a condition is always taken.

- If none of the conditions are true, the [Default Flow](help://bpmn/properties/default_flow) is taken instead.
- If none are true and there is no default (and no unconditional flow), the process stops with an error — so always model a default as a safety net.

## Merging

As a merge, the Inclusive Gateway waits for exactly the branches that were actually activated upstream, then continues.
