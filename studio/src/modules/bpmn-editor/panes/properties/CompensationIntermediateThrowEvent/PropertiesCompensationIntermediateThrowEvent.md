---
# This is a comment, which might be helpful to explain the concept of help texts
title: Compensation Intermediate Throw Event
---

# Compensation Intermediate Throw Event

![Compensation Intermediate Throw Event](CompensationIntermediateThrowEvent.svg)

The `Compensation Intermediate Throw Event` is a specialized [Intermediate Event](help://bpmn/properties/intermediate_event) that indicates that a `Compensation` is necessary.
After the `Compensation Intermediate Throw Event` is triggered the previous `Tasks` or `Sub Processes` will be compensated.
To be compensated, a `Task` must have a `Compensation Boundary Event` or contain a `Compensation Event Sub-Process`.
