---
title: HTTP Service Task
---

# HTTP Service Task

An `HTTP Service Task` is a [Service Task](help://bpmn/properties/service_task) whose `Type` is set to **HTTP**. It calls a web address (a URL) while the process runs — for example to look something up in, or send something to, another system.

## Configuration

Two fields are plain text and are used exactly as you type them:

- **`Url`** — the web address to call. **Required.**
- **`Method`** — the kind of request: `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`. Defaults to `GET`.

The remaining fields are [formulas](help://bpmn/runtime_expressions), so their values can be built from the current process data:

- **`Body`** — the content sent with the request. Usually used with `POST`, `PUT`, or `PATCH`.
- **`Auth Header`** — the value for the request's `Authorization` header, when the target system requires sign-in.
- **`Response Headers`** — selects which of the response's headers are carried over into the task's result.

## Data Pipeline

Like all activities, the HTTP Service Task can shape the data it sends and receives. See [Input Mappings](help://bpmn/properties/input_mappings), [Output Mappings](help://bpmn/properties/output_mappings), [Payload Contract](help://bpmn/properties/payload_contract), and [Result Contract](help://bpmn/properties/result_contract).
