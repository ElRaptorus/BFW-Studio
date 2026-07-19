---
title: Parallel Multi Instance
---

# Parallel Multi Instance

`Parallel Multi Instances` process a list of values, creating one instance of the activity per entry and running them at the same time.

## Configuration

Each round works on one entry from an [Input Collection](help://bpmn/properties/multi_instance_input) — a [formula](help://bpmn/runtime_expressions) that resolves to a list. Results can be gathered with an [Output Collection](help://bpmn/properties/multi_instance_output). A safety cap on the number of parallel iterations can be set in the [Parallel MI Settings](help://bpmn/properties/parallel_mi_settings).

## Values you can use in each round

Inside a Multi-Instance activity, your formulas can use the `loop` values for the current round:

- `loop.index` — the position of the current round, starting at 0
- `loop.item` — the current collection element
- `loop.total` — how many entries are being processed in total
