---
title: Output Mappings
---

# Output Mappings

`Output Mappings` decide which parts of an activity's result are kept, and under what names, before the flow continues. Instead of carrying the whole raw result forward, you pick out and tidy up just what later steps need.

Each mapping has two parts:

- **Source** — a [formula](help://bpmn/runtime_expressions) that reads from the activity's result.
- **Target** — the name the value is carried forward under.

## How it works

After the activity finishes, each mapping's **Source** formula is worked out against the result, and the value is carried forward under its **Target** name.

## Examples

| Source                      | Target            | Effect                                 |
| --------------------------- | ----------------- | -------------------------------------- |
| `token.result`              | `processedResult` | Renames the result                     |
| `token.response.statusCode` | `httpStatus`      | Keeps just one value from the result   |
| `count(token.items)`        | `itemCount`       | Works out a new value (how many items) |

## When to use

- To rename or reshape what an activity produces.
- To keep only the values later steps actually need.
- To work out a new value from the result.
- To give later steps a consistent, predictable data shape.

## Where it appears

Output Mappings are available on data-carrying steps: Service Tasks, Script Tasks, Business Rule Tasks, User Tasks, Call Activities, and message-receiving elements.
