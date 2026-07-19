---
title: FEEL Expressions
---

# FEEL Expressions

## Introduction

The Studio uses **FEEL** (Friendly Enough Expression Language) for all the small formulas in a process — for conditions, data mapping, and calculations. FEEL is part of the open [DMN standard](https://www.omg.org/spec/DMN) and has a concise, readable syntax.

Fields that accept a formula are marked with a <span class="feel-expression-hint feel-expression-hint--no-hover">FEEL</span> badge in the properties panel.

> Looking for a quick reference? See the [FEEL Cheatsheet](help://bpmn/feel_cheatsheet).

## What a formula can read

Every formula can read from the following, using the names below:

| Name              | What it gives you                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `token`           | The current process data — the values flowing through the process at this step                              |
| `this`            | Details about the current step: `id`, `name`, `type`                                                        |
| `context`         | The values the process was started with (read-only for the whole run)                                       |
| `dataObjects`     | The [Data Objects](help://bpmn/properties/data_object) in the process, by name (e.g. `dataObjects.MyOrder`) |
| `process`         | Details about the process: `id`, `name`, `version`                                                          |
| `processInstance` | Details about this run: `id`, `businessKey`, `startedAt`, `startedBy`, `parentId`                           |
| `identity`        | Details about who the run belongs to: `id`, `roles`, `groups`, `claims`                                     |
| `loop`            | Values for the current round (only inside a loop): `index`, `total`, `completed`, `results`                 |

### Examples

**Read a value from the process data:**

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

**Read a Data Object:**

```
dataObjects.OrderConfig.maxRetries
```

**Use the round values inside a loop:**

```
if loop.index = loop.total - 1 then "last" else "processing"
```

## Where formulas are used

Formulas appear in these places:

### Conditions and logic

- [Script Task](help://bpmn/properties/script_task) — the script body
- [Business Rule Task](help://bpmn/properties/business_rule_task) — the rule, when its type is FEEL Expression
- [Conditional Flow](help://bpmn/properties/conditional_flow) — the condition on a flow leaving a split gateway ([Exclusive](help://bpmn/properties/exclusive_gateway), [Inclusive](help://bpmn/properties/inclusive_gateway), or [Complex](help://bpmn/properties/complex_gateway)); conditions on flows leaving anything else are ignored
- Conditional events — the [Condition](help://bpmn/properties/conditional_intermediate_catch_event) field

### Shaping data

- [Input Mappings](help://bpmn/properties/input_mappings) and [Output Mappings](help://bpmn/properties/output_mappings) — the **Source** of each mapping
- [Transformation](help://bpmn/properties/data_output_association_transformation) — what a step writes into a Data Object

### User Tasks

- [Assignees](help://bpmn/properties/user_task_assignees) — who the task goes to
- **Due Date** — when the [task](help://bpmn/properties/user_task) is due

### HTTP Service Tasks

- **Body**, **Auth Header**, and **Response Headers** on an [HTTP Service Task](help://bpmn/properties/http_service_task)

### Messages

- [Correlation Retrieval Expression](help://bpmn/properties/correlation_retrieval_expression) — the value a sender attaches to a message
- [Correlation Key](help://bpmn/properties/process) — the value a waiting case listens for

### Loops (Multi-Instance)

- [Input Collection](help://bpmn/properties/multi_instance_input) and [Output Collection](help://bpmn/properties/multi_instance_output)
- [Completion Condition](help://bpmn/properties/multi_instance_completion)
- [Loop Break Condition](help://bpmn/properties/sequential_mi_settings)

### Timers

- The **Definition** of a timer, when set as a schedule rather than a fixed date

## Fields that are not formulas

A few fields describe the **shape** of data instead of calculating a value. These use JSON Schema, not a formula:

- [Payload Contract](help://bpmn/properties/payload_contract) and [Result Contract](help://bpmn/properties/result_contract)
- [Value Contract](help://bpmn/properties/data_object) on a Data Object

User Task **Form Fields** are also not a formula — they describe the form the person fills in.

## Testing a formula

You can try formulas out interactively in the **FEEL Expression Simulator**, which evaluates them live against sample data you provide — a safe way to check a formula before using it in a process.
