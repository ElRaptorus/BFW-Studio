---
title: Result Contract
---

# Result Contract

The **Result Contract** is a JSON Schema that is validated against the activity's output at runtime. If the output does not conform to the schema, the flow node instance transitions to a **Fatal** state.

## Purpose

Result Contracts enforce data quality at the output boundary of an activity. They ensure that downstream elements receive correctly structured data, preventing malformed output from propagating through the process.

## Format

The contract must be a valid [JSON Schema](https://json-schema.org/) document. Example:

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

## Note

Result Contracts are **not** FEEL expressions. They are static JSON Schema definitions evaluated by the engine's schema validator.
