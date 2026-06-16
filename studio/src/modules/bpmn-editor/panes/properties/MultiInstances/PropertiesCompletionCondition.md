---
title: Completion Condition
---

# Completion Condition

The **Completion Condition** is a boolean [FEEL expression](help://bpmn/runtime_expressions) evaluated after each instance of a Multi Instance activity completes. When the expression evaluates to `true`, all remaining instances are cancelled and the activity completes.

## Usage

Write a FEEL expression that evaluates to `true` when the Multi Instance should finish early.

### Examples

**Complete after 3 instances finish:**

```feel
loop.completed >= 3
```

**Complete when a specific result is found:**

```feel
token.result = "approved"
```

## Behavior

- Evaluated once after **each** instance completes.
- If omitted, all instances must complete before the activity finishes.
- When triggered, all **remaining** (not yet completed) instances are cancelled.

## Note

This property maps to the BPMN 2.0 `completionCondition` element within `multiInstanceLoopCharacteristics`.
