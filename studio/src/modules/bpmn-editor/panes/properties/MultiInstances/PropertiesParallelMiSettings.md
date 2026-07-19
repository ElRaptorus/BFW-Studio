---
title: Parallel MI Settings
---

# Parallel MI Settings

These settings apply to **parallel** Multi-Instance activities, where all iterations run simultaneously.

## Max Iterations

The `Max Iterations` field sets the maximum number of items from the input collection that can be processed in a single parallel run.

**If the input collection exceeds this limit at runtime, the process instance will fail with an error.** This is a safety guard — it prevents accidentally spawning an unbounded number of parallel iterations.

If you need to process large collections, either increase this limit, or switch to a Sequential Multi-Instance, which processes items one at a time and can cap the collection without failing.
