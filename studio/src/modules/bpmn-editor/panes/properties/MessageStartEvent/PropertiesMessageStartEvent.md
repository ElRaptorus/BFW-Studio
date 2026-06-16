---
# This is a comment, which might be helpful to explain the concept of help texts
title: Message Start Event
---

# Message Start Event

![Message Start Event](MessageStartEvent.svg)

The `Message Start Event` is a specialized [Start Event](help://bpmn/properties/start_event) that is used to automatically start a process.
The process will be started when a `Message` with a matching name is received by the engine.
The source of that `Message` can be another process, or a `Message` triggered through an Engine Extension.

Processes with a `Message Start Event` can also be started by hand, as you would a process with a regular `Start Event`.

Note that if multiple processes use a `Message Start Event` with the _same_ `Message`, then **all** the corresponding processes will be started, when a matching `Message` is received.

## Properties

The following properties can be configured:

### Name

The name of the `Message` that the `Message Start Event` should wait for.
