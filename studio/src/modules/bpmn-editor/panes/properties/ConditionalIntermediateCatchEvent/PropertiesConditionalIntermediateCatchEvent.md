---
# This is a comment, which might be helpful to explain the concept of help texts
title: Conditional Intermediate Catch Event
---

# Conditional Intermediate Catch Event

![Conditional Intermediate Catch Event](ConditionalIntermediateCatchEvent.svg)

The `Conditional Intermediate Catch Event` is a specialized [Intermediate Event](help://bpmn/properties/intermediate_event) that is triggered when an annotated condition becomes true.
Conditions are modeled by using FEEL expressions.

This FEEL expression must evaluate to a **boolean** value. Otherwise, an error will be thrown.

## Scope

`Intermediate Conditional Catch Events` can currently only access data from the Process Instance in which they are executed.
FEEL expressions cannot access data from other process instances.

Therefore, it is currently not possible to listen for changes in a child process or a parent process.
