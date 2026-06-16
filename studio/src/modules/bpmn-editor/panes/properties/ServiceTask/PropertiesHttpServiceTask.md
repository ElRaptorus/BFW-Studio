---
title: HTTP Service Task
---

# HTTP Service Task

The `HTTP Service Task` is a Service Task with `implementation` set to `"http"`. It performs an HTTP request to an external endpoint during process execution.

## Configuration

| Property                 | Description                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **URL**                  | The target endpoint URL                                                                                              |
| **Method**               | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`                                                              |
| **Body**                 | [FEEL expression](help://bpmn/runtime_expressions) for the request body (typically used with `POST`, `PUT`, `PATCH`) |
| **Authorization Header** | [FEEL expression](help://bpmn/runtime_expressions) for the `Authorization` header value                              |
| **Response Headers**     | [FEEL expression](help://bpmn/runtime_expressions) for handling response headers                                     |

## Data Pipeline

Like all activity types, the HTTP Service Task supports [Input Mappings](help://bpmn/properties/input_mappings), [Output Mappings](help://bpmn/properties/output_mappings), [Payload Contract](help://bpmn/properties/payload_contract), and [Result Contract](help://bpmn/properties/result_contract).
