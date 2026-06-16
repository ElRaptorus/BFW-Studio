---
title: Output Mappings
---

# Output Mappings

**Output Mappings** define how data from the activity's result is transformed and bound to variables in the outgoing token. Each mapping consists of a **source** (FEEL expression) and a **target** (variable name).

## How It Works

After the activity completes, each output mapping is evaluated:

1. The **source** [FEEL expression](help://bpmn/runtime_expressions) is evaluated against the activity's result.
2. The result is bound to the **target** variable name in the outgoing token.

## Examples

| Source (FEEL)               | Target            | Effect                                    |
| --------------------------- | ----------------- | ----------------------------------------- |
| `token.result`              | `processedResult` | Renames the result variable               |
| `token.response.statusCode` | `httpStatus`      | Extracts a specific value from the result |
| `count(token.items)`        | `itemCount`       | Computes a derived value                  |

## When to Use

Use output mappings when you want to:

- Rename or restructure the activity's output
- Extract specific values from a complex result
- Compute derived values from the activity's output
- Ensure downstream elements receive a consistent data shape
