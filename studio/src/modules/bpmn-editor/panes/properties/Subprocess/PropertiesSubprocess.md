---
# This is a comment, which might be helpful to explain the concept of help texts
title: Subprocess
---

# Subprocess

![Subprocess](Subprocess.svg)

A `Subprocess` is a `Process` that is encapsulated into an `Activity`.
The `Process` in the `Subprocess` is modeled like a normal `Process` with `Activities`, `Gateways`, `Events` and `Sequence Flows`.
If the `Subprocess` is instantiated, its containing `Elements` behave like in a normal `Process`.
The `Subprocess` is completed when all tokens inside the instance are consumed or an `Event` end the `Process` abnormally.
