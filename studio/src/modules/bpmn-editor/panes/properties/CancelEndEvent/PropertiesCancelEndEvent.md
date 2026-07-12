---
title: Cancel End Event
---

# Cancel End Event

![Cancel End Event](CancelEndEvent.svg)

The `Cancel End Event` ends the current path within a Transaction Subprocess and triggers automatic rollback.

## What Happens

1. The Cancel End fires and finishes the current execution path.
2. All other active/waiting activities in the transaction are interrupted.
3. Automatic **LIFO compensation** runs for all completed compensable activities in the transaction scope.
4. The transaction's child process transitions to `cancelled`.
5. The **Cancel Boundary Event** on the transaction shell fires, and the parent process continues.

## Rules

- Only valid inside a `bpmn:transaction` subprocess — the Engine will reject a Cancel End Event placed anywhere else.
- If there is no Cancel Boundary on the transaction shell, the cancellation becomes a hazard and the parent process fatals.
- If compensation runs during cancel and a handler fatals, the transaction hazards (goes fatal) instead of completing the cancel path.

## Relation to Compensation

Compensation during cancel uses the same mechanism as an explicit [Compensate Throw Event](help://bpmn/properties/compensation_intermediate_throw_event). The difference is that Cancel End triggers compensation automatically (broadcast, LIFO), while a Compensate Throw can target a specific activity.
