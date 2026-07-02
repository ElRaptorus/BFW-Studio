---
title: Input Collection
---

# Input Collection

> **Not executed by the current Engine.** You can draw and deploy Multi-Instance loops, but the Engine will not run them. Avoid them in executable processes for now.

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

## Default (no Input Collection)

If no Input Collection is set, the activity uses the current process data. When that data is itself a list, each entry becomes one round's input; otherwise the number of rounds is set by the [Instance Count](help://bpmn/properties/multi_instance_count).
