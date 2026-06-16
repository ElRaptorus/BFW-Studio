---
# This is a comment, which might be helpful to explain the concept of help texts
title: Process / Participant / Pool
---

# Process / Participant / Pool

![Participant](Participant.svg)

A BPMN is defined by the following core concepts:

- `Collaboration`
- `Participant`
- `Pool`
- `Process`

Every `Pool` is a `Participant` of a `Collaboration`.
A `Pool` is a container for a `Process`.
A `Process` is a Sequence of `Events`, `Activities` and `Gateways`. This is the actual executable part of a diagram.
`Collaborations` and `Participants` have only symbolic value and are not evaluated by the engine.

Each diagram can contain as many `Pools` and `Processes` as you require.

`Processes` cannot interact with each other directly. However, you can use `Message Events` and `Signal Events` to realize inter-process communication.

## Process Configuration

Apart from some basic properties, like ID and Name, the following settings are available for a process:

### Version

**Required by the engine.**

The deployment version of the process, stored as `evil:version`. There are no naming conventions enforced by the engine, allowing you to use the versioning schema you need (for example `1.0.0`).

### Correlation Key

_Optional_.

A FEEL expression (`evil:correlationKey`) used for message-based process start correlation. When a message arrives, the engine evaluates this expression to determine which process instances are related.

### Executable

Determines if the Process is executable or not. You can use this to prevent the engine from executing certain processes of a diagram, which are not yet ready to run.
