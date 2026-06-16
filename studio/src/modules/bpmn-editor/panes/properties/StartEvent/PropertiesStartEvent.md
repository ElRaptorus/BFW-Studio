---
# This is a comment, which might be helpful to explain the concept of help texts
title: Start Event
---

# Start Event

![StartEvent](StartEvent.svg)

The `Start Event` is a the first event in a modeled process.
The Start Event couldn't have a entering sequence flow and has exact one outgoing sequence flow.
There could be designed multiple start events in one process.
If it is triggered it spawns a new process instance.
It is possible to use multiple Start Events in one process.
The Start Event can be typed as receiver of a message ([MessageStartEvent](help://bpmn/properties/message_start_event)) or a signal ([SignalStartEvent](help://bpmn/properties/signal_start_event)), as a timed event ([TimerStartEvent](help://bpmn/properties/timer_start_event)) or as conditional triggered ([ConditionalStartEvent](help://bpmn/properties/conditional_start_event)).
The Start Event first emits the process token.
