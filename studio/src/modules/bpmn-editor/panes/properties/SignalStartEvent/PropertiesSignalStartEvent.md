---
# This is a comment, which might be helpful to explain the concept of help texts
title: Signal Start Event
---

# Signal Start Event

![Signal Start Event](SignalStartEvent.svg)

The `Signal Start Event` is a specialized [Start Event](help://bpmn/properties/start_event) that is used to automatically start a process.
The process will be started when a `Signal` with a matching name is received by the engine.
The source of that `Signal` can be another process, or a `Signal` triggered through an Engine Extension.

Processes with a `Signal Start Event` can also be started by hand, as you would a process with a regular `Start Event`.

Note that if multiple processes use a `Signal Start Event` with the _same_ `Signal`, then **all** the corresponding processes will be started, when a matching `Signal` is received.

## Properties

The following properties can be configured:

### Name

The name of the `Signal` that the `Signal Start Event` should wait for.
