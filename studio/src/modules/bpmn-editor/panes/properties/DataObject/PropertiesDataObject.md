---
# This is a comment, which might be helpful to explain the concept of help texts
title: Data Object
---

# Data Object

![Data Object](DataObject.svg)

`Data Objects` are used to store data in the context of a `Process Instance`.
Information stored in a `Data Object` is available to every `Flow Node Instance` of the respective `Process Instance`.
Storing data is achieved, by connecting a [Data Output Association](help://bpmn/properties/data_output_association) from your `Activity` or `Event` to the `Data Object` you wish to write data to.
Each `Data Output Association` will **overwrite** the content of the `Data Object` in question.
To read data from the `Data Object`, you have to set a [Data Input Association](help://bpmn/properties/data_input_association) from the `Data Object` to the `Activity` or `Event` that needs the `Data Object`'s data.
