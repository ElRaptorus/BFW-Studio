---
title: Input Mappings
---

# Input Mappings

**Input Mappings** define how data from the current token is transformed and bound to variables in the activity's input scope. Each mapping consists of a **source** (FEEL expression) and a **target** (variable name).

## How It Works

Before the activity executes, each input mapping is evaluated:

1. The **source** [FEEL expression](help://bpmn/runtime_expressions) is evaluated against the current token and context bindings.
2. The result is bound to the **target** variable name in the activity's input scope.

The activity then executes with these mapped variables as its input, rather than receiving the raw token.

## Examples

| Source (FEEL)                              | Target         | Effect                                  |
| ------------------------------------------ | -------------- | --------------------------------------- |
| `token.customer.id`                        | `customerId`   | Extracts the customer ID from the token |
| `token.items[status = "pending"]`          | `pendingItems` | Filters and maps a subset of items      |
| `{ name: token.name, email: token.email }` | `contactInfo`  | Constructs a new context object         |

## When to Use

Use input mappings when you want to:

- Narrow down the data an activity receives (principle of least privilege)
- Transform or restructure token data before it enters the activity
- Provide a stable interface for the activity regardless of upstream token changes
