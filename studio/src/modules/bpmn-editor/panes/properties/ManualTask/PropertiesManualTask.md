---
# This is a comment, which might be helpful to explain the concept of help texts
title: Manual Task
---

# Manual Tasks

!["ManualTask"](./ManualTask.svg)

A manual task is a task that is executed without the help of a business process engine or an application.
An example of this could be a customer in a library taking a book off the shelf.

## Require Confirmation

The `evil:requireConfirmation` property controls whether the task waits for explicit user action before completing.

When **enabled**, the Manual Task waits for explicit user confirmation before completing.

When **disabled** (default), the task passes through immediately.
