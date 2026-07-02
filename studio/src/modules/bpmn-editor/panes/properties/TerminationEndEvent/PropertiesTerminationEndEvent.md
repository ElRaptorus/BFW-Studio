---
title: Termination End Event
---

# Termination End Event

![Termination End Event](TerminationEndEvent.svg)

The `Termination End Event` is a special [End Event](help://bpmn/properties/end_event) that stops the **entire** process at once — including any other paths that are still running in parallel.

This is useful in processes that split into several parallel paths with a [Parallel Gateway](help://bpmn/properties/parallel_gateway): reaching a Termination End Event on one path ends them all immediately, rather than waiting for the others to finish.
