---
title: Business Rule Task
---

# Business Rule Task

![Business Rule Task](BusinessRuleTask.svg)

A `Business Rule Task` works out a decision automatically and continues with the result. Use it wherever a choice follows clear, repeatable rules — for example a discount tier, a risk rating, or an approval limit.

## Implementation

The `Implementation` field chooses how the decision is made:

- **FEEL Expression** — you write the rule directly as a [formula](help://bpmn/runtime_expressions) in the `FEEL Script` field. Its result becomes the task's output. Best for short, self-contained rules.
- **DMN Decision** — the task runs a separately maintained decision model (a decision table). Best for richer rule sets that are managed on their own and reused across processes.

## Settings for DMN Decision

- **`Decision Reference`** — the decision model to run. It must already be deployed to the system.
- **`Decision Element ID`** — only needed when a decision model contains more than one decision. It names which decision to run; without it, a multi-decision model cannot tell which one you mean.
- **`Result Variable`** — an optional name under which the decision result is stored.
- **`Trace Unmatched Rules`** — when on, the result also records the rules that did **not** apply. Handy when checking why a decision turned out the way it did.

## Data Pipeline

Like all activities, a Business Rule Task can shape the data it works with. See [Input Mappings](help://bpmn/properties/input_mappings), [Output Mappings](help://bpmn/properties/output_mappings), [Payload Contract](help://bpmn/properties/payload_contract), and [Result Contract](help://bpmn/properties/result_contract).
