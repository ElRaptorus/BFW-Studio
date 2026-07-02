---
title: Service Task
---

# Service Task

!["ServiceTask"](./ServiceTask.svg)

A `Service Task` performs automated work — typically calling an external system — without any human interaction. The process waits at the task until the work reports back, then continues.

## Configuration

### Type

**Required.** The `Type` field chooses how the work is carried out:

- [HTTP Service Task](help://bpmn/properties/http_service_task) — calls a web address (a URL) that you configure.
- [Custom Service Task](help://bpmn/properties/custom_service_task) — work carried out by an Engine plugin.

When you pick **Custom**, an extra `Implementation Type` field appears where you enter the name of the handler that should carry out the work.
The task will then be handed over to a Plugin that registers a handler under that name.

## Data Pipeline

Like all activities, a Service Task can shape the data it sends and receives. See [Input Mappings](help://bpmn/properties/input_mappings), [Output Mappings](help://bpmn/properties/output_mappings), [Payload Contract](help://bpmn/properties/payload_contract), and [Result Contract](help://bpmn/properties/result_contract).
