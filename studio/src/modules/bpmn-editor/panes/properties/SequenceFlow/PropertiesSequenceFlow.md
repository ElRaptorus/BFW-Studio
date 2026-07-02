---
title: Sequence Flow
---

# Sequence Flow

![SequenceFlow](SequenceFlow.svg)

A `Sequence Flow` connects activities, events, and gateways, and defines the order in which they are executed.

## Conditions

A Sequence Flow can carry a [FEEL expression](help://bpmn/runtime_expressions) condition (see [Conditional Flow](help://bpmn/properties/conditional_flow)), but the Engine only honors that condition when the flow **leaves a split gateway** — an [Exclusive](help://bpmn/properties/exclusive_gateway), [Inclusive](help://bpmn/properties/inclusive_gateway), or [Complex](help://bpmn/properties/complex_gateway) Gateway.

On any other Sequence Flow (leaving an activity, an event, or a join gateway), a condition is **ignored** and the flow is always taken. Put your branching logic on the flows that come out of a split gateway.
