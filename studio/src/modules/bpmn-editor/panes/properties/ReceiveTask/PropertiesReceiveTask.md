---
# This is a comment, which might be helpful to explain the concept of help texts
title: Receive Task
---

# Receive Tasks

![Receive Task](ReceiveTask.svg)

A `Receive Task` is used to receive Messages from a `Send Task`. Usually, this is used for inter-process communication, meaning the `Send Task` is located in a different process than the corresponding `Receive Task`.

The task will pause until a matching message is received.
It then acknowledges receiving the message and finishes.
