---
title: Output Collection
---

# Output Collection

The **Output Collection** defines how the results of individual Multi Instance activity instances are collected into a single output list.

## Usage

Provide a [FEEL expression](help://bpmn/runtime_expressions) that maps each instance's result into the output collection.

### Examples

**Collect the result of each instance:**

```feel
token.result
```

**Transform each result:**

```feel
{ id: token.id, status: token.status }
```

## Behavior

- Evaluated once per completed instance.
- The individual results are gathered into an ordered list that becomes the activity's output.
- The ordering matches the input collection order (for sequential instances) or the completion order (for parallel instances, unless re-ordered by the engine).

## Default (no Output Collection)

If no Output Collection is specified, the collected output from all instances is used as-is as the activity's result. The raw result list is written into the activity's output and forwarded to all connected data output associations.

## Note

This property maps to the BPMN 2.0 `outputDataItem` on `multiInstanceLoopCharacteristics`.
