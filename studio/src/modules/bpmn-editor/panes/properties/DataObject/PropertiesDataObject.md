---
title: Data Object
---

# Data Object

![Data Object](DataObject.svg)

A `Data Object` is a named piece of data that belongs to the whole process run. Once written, its value is available to every step until the process ends.

## Writing to it

Draw a [Data Output Association](help://bpmn/properties/data_output_association) from a step to the Data Object. When that step finishes, it writes to the Data Object — each write **replaces** the previous value. You can shape what gets written with a [Transformation](help://bpmn/properties/data_output_association_transformation).

## Reading from it

Read a Data Object inside any [formula](help://bpmn/runtime_expressions) using `dataObjects` followed by its name, for example:

```feel
dataObjects.myOrder
```

Drawing a [Data Input Association](help://bpmn/properties/data_input_association) shows the read on the diagram, but the actual reading happens in the formula.

## Validation

The `Value Contract` field lets you describe the shape every value written to this Data Object must have (as a JSON Schema). A write that does not fit is rejected and the writing step fails.
