---
# This is a comment, which might be helpful to explain the concept of help texts
title: Event Subprocess
---

# Event Subprocess

![Event Subprocess](EventSubprocess.svg)

An `Event Subprocess` is a specialized [Subprocess](help://bpmn/properties/subprocess) that is triggered by an `Event`.

Unlike a standard `Subprocess`, the `Event Subprocess` is not part of the normal flow of the parent `Process`.

An `Event Subprocess` must contain exactly one `Start Event` with a trigger definition of one of the following types:

- [Message Start Event](help://bpmn/properties/message_start_event)
- [Error Start Event](help://bpmn/properties/error_start_event)
- [Escalation Start Event](help://bpmn/properties/escalation_start_event)
- [Compensation Start Event](help://bpmn/properties/compensation_start_event)
- [Conditional Start Event](help://bpmn/properties/conditional_start_event)
- [Timer Start Event](help://bpmn/properties/timer_start_event)
- [Signal Start Event](help://bpmn/properties/signal_start_event)

The `Event Subprocess` can be triggered multiple times during the execution of the parent process, if the `Start Event` is modelled as non-interrupting.

## Requirements

An Engine version **>= 20.0.0** is required.

Additionally, only the interrupting forms of the following `Start Events` are supported:

- [Message Start Event](help://bpmn/properties/message_start_event)
- [Error Start Event](help://bpmn/properties/error_start_event)
- [Signal Start Event](help://bpmn/properties/signal_start_event)
- [Timer Start Event](help://bpmn/properties/timer_start_event)
