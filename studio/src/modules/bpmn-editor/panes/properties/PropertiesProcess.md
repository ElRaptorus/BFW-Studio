---
title: Process / Participant / Pool
---

# Process / Participant / Pool

![Participant](Participant.svg)

A BPMN diagram is built from a few core ideas:

- A `Pool` is a container for one `Process`, and represents a `Participant` in a `Collaboration`.
- A `Process` is the sequence of events, activities, and gateways that actually runs.

Pools and participants are there to organise and label the diagram; only the process inside them runs. A diagram can hold as many pools and processes as you need. Processes do not talk to each other directly — use [message](help://bpmn/properties/message_intermediate_throw_event) or [signal](help://bpmn/properties/signal_intermediate_throw_event) events for that.

## Process configuration

Besides the basics like ID and name, a process has these settings:

### Version

**Required.** The `Version` field is the process's release label. You can use any scheme you like — for example `1.0.0`. It lets you tell different releases of the same process apart.

### Correlation Key

_Optional._ The `Correlation Key` is a [formula](help://bpmn/runtime_expressions) that makes sure an incoming message reaches the **right** waiting case rather than every process listening for that message. Each waiting case remembers its Correlation Key value; a message is delivered to the case whose value matches.

This is the receiving side of message correlation. The sending side sets a matching value with its [Correlation Retrieval Expression](help://bpmn/properties/correlation_retrieval_expression).

### Executable

The `Executable` switch decides whether this process is allowed to run. Turn it off to keep a process that is still being worked on from being started.
