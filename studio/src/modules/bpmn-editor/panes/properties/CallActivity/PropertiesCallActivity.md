---
title: Call Activity
---

# Call Activity

![Call Activity](CallActivity.svg)

A `Call Activity` runs another process as a separate sub-run and waits for it to finish. Use it to reuse a process you have modelled once — such as an approval or a fulfilment flow — from many other processes.

When the called process finishes, its result is handed back as this activity's output, together with which end point the sub-run reached. For example:

```
{
  result: { testResult: "test" },
  endEventId: "EndEvent_1",
  endEventName: "End Event 1"
}
```

## Configuration

### Process

**Required.** The `Process` field names the process to run. That process must already be deployed to the system.

### Start Event

_Optional._ The `Start Event` field picks where the called process should begin.

Leave it empty when the called process has a single, obvious starting point. If a process has several plain start events, the system cannot guess which one to use and the Call Activity fails — in that case, either give the called process a single plain start, or name the start point here.

### Called process version

_Optional._ Pins the child process to a specific `<evil:version>` string of the called process.

Leave the field **empty** so the Engine picks the newest enabled, non-deleted catalog version when this Call Activity runs (newest `deployed_at`, not semver order). The value must match the called process's `<evil:version>` exactly.

**Do not type `latest`.** That looks up a version actually named `latest` and fails if none exists. This is not the same as retry, which treats `"version": "latest"` as a keyword.

Clearing the field removes the pin from the diagram.

### Input & Output Mappings

_Optional._ Because parent and child are separate runs, you decide exactly which data crosses between them:

- **Input Mappings** — carry selected values from the parent into the child before it starts. See [Input Mappings](help://bpmn/properties/input_mappings).
- **Output Mappings** — carry selected values from the child's result back into the parent. See [Output Mappings](help://bpmn/properties/output_mappings).
