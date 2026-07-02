---
title: Output Collection
---

# Output Collection

> **Not executed by the current Engine.** You can draw and deploy Multi-Instance loops, but the Engine will not run them. Avoid them in executable processes for now.

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

## Default (no Output Collection)

If no Output Collection is set, the combined results of all rounds are used as the activity's output as-is.
