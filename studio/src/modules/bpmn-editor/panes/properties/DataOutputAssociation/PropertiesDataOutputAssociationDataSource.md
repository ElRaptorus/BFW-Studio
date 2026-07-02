---
title: Data Output Association Transformation
---

# Transformation

The `Transformation` field controls exactly what a [Data Output Association](help://bpmn/properties/data_output_association) writes into a [Data Object](help://bpmn/properties/data_object).

It is a [formula](help://bpmn/runtime_expressions) that shapes the step's output into the value you want to store — for example picking out a single field or combining several.

If you leave it empty, the step's full output is written to the Data Object.
