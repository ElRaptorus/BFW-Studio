---
# This is a comment, which might be helpful to explain the concept of help texts
title: Transaction
---

# Transaction

![Transaction](Transaction.svg)

The `Transaction` is a specialized [Subprocess](help://bpmn/properties/subprocess) which ensured that all process members should be completed or canceled.
This will be guaranteed by a so called `Transaction Protocol`, which verifies that all the `Participants` have successfully completed their work.
If in this verification it comes up, that one `Participant` ended with a `Cancel` or `Error` the flow will move to an appropriate `Intermediate Event` like a `Compensation` or `Error Catch Event`.
