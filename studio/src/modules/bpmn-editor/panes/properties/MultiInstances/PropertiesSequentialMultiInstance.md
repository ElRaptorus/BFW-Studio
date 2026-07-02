---
title: Sequential Multi Instance
---

# Sequential Multi Instance

> **Not executed by the current Engine.** You can draw and deploy Multi-Instance loops, but the Engine will not run them. Avoid them in executable processes for now.

`Sequential Multi Instances` process a list of values one after another, creating one instance of the activity per entry.

## Configuration

Each round works on one entry from an [Input Collection](help://bpmn/properties/multi_instance_input) — a [formula](help://bpmn/runtime_expressions) that resolves to a list — or from the current process data when no Input Collection is set. Results can be gathered with an [Output Collection](help://bpmn/properties/multi_instance_output). Further limits, and a delay between rounds, live in the [Multi-Instance Extensions](help://bpmn/properties/multi_instance_extensions).

## Values you can use in each round

Inside a Multi-Instance activity, your formulas can use the `loop` values for the current round:

- `loop.index` — the position of the current round, starting at 0
- `loop.results` — the results from the rounds completed so far
- `loop.total` — how many entries are being processed in total
