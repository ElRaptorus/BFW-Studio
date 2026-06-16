---
title: Multi-Instance Extensions
---

# Multi-Instance Extensions

Additional Multi-Instance loop settings stored as `evil:` extension elements on `multiInstanceLoopCharacteristics`.

## Loop Break Condition

FEEL expression evaluated after each iteration. When it evaluates to `true`, the loop terminates early.

## Loop Interval

ISO 8601 duration between sequential loop iterations (for example `PT5S` for five seconds).

## Max Iterations

Hard cap on the number of iterations as a safety guard.
