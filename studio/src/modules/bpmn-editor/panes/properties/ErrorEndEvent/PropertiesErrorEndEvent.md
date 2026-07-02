---
title: Error End Event
---

# Error End Event

![Error End Event](ErrorEndEvent.svg)

An `Error End Event` ends the process by raising a named error. The process finishes in an **error** state instead of completing normally. It is typically used inside a subprocess or a process started by a [Call Activity](help://bpmn/properties/call_activity), so the parent can react with an [Error Boundary Event](help://bpmn/properties/error_boundary_event).

## Configuration

- **`Error Code`** — a short code that identifies the error (for example `404`). A catching [Error Boundary Event](help://bpmn/properties/error_boundary_event) uses it to decide whether to react.
- **`Error Message`** — a readable description of what went wrong.
