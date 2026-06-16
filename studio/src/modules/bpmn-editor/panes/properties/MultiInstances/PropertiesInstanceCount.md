---
title: Instance Count (Loop Cardinality)
---

# Instance Count (Loop Cardinality)

The **Instance Count** (formally `loopCardinality`) defines how many instances the Multi Instance activity will create. It accepts a numeric [FEEL expression](help://bpmn/runtime_expressions) that is evaluated at runtime.

## Usage

Set the instance count to a fixed number or a FEEL expression that resolves to a positive integer.

### Examples

**Fixed count:**

```feel
5
```

**Dynamic count from token:**

```feel
count(token.items)
```

## Interaction with Input Collection

When both `Instance Count` and `Input Collection` are specified, the Instance Count acts as a **limit** rather than an exact count. The engine ensures all collection items are processed without data loss.

### Collection smaller or equal to Instance Count

The number of instances is capped at the collection size. Each instance receives exactly one item. Excess capacity is unused.

_Example:_ Instance Count = 10, Collection has 4 items → 4 instances are created.

### Collection larger than Instance Count

The behavior depends on whether the Multi Instance is parallel or sequential:

**Parallel Multi Instance:** All collection items are processed, but only up to _N_ instances run concurrently (where _N_ = Instance Count). Once a running instance completes, the next item from the collection is picked up. This effectively makes the Instance Count a **max concurrency** limit.

_Example:_ Instance Count = 3, Collection has 9 items → 9 items are processed, at most 3 in parallel at any time.

**Sequential Multi Instance:** The collection is partitioned into _N_ batches (where _N_ = Instance Count). Each instance receives a subset of the collection as a list. Earlier instances receive larger batches when the collection cannot be divided evenly.

_Example:_ Instance Count = 3, Collection has 10 items → 3 instances with batches of 4, 3, and 3 items.

### No Input Collection

If only Instance Count is set (no Input Collection), exactly _N_ instances are created, each receiving the current token payload as input.

### No Instance Count

If only Input Collection is set (no Instance Count), the number of instances equals the number of items in the collection — one item per instance.

## Note

This property maps to the BPMN 2.0 `loopCardinality` attribute on `multiInstanceLoopCharacteristics`. The batching and concurrency-limiting behavior described above is a Studio-specific interpretation; the BPMN 2.0 spec leaves mismatch handling to the implementation.
