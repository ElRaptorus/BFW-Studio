---
# This is a comment, which might be helpful to explain the concept of help texts
title: Custom Service Task
---

# Custom Service Task

This type of service task delegates a unit of work to a custom handler registered with the engine.

The `implementation` field on a `Service Task` can be set to any string value. The engine uses this value as a dispatch key to route execution to the appropriate handler — for example, a plugin registered for that implementation name.

Built-in handlers (such as `http`) use the same mechanism. Custom implementations follow the same pattern: set `implementation` to the handler key your plugin registered, and configure any handler-specific extension properties on the task.
