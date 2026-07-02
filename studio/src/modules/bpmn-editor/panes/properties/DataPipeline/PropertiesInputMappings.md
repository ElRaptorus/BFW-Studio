---
title: Input Mappings
---

# Input Mappings

`Input Mappings` decide exactly which data an activity receives, and in what shape, before it runs. Instead of handing the activity everything, you pick out and prepare just what it needs.

Each mapping has two parts:

- **Source** — a [formula](help://bpmn/runtime_expressions) that reads from the current process data.
- **Target** — the name the activity will see that value under.

## How it works

Before the activity runs, each mapping's **Source** formula is worked out and the result is handed to the activity under its **Target** name. The activity then runs with just these prepared values.

## Examples

| Source                                     | Target         | Effect                                    |
| ------------------------------------------ | -------------- | ----------------------------------------- |
| `token.customer.id`                        | `customerId`   | Passes just the customer ID               |
| `token.items[status = "pending"]`          | `pendingItems` | Passes only the items still pending       |
| `{ name: token.name, email: token.email }` | `contactInfo`  | Builds a small package of contact details |

## When to use

- To give an activity only what it needs, nothing more.
- To reshape or rename data before the activity sees it.
- To keep an activity's input stable even when earlier steps change.

## Where it appears

Input Mappings are available on data-carrying steps: Service Tasks, Script Tasks, Business Rule Tasks, User Tasks, Call Activities, and message-sending elements.
