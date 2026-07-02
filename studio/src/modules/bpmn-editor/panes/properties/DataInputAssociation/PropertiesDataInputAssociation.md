---
title: Data Input Association
---

# Data Input Association

![Data Input Association](DataInputAssociation.svg)

A `Data Input Association` is the line that connects a [Data Object](help://bpmn/properties/data_object) (or a [Data Store](help://bpmn/properties/data_store)) to a step, showing on the diagram that the step reads that data.

It is there for clarity on the diagram. The actual reading happens inside a [formula](help://bpmn/runtime_expressions) — for example `dataObjects.myOrder` — not through the line itself.
