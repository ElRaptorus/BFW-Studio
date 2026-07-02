---
title: Transaction
---

# Transaction

![Transaction](Transaction.svg)

> **Not executed by the current Engine.** You can draw and deploy a Transaction, but the Engine will not run it. Avoid it in executable processes for now.

A `Transaction` is a specialized [Subprocess](help://bpmn/properties/subprocess) whose contained work is meant to either complete as a whole or be cancelled and compensated together. The current Engine does not provide transaction semantics; use an ordinary [Subprocess](help://bpmn/properties/subprocess) with explicit error handling instead.
