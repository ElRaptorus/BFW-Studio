---
title: Sequential Multi Instance
---

# Sequential Multi Instance

`Sequential Multi Instances` process a list of values one after another, creating one instance of the activity per entry.

## Configuration

Each round works on one entry from an [Input Collection](help://bpmn/properties/multi_instance_input) — a [formula](help://bpmn/runtime_expressions) that resolves to a list. Results can be gathered with an [Output Collection](help://bpmn/properties/multi_instance_output). Further limits, and a delay between rounds, live in the [Sequential Iteration Settings](help://bpmn/properties/sequential_mi_settings).

## Values you can use in each round

Inside a Multi-Instance activity, your formulas can use the `loop` values for the current round:

- `loop.index` — the position of the current round, starting at 0
- `loop.item` — the current collection element
- `loop.completed` — the number of rounds completed so far
- `loop.results` — the results from the rounds completed so far
- `loop.total` — how many entries are being processed in total
