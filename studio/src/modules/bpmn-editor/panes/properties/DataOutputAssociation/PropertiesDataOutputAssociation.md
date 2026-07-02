---
title: Data Output Association
---

# Data Output Association

![Data Output Association](DataOutputAssociation.svg)

A `Data Output Association` is the line that makes a step write to a [Data Object](help://bpmn/properties/data_object) when it finishes. It points to the Data Object that receives the value.

By default the step's full output is written, **replacing** the Data Object's previous value. To write only part of the output, or to reshape it first, add a [Transformation](help://bpmn/properties/data_output_association_transformation).

If the target Data Object has a [Value Contract](help://bpmn/properties/data_object), a write that does not fit it is rejected and the writing step fails.
