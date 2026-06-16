---
# This is a comment, which might be helpful to explain the concept of help texts
title: Call Activity
---

# Call Activity

![Call Activity](CallActivity.svg)

A `Call Activity` is a specialized `Task` for executing another `Process` as `Child Process Instance`.

The `Call Activity` itself will be suspended, until the `Child Process Instance` has finished. Its result will be stored by the `Call Activity` as activity output and will also include the Name and ID of the End Event at which the `Child Process Instance` was finished.

For example:

```
{
  result: { testResult: "test" },
  endEventId: "EndEvent_1",
  endEventName: "End Event 1"
}
```

## Configuration

The following parameters can be set:

### Process

**Required.**

The name of the `Process` that the `Call Activity` should execute as a `Child Process Instance`.

### Start Event ID

_Optional_.

The ID of the Start Event at which the `Child Process Instance` should be started.
If omitted, the Process' first `Start Event` will be used as entry point.

### Input/Output Mappings

_Optional_.

The `Call Activity` uses `evil:inputMapping` and `evil:outputMapping` to map data between the parent and child process, instead of passing a raw payload.

- **Input Mappings** — Each mapping has a `source` (FEEL expression evaluated in the parent scope) and a `target` (variable name in the child process). Use these to pass specific values into the `Child Process Instance`.
- **Output Mappings** — Each mapping has a `source` (FEEL expression evaluated against the child result) and a `target` (variable name written back to the parent token).

If no input mappings are configured, the parent token is available to the child process according to the engine's default scoping rules.
