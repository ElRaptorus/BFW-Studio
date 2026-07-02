---
title: Data Store
---

# Data Store

![Data Store](DataStore.svg)

A `Data Store` represents data that lives **outside** the process, in another system — unlike a [Data Object](help://bpmn/properties/data_object), whose data belongs to the process run itself.

On its own, a Data Store is just a symbol on the diagram and stores nothing. Reading from or writing to a real external system requires a matching Engine plugin; without one, the Data Store has no effect when the process runs.
