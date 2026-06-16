---
title: FEEL Expressions
---

# FEEL Expressions

## Introduction

The ThomasTheDaemonEngine uses **FEEL** (Friendly Enough Expression Language) for all dynamic expressions in BPMN processes. FEEL is part of the [DMN specification](https://www.omg.org/spec/DMN) and provides a concise, readable syntax for data access, transformation, and decision logic.

Properties that accept FEEL expressions are marked with a <span class="feel-expression-hint feel-expression-hint--no-hover">FEEL</span> badge in the property panes.

> Looking for a quick reference? See the [FEEL Cheatsheet](help://bpmn/feel_cheatsheet).

## Expression Context

Every FEEL expression has access to the following context bindings at runtime:

| Binding           | Description                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `token`           | The current token payload — a JSON object whose shape depends on the preceding flow node's output                                   |
| `this`            | Metadata about the current flow node: `id`, `name`, `type`                                                                          |
| `context`         | Read-only process context (initial input values / process variables)                                                                |
| `dataObjects`     | Map of Data Object values, keyed by Data Object element ID (e.g., `dataObjects.MyDataObject`)                                       |
| `process`         | Process metadata: `id`, `name`, `version`                                                                                           |
| `processInstance` | Instance metadata: `id`, `businessKey`, `startedAt`, `startedBy`, `parentId`                                                        |
| `identity`        | Information about the process instance owner: `id`, `roles`, `groups`, `claims`                                                     |
| `loop`            | Loop iteration context (only available inside Multi-Instance or Standard Loop activities): `index`, `total`, `completed`, `results` |

### Examples

**Access a value from the token:**

```
token.customer.name
```

**Build a new structure:**

```
{
  department: token.department,
  requestedBy: identity.id,
  processVersion: process.version
}
```

**Use Data Objects:**

```
dataObjects.OrderConfig.maxRetries
```

**Loop context (inside Multi-Instance):**

```
if loop.index = loop.total - 1 then "last" else "processing"
```

## Where FEEL Expressions Are Used

FEEL expressions appear in the following BPMN element properties:

### Activity Scripts & Conditions

- **Script Task** — inline script body (`<bpmn:script>`)
- **Business Rule Task** — inline FEEL expression (when `implementation = "feel"`)
- **Sequence Flow** — condition expression on exclusive gateway outgoing flows
- **Conditional Event** — condition expression

### Data Pipeline

- **Input Mapping** — `source` field (FEEL expression producing the mapped value)
- **Output Mapping** — `source` field (FEEL expression producing the mapped value)

### User Task

- **Assignees** (`evil:assignees`) — FEEL expression resolving to an assignee list
- **Due Date** (`evil:dueDate`) — FEEL expression or ISO 8601 date string

### Service Task (HTTP)

- **HTTP Body** (`evil:httpBody`) — FEEL expression for the request body
- **HTTP Auth Header** (`evil:httpAuthHeader`) — FEEL expression for the Authorization header
- **HTTP Response Headers** (`evil:httpResponseHeaders`) — FEEL expression for response header handling

### Events

- **Payload** (`evil:payload`) — outgoing message/signal payload
- **Event Mapping** (`evil:eventMapping`) — maps received event data into the token
- **Correlation Retrieval** (`evil:correlationRetrievalExpression`) — extracts correlation value from incoming messages

### Multi-Instance / Loop

- **Input Collection** (`evil:inputCollection`) — collection to iterate over
- **Output Collection** (`evil:outputCollection`) — aggregation expression for results
- **Loop Break Condition** (`evil:loopBreakCondition`) — early termination condition
- **Loop Cardinality** — number of instances
- **Completion Condition** — early completion condition

### Process Level

- **Correlation Key** (`evil:correlationKey`) — process-level correlation expression

### Timer Events

- **Time Date**, **Time Duration**, **Time Cycle** — ISO 8601 expressions (FEEL-evaluable)

### Data Output Association

- **Transformation** (`<bpmn:transformation>`) — projects activity output into a Data Object value

## Properties That Are NOT FEEL

The following properties store structured data (typically JSON Schema) and do **not** contain FEEL expressions:

- `evil:payloadContract` — JSON Schema for input validation
- `evil:resultContract` — JSON Schema for output validation
- `evil:valueContract` — JSON Schema for Data Object validation
- `evil:dataContract` — JSON Schema with direction metadata
- `evil:formFields` — JSON structure for User Task form definitions

## FEEL Expression Simulator

You can test FEEL expressions interactively in the **FEEL Expression Simulator**, available under `about:machine-sanctum/feel_editor`. The simulator provides live evaluation with customizable sample context data.
