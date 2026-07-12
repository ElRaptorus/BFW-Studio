---
title: Transaction
---

# Transaction

![Transaction](Transaction.svg)

A `Transaction` is a specialized [Subprocess](help://bpmn/properties/subprocess) that adds **all-or-nothing** semantics to a group of activities.

## Three Outcomes

| Outcome     | Trigger                                         | Result                                                                          |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| **Success** | All paths reach end events normally             | Transaction completes, Cancel Boundary is NOT fired                             |
| **Cancel**  | A Cancel End Event fires inside the transaction | Automatic LIFO compensation of completed activities, then Cancel Boundary fires |
| **Hazard**  | An uncaught error propagates out                | Transaction fatals — compensation does NOT run automatically                    |

## Key Points

- Completed activities with Compensation Boundaries are reversed automatically (LIFO) when a Cancel End Event fires.
- A [Cancel Boundary Event](help://bpmn/properties/cancel_boundary_event) on the shell is required to catch the cancellation in the parent process.
- The `method` attribute (e.g. `##WSAtomicTransaction`) is parsed but not executed — the Engine uses saga-pattern compensation.
- Nested transactions are not supported.

## Retry

A cancelled transaction child process is **not retryable**. Retry from the Transaction shell or upstream.
