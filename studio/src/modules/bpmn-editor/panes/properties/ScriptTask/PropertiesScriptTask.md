---
title: Script Task
---

# Script Task

![Script Task](ScriptTask.svg)

A `Script Task` runs a small [formula](help://bpmn/runtime_expressions) and uses its result as the task's output. Every Script Task needs **either** an inline formula **or** a `Script Ref` (see below) — at least one is required.

## Using the current data

Read values from the process data with the `token` prefix:

```feel
{ myValue: token.myValue }
```

## Producing new data

You cannot change an existing value in place. Instead, build a new result. To start from the current data and add or override a single value, use `context put`:

```feel
context put(token, "someValue", 7)
```

To combine several sets of values into one, use `context merge`:

```feel
context merge([token, { someValue: 7, status: "done" }])
```

## Script Ref

The `Script Ref` field lets you run a named script provided by an Engine plugin, instead of writing a formula here. When `Script Ref` is filled in, the inline editor is hidden and the named script is used.

## Data Pipeline

Like all activities, a Script Task can shape the data it sends and receives. See [Input Mappings](help://bpmn/properties/input_mappings), [Output Mappings](help://bpmn/properties/output_mappings), [Payload Contract](help://bpmn/properties/payload_contract), and [Result Contract](help://bpmn/properties/result_contract).
