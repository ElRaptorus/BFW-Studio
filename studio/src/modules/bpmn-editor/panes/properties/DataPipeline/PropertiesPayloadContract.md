---
title: Payload Contract
---

# Payload Contract

A `Payload Contract` describes the shape the data **going into** an activity must have. When the incoming data does not match, the data is rejected and the step fails instead of continuing with bad input.

## Purpose

A Payload Contract catches data problems right at the entrance to an activity, so a malformed value is stopped early rather than causing trouble further down the process.

## Format

The contract is written as a [JSON Schema](https://json-schema.org/) — a standard way to describe the expected structure of data. For example:

```json
{
  "type": "object",
  "required": ["orderId", "amount"],
  "properties": {
    "orderId": { "type": "string" },
    "amount": { "type": "number", "minimum": 0 }
  }
}
```

This example requires an `orderId` (text) and an `amount` (a number of at least 0).

> A Payload Contract is a fixed description of the data — not a [formula](help://bpmn/runtime_expressions).
