---
title: Conditional Flow
---

# Conditional Flow

![ConditionalFlow](ConditionalFlow.svg)

A `Conditional Flow` is a [Sequence Flow](help://bpmn/properties/sequence_flow) that carries a `Condition` — a [formula](help://bpmn/runtime_expressions) that must result in `true` or `false`.

The condition is only checked when the flow **leaves a split gateway**: an [Exclusive](help://bpmn/properties/exclusive_gateway), [Inclusive](help://bpmn/properties/inclusive_gateway), or [Complex](help://bpmn/properties/complex_gateway) Gateway. A condition on a flow that leaves anything else (an activity, an event, or a join gateway) is **ignored**, and the flow is always taken.

Pair Conditional Flows with a [Default Flow](help://bpmn/properties/default_flow) on the same gateway so there is always a path to take when no condition matches.

Example condition:

```feel
token.amount > 1000
```
