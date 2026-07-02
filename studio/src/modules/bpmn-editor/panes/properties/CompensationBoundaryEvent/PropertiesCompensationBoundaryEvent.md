---
title: Compensation Boundary Event
---

# Compensation Boundary Event

![Compensation Boundary Event](CompensationBoundaryEvent.svg)

> **Not executed by the current Engine.** You can draw and deploy this element, but the Engine will not run it. Avoid it in executable processes for now.

The `Compensation Boundary Event` is a specialized [Boundary Event](help://bpmn/properties/boundary_event) that marks the compensation handler for its activity. When compensation is requested, the activity connected to this event would be run to undo the original activity's effect.
