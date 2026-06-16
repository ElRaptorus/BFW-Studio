---
title: Payload Contract
---

# Payload Contract

The **Payload Contract** is a JSON Schema that is validated against the activity's input payload at runtime. If the payload does not conform to the schema, the flow node instance transitions to a **Fatal** state.

## Purpose

Payload Contracts enforce data quality at the boundary of an activity. They ensure that the activity receives correctly structured input, catching data issues early instead of allowing them to propagate through the process.

## Format

The contract must be a valid [JSON Schema](https://json-schema.org/) document. Example:

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

## Note

Payload Contracts are **not** FEEL expressions. They are static JSON Schema definitions evaluated by the engine's schema validator.
