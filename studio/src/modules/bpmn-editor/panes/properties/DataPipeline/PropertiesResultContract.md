---
title: Result Contract
---

# Result Contract

A `Result Contract` describes the shape the data **coming out of** an activity must have. When the result does not match, it is rejected and the step fails instead of passing bad data on.

## Purpose

A Result Contract makes sure later steps only ever receive well-formed data, stopping a malformed result from spreading through the rest of the process.

## Format

The contract is written as a [JSON Schema](https://json-schema.org/) — a standard way to describe the expected structure of data. For example:

```json
{
  "type": "object",
  "required": ["status", "processedAt"],
  "properties": {
    "status": { "type": "string", "enum": ["success", "failure"] },
    "processedAt": { "type": "string", "format": "date-time" }
  }
}
```

This example requires a `status` of either `success` or `failure`, and a `processedAt` date and time.

> A Result Contract is a fixed description of the data — not a [formula](help://bpmn/runtime_expressions).
