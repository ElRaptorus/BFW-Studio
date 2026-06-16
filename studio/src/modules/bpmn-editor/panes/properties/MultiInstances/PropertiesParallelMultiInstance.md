---
# This is a comment, which might be helpful to explain the concept of help texts
title: Parallel Multi Instance
---

# Parallel Multi Instance

`Parallel Multi Instances` can be used to process a list of values in parallel.

## Configuration

Each instance is driven by an **Input Collection** — a [FEEL expression](help://bpmn/runtime_expressions) that resolves to a list — or by the current token payload when no Input Collection is specified. If the token payload is a list and no Input Collection is set, each list element becomes the input for one instance.

The `Parallel Multi Instance` processes each entry in parallel. Each iteration produces its own `Flow Node Instance`.

## Additional FEEL Context Bindings

Activities that use [FEEL expressions](help://bpmn/runtime_expressions) have access to the following additional bindings when run as a `Parallel Multi Instance`:

- `loop.index` — The 0-based index of the current iteration
- `loop.total` — The total number of values the `Parallel Multi Instance` will process
  - This is only a count and does **not** contain any actual values processed by the Activity

## Note on Data Objects

Reading from a Data Object can be done by each iteration.

However, _writing_ to a Data Object will only be performed once, _after_ all instances of the `Parallel Multi Instance` have finished.
