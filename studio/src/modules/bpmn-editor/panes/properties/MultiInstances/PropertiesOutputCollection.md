---
title: Output Collection
---

# Output Collection

The `Output Collection` gathers the result of each round into a single list.

## Usage

Provide a [formula](help://bpmn/runtime_expressions) that says what to keep from each round's result.

**Collect each round's result:**

```feel
token.result
```

**Transform each result:**

```feel
{ id: token.id, status: token.status }
```

## Output Element Variable

The **Output Element Variable** specifies the variable name used to collect each iteration's output into the output collection.

## Default (no Output Collection)

If no Output Collection is set, the combined results of all rounds are used as the activity's output as-is.
