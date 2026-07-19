---
title: Input Collection
---

# Input Collection

The `Input Collection` is the list a Multi-Instance activity works through. Each item in the list produces one round.

## Usage

Provide a [formula](help://bpmn/runtime_expressions) that resolves to a list.

**Work through a list from the process data:**

```feel
token.items
```

**Filter before iterating:**

```feel
token.candidates[active = true]
```

## Element Variable

The **Element Variable** specifies the variable name bound to the current collection item in each iteration. Accessible as `loop.item` in FEEL expressions.

## Default (no Input Collection)

If no Input Collection is set, the activity uses the current process data. When that data is itself a list, each entry becomes one round's input.
