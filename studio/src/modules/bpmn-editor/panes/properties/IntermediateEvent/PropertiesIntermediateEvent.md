---
# This is a comment, which might be helpful to explain the concept of help texts
title: Intermediate Event
---

# Intermediate Event

![Intermediate Event](IntermediateEvent.svg)

The `Intermediate Event` is an `Event` that happens within a `Process` between the `Start Event` and `End Event`.
It doesn't start or terminate the `Process` but affects it by disrupting the normal flow, handling exceptions, creating delays or visualizing when messages are sent or expected.
The `Intermediate Event` can be typed as receiver or sender of a message ([Message Intermediate Catch Event](help://bpmn/properties/message_intermediate_catch_event) and [Message Intermediate Throw Event](help://bpmn/properties/message_intermediate_throw_event)), of a Link ([Link Intermediate Catch Event](help://bpmn/properties/link_intermediate_catch_event) and [Link Intermediate Throw Event](help://bpmn/properties/link_intermediate_throw_event)) or of a signal ([Signal Intermediate Catch Event](help://bpmn/properties/signal_intermediate_catch_event) and [Signal Intermediate Throw Event](help://bpmn/properties/signal_intermediate_throw_event)).
Also, there are events to catch a trigger from a timer ([Timer Intermediate Catch Event](help://bpmn/properties/timer_intermediate_event)) or a specific condition ([Conditional Intermediate Catch Event](help://bpmn/properties/conditional_intermediate_catch_event)) and events which emit an escalation ([Escalation Intermediate Throw Event](help://bpmn/properties/escalation_intermediate_throw_event) or a compensation ([Compensation Intermediate Throw Event](help://bpmn/properties/compensation_intermediate_throw_event)).
