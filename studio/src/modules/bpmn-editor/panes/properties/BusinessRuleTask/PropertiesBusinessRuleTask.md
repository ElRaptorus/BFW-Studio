---
# This is a comment, which might be helpful to explain the concept of help texts
title: Business Rule Task
---

# Business Rule Task

![Business Rule Task](BusinessRuleTask.svg)

The `Business Rule Task` allows you to make decisions based on a specific set of business rules. The engine supports two implementation modes, selected via the standard BPMN `implementation` attribute.

## Implementation Modes

### FEEL Expression (`implementation="feel"`)

The task evaluates an inline [FEEL expression](help://bpmn/runtime_expressions) stored in the `<bpmn:script>` child element. The expression receives the standard FEEL context bindings (`token`, `this`, `context`, `dataObjects`, `process`, `processInstance`, `identity`, and `loop` when applicable). The evaluated result becomes the activity output.

### DMN Decision (`implementation="dmn"`)

The task evaluates a deployed DMN decision model at runtime. The engine resolves the decision reference, evaluates the decision table (including DRG chaining when required), and returns the decision result.

## Settings

A `Business Rule Task` can be configured with the following properties:

### Implementation

Select **FEEL Expression** or **DMN Decision**. This sets the BPMN `implementation` attribute to `feel` or `dmn`.

### FEEL Script

Required when **FEEL Expression** is selected. A [FEEL expression](help://bpmn/runtime_expressions) evaluated by the engine when the task is reached.

### Decision Reference

Required when **DMN Decision** is selected. The ID of the deployed DMN decision model to evaluate (stored as `evil:decisionRef`).

### Decision Element ID

Optional. When the referenced DMN model contains multiple `<decision>` elements, specifies which decision element to evaluate as the DRG root. If omitted on a multi-decision model, the engine returns an ambiguous-decision error.

### Result Variable

Optional. The output variable name for the decision result.

### Trace Unmatched Rules

Optional. When enabled, the DMN evaluator includes full detail for unmatched rules in the execution trace (useful for debugging in the Studio).
