---
# This is a comment, which might be helpful to explain the concept of help texts
title: Escalation Start Event
---

# Escalation Start Event

![Escalation Start Event](EscalationStartEvent.svg)

The `Escalation Start Event` is a specialized [Start Event](help://bpmn/properties/start_event) that is triggered by an `Escalation Event` from another `Process` or `Participant` respectively.
It is used in the context of an [Event Subprocess](help://bpmn/properties/event_subprocess).
If the `Escalation Start Event` is modeled **non-interrupting**, the triggering `Process` or `Participant` will not interrupt its execution.
