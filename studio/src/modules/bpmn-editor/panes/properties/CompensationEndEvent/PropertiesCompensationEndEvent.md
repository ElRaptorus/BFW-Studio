---
# This is a comment, which might be helpful to explain the concept of help texts
title: Compensation End Event
---

# Compensation End Event

![Compensation End Event](CompensationEndEvent.svg)

The `Compensation End Event` is a specialized [End Event](help://bpmn/properties/end_event) that indicates that a `Compensation` is necessary.
After the `Compensation End Event` is triggered, all previous `Tasks` that have a [Compensation Boundary Event](help://bpmn/properties/compensation_boundary_event) will be compensated.
