---
title: Conditional Start Event
---

# Conditional Start Event

![Conditional Start Event](ConditionalStartEvent.svg)

> **Not executed by the current Engine.** A Conditional trigger is accepted on a Start Event when the model is deployed, but the Engine will not start a process from it at runtime. Avoid it as a process start trigger for now.

The `Conditional Start Event` is a specialized [Start Event](help://bpmn/properties/start_event) intended to start a process when a [FEEL](help://bpmn/runtime_expressions) `condition` becomes true.

To react to a condition **during** a process instead, use a [Conditional Intermediate Catch Event](help://bpmn/properties/conditional_intermediate_catch_event) or a [Conditional Boundary Event](help://bpmn/properties/conditional_boundary_event) — both are executed by the Engine.
