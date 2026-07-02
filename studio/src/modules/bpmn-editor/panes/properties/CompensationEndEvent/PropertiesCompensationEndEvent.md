---
title: Compensation End Event
---

# Compensation End Event

![Compensation End Event](CompensationEndEvent.svg)

> **Not executed by the current Engine.** You can draw and deploy this element, but the Engine will not run it. Avoid it in executable processes for now.

The `Compensation End Event` is a specialized [End Event](help://bpmn/properties/end_event) that requests `Compensation`: it signals that already-completed work should be undone. Tasks are compensated through their [Compensation Boundary Event](help://bpmn/properties/compensation_boundary_event).
