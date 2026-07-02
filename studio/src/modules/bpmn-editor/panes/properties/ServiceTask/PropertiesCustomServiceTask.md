---
title: Custom Service Task
---

# Custom Service Task

A `Custom Service Task` hands its work to an Engine plugin — for instance a connector to a specific in-house application.

Set the [Service Task](help://bpmn/properties/service_task) `Type` to **Custom**, then enter the handler name in the `Implementation Type` field.
The Engine will delegate the Service Task to a Plugin, which provides a handler for this specific task.
The process waits until the plugin reports back, which may take a while if it depends on another system.

**Important:** If no Plugin provides a handler for this specific task, the Service Task will fail with an error.

The built-in [HTTP Service Task](help://bpmn/properties/http_service_task) works the same way — HTTP is simply a plugin that ships with the Engine.

## Data Pipeline

Like all activities, a Custom Service Task can shape the data it sends and receives. See [Input Mappings](help://bpmn/properties/input_mappings), [Output Mappings](help://bpmn/properties/output_mappings), [Payload Contract](help://bpmn/properties/payload_contract), and [Result Contract](help://bpmn/properties/result_contract).
