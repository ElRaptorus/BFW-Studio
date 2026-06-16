---
# This is a comment, which might be helpful to explain the concept of help texts
title: Sequential Multi Instance
---

# Sequential Multi Instance

`Sequential Multi Instances` can be used to process a list of values in sequence.

## Configuration

Each instance is driven by an **Input Collection** — a [FEEL expression](help://bpmn/runtime_expressions) that resolves to a list — or by the current token payload when no Input Collection is specified. If the token payload is a list and no Input Collection is set, each list element becomes the input for one instance.

The `Sequential Multi Instance` processes each entry in sequence. Each iteration produces its own `Flow Node Instance`.

### Loop Interval

If you have `Sequential Multi Instances` with potentially high performance impact, you might want to use a delay between iterations, to take the pressure off the engine or an external API.

Set **Loop Interval** to an ISO 8601 duration (for example `PT1S` for one second). The value is stored as `evil:loopInterval`.

Default is no delay between iterations.

## Additional FEEL Context Bindings

Activities that use [FEEL expressions](help://bpmn/runtime_expressions) have access to the following additional bindings when run as a `Sequential Multi Instance`:

- `loop.index` — The 0-based index of the current iteration
- `loop.results` — A list of results from each completed iteration
- `loop.total` — The total number of values the `Sequential Multi Instance` will process
  - This is only a count and does **not** contain any actual values processed by the Activity

## Note on Data Objects

Reading from a Data Object can be done by each iteration.

However, _writing_ to a Data Object will only be performed once, _after_ all instances of the `Sequential Multi Instance` have finished.
