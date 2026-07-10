---
title: Compensation Start Event
---

# Compensation Start Event

![Compensation Start Event](CompensationStartEvent.svg)

The `Compensation Start Event` is a specialized [Start Event](help://bpmn/properties/start_event) that begins a compensation [Event Subprocess](help://bpmn/properties/event_subprocess). When compensation is triggered within the enclosing scope, this Event Subprocess runs as the scope-level compensation handler.

## Precedence

A compensation Event Subprocess takes precedence over individual [Compensation Boundary Events](help://bpmn/properties/compensation_boundary_event) for **broadcast** compensation (no `activityRef`). Targeted compensation (specifying a specific activity) bypasses the Event Subprocess and uses the boundary handler directly.

## Interrupting behavior

Compensation Event Subprocesses are always **interrupting** — when triggered, they cancel the remaining active work in the enclosing scope before running the subprocess flow.

## Modelling rules

- The compensation Event Subprocess must have exactly **one** Compensation Start Event.
- No sequence flows may cross the Event Subprocess boundary.
