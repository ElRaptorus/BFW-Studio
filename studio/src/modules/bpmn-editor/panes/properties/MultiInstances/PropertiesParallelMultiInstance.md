---
title: Parallel Multi Instance
---

# Parallel Multi Instance

> **Not executed by the current Engine.** You can draw and deploy Multi-Instance loops, but the Engine will not run them. Avoid them in executable processes for now.

`Parallel Multi Instances` process a list of values, creating one instance of the activity per entry and running them at the same time.

## Configuration

Each round works on one entry from an [Input Collection](help://bpmn/properties/multi_instance_input) — a [formula](help://bpmn/runtime_expressions) that resolves to a list — or from the current process data when no Input Collection is set. Results can be gathered with an [Output Collection](help://bpmn/properties/multi_instance_output). Further limits live in the [Multi-Instance Extensions](help://bpmn/properties/multi_instance_extensions).

## Values you can use in each round

Inside a Multi-Instance activity, your formulas can use the `loop` values for the current round:

- `loop.index` — the position of the current round, starting at 0
- `loop.total` — how many entries are being processed in total
