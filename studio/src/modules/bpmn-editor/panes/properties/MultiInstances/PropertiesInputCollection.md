---
title: Input Collection
---

# Input Collection

The **Input Collection** defines the data source that a Multi Instance activity iterates over. Each item in the collection produces one instance of the activity.

## Usage

Provide a [FEEL expression](help://bpmn/runtime_expressions) that resolves to a list. Each element of the list becomes the input for one instance.

### Examples

**Iterate over a token list:**

```feel
token.items
```

**Filter before iterating:**

```feel
token.candidates[active = true]
```

## Behavior

- Each instance receives the corresponding list element as its input data item.
- The number of instances equals the length of the resolved list, unless overridden by `Instance Count`.
- If the expression resolves to an empty list, no instances are created and the activity completes immediately.

## Default (no Input Collection)

If no Input Collection is specified, the activity uses the **current token payload** directly. If the token payload is a list, it is treated as the collection — each list element becomes the input for one instance, and the number of instances equals the list length (unless overridden by `Instance Count`). If the token payload is not a list, the number of instances is determined solely by `Instance Count`, and every instance receives the same (non-list) payload.

## Note

This property maps to the BPMN 2.0 `inputDataItem` on `multiInstanceLoopCharacteristics`.
