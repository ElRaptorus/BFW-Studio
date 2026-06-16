---
# This is a comment, which might be helpful to explain the concept of help texts
title: Loops
---

# Loops

`Loops` can be used to execute a Flow Node repeatedly, until a certain `Break Condition` is met. Each iteration of the `Loop` produces its own Flow Node Instance.

## Configuration

### Break Condition

The `Break Condition` determines when the Loop should stop iterating. It must be a [FEEL expression](help://bpmn/runtime_expressions) that evaluates to a boolean.

Example:

```feel
token.result < 5
```

The value is stored as `evil:loopBreakCondition`.

#### Current Token

It is important to note that `token` matches the output produced by **the last iteration.**

To clarify:
Say you have a loop that runs 3 times. The data contained in `token`, available to the **3rd iteration**, would match the data created by the **2nd iteration**, and so forth.

#### Additional FEEL Context Bindings

In addition to the standard FEEL context bindings, `Loops` have access to the following loop-scoped bindings:

- `loop.index` — The 0-based index of the current iteration
- `loop.results` — A list of results from each completed iteration

You can use `loop.results` to compare the results from multiple iterations.

Example:

```feel
loop.index > 3 and loop.results[1] = loop.results[loop.index - 1]
```

### Loop Interval

If you have `Loops` with potentially high performance impact, you might want to use a delay between iterations, to take the pressure off the engine or an external API.

Set **Loop Interval** to an ISO 8601 duration (for example `PT1S` for one second). The value is stored as `evil:loopInterval`.

Default is no delay between iterations.

### Maximum Number of Iterations

To prevent a loop from running indefinitely, you can set **Maximum Number of Iterations** to a positive integer.

If set, the Loop will abort with an Error if the maximum number of iterations is exceeded.

The value is stored as `evil:maxIterations`.

By default, no iteration limit is set.

## Note on Data Objects

Reading from a Data Object can be done by each iteration.

However, _writing_ to a Data Object will only be performed once, _after_ the `Loop` has exited.
