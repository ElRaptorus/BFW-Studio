---
title: Default Flow
---

# Default Flow

![Default Flow](DefaultFlow.svg)

The `Default Flow` is a specialized [Sequence Flow](help://bpmn/properties/sequence_flow) that is taken when **none** of the sibling [Conditional Flows](help://bpmn/properties/conditional_flow) evaluates to true.

A Default Flow only has an effect on the outgoing flows of a **split gateway** — an [Exclusive](help://bpmn/properties/exclusive_gateway), [Inclusive](help://bpmn/properties/inclusive_gateway), or [Complex](help://bpmn/properties/complex_gateway) Gateway. It is the safety net that guarantees the split always has a path to take.

- On an **Exclusive Gateway**, the Default Flow is taken when no condition matches.
- On an **Inclusive Gateway**, the Default Flow is taken only when no other condition is true.
- On a **Complex Gateway** split, every non-default flow must be conditional, and the Default Flow is taken when none of them match.

Conditions placed on flows that do **not** originate from a split gateway are ignored by the Engine, so a Default Flow there has no meaning.
