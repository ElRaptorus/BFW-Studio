---
title: Cancel Boundary Event
---

# Cancel Boundary Event

![Cancel Boundary Event](CancelBoundaryEvent.svg)

The `Cancel Boundary Event` is attached to a Transaction Subprocess shell. It fires when the transaction is cancelled (via a Cancel End Event inside), allowing the parent process to continue on the cancellation path.

## Rules

- Only valid on a `bpmn:transaction` subprocess — the Engine will reject a Cancel Boundary Event attached to any other element.
- Always **interrupting** — there is no non-interrupting variant.
- At most **one** Cancel Boundary per transaction shell.
- The Cancel Boundary has no discriminator (unlike Error Boundaries which match by error code). It catches any cancellation from the transaction.

## Without a Cancel Boundary

If a Cancel End Event fires inside a transaction but there is no Cancel Boundary on the shell, the cancellation is treated as a hazard — the parent process fatals.

## Interaction with Compensation

When the Cancel Boundary fires, the automatic LIFO compensation triggered by the Cancel End has already completed. The token reaching the Cancel Boundary's outgoing flow already reflects the post-compensation state.
