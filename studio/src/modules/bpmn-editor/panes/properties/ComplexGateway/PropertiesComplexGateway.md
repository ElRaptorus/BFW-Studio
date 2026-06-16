---
# This is a comment, which might be helpful to explain the concept of help texts
title: Complex Gateway
---

# Complex Gateway

![Complex Gateway](ComplexGateway.svg)

With the `Complex Gateway` it is possible to model complex synchronization behavior.
The `Complex Gateway` has, in deference to other `Gateway`s, an internal state.
This state holds the information `waitForStart`, which is a boolean and initially `true`.
When the Gateway is activated once, the boolean is set to `false`.
This can be used in the description of the behavior, which is configured by the `Expression Activation Condition`.
In this `Expression` it is possible to describe which of the outgoing `Sequence Flow` are activated by forward a `Token` in the first arrival of an incoming `Token`.
With the usage of the internal state, it is possible to design a different behavior when another `Token` arrives at the `Complex Gateway`.
The synchronisation semantic of the `Complex Gateway` is like the semantics of the `Inclusive Gateway`.
