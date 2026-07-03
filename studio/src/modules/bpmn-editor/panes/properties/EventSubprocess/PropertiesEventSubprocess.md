---
title: Event Subprocess
---

# Event Subprocess

![Event Subprocess](EventSubprocess.svg)

An `Event Subprocess` is an embedded [Subprocess](help://bpmn/properties/subprocess) that runs in reaction to an event rather than as part of the normal flow. It lives inside a parent process (or subprocess) scope, has **no** incoming or outgoing Sequence Flows, and is triggered by its single, typed Start Event whenever its enclosing scope is active.

## Trigger types

The Start Event of an Event Subprocess must be **typed** — a blank (None) start is not allowed. The following trigger types are supported:

| Trigger     | Interrupting | Non-interrupting |
| ----------- | :----------: | :--------------: |
| Message     |      ✓       |        ✓         |
| Timer       |      ✓       |        ✓         |
| Signal      |      ✓       |        ✓         |
| Conditional |      ✓       |        ✓         |
| Escalation  |      ✓       |        ✓         |
| Error       |      ✓       |        —         |

An **Error** start event must be **interrupting**; a non-interrupting Error start is not permitted. **Compensation** starts are not supported.

## Interrupting vs non-interrupting

- **Interrupting**: firing the Event Subprocess cancels the remaining work in the enclosing scope, then runs the subprocess.
- **Non-interrupting**: the enclosing scope keeps running; the Event Subprocess runs in parallel and may be triggered again, spawning several concurrent instances.

Choose interrupting vs non-interrupting in the **modeler** by replacing the Start Event with the desired variant (there is no separate property toggle). Use the replace menu on the Start Event to switch between the interrupting and non-interrupting forms.

## Modelling rules

- Exactly **one** Start Event, and it must be typed (see the table above).
- **No** Sequence Flows may cross the Event Subprocess boundary — it is reached only through its Start Event trigger.

The linter enforces these rules (see the `bpmn-development` / `bpmn-production-ready` profiles) so violations surface before deployment.

## Boundary events — a complementary option

To react to an event **while a specific activity is running**, attach a **Boundary Event** to that activity instead. Boundary events target a single activity, whereas an Event Subprocess reacts to events across the whole enclosing scope. Both are executable; pick whichever matches the scope you need:

- [Error Boundary Event](help://bpmn/properties/error_boundary_event)
- [Message Boundary Event](help://bpmn/properties/message_boundary_event)
- [Signal Boundary Event](help://bpmn/properties/signal_boundary_event)
- [Timer Boundary Event](help://bpmn/properties/timer_boundary_event)
- [Conditional Boundary Event](help://bpmn/properties/conditional_boundary_event)
- [Escalation Boundary Event](help://bpmn/properties/escalation_boundary_event)
