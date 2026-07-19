---
title: Completion Condition
---

# Completion Condition

The `Completion Condition` is a yes/no [formula](help://bpmn/runtime_expressions) checked after each round of a Multi-Instance activity finishes. When it becomes true, the remaining rounds are cancelled and the activity finishes early.

## Usage

Write a formula that becomes true when the activity should stop early.

**Complete once a result is approved:**

```feel
token.result = "approved"
```

If omitted, all instances run to completion before the activity finishes.
