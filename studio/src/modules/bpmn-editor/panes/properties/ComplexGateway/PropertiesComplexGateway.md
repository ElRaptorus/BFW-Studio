---
title: Complex Gateway
---

# Complex Gateway

![Complex Gateway](ComplexGateway.svg)

The `Complex Gateway` handles advanced branching and merging that the simpler gateways cannot express. Here it has a precise, predictable behavior: it is either a **conditional split** or a **threshold join** (for example, "continue as soon as 2 of 3 approvals arrive").

> **Not portable.** This exact behavior is specific to this platform. A model that relies on it will not behave the same way in other BPMN tools. If you need a portable model, use an [Inclusive Gateway](help://bpmn/properties/inclusive_gateway) instead.

A Complex Gateway must be **either** a split (one incoming path, several outgoing) **or** a join (several incoming paths, one outgoing) — never both at once. Model splitting and joining as two separate gateways.

## As a split

The gateway checks the condition on every outgoing [Conditional Flow](help://bpmn/properties/conditional_flow) and follows every path whose condition is true.

- Every **non-default** outgoing path must carry a condition. An unmarked non-default path is a modeling error: the linter warns in development and errors in production-ready, and the engine fatals the gateway at runtime if a token actually reaches it. The diagram still deploys (WIP is allowed); mixed gateways, a join without an Activation Condition, and overlapping SESE regions are still rejected before deployment.
- If one or more conditions are true, all matching paths run at once.
- If no condition is true, the Default Flow is taken.
- If no condition is true and there is no Default Flow, the process stops with an error.

## As a threshold join

The join waits for its incoming paths and continues **once**, the moment its `Activation Condition` becomes true. You decide how many paths must arrive first.

### Activation Condition

The `Activation Condition` is a [formula](help://bpmn/runtime_expressions) and is **required** for a join. In addition to the usual process data, it can use two counters:

- `activatedCount` — how many incoming paths have arrived so far.
- `incomingCount` — the total number of incoming paths.

Common examples:

- `activatedCount >= 2` — continue as soon as any 2 paths arrive.
- `activatedCount = incomingCount` — wait for every path.
- `activatedCount >= 2 and token.approved = true` — a count plus a data check.

The join continues as soon as the condition is true. If it can never become true — because every path has already arrived without meeting it — the process stops with an error rather than waiting forever.

When the join continues, any paths that were still running (and were opened by the matching split) are cancelled so nothing is left dangling.

## At a glance

| Situation                                                | Result                                           |
| -------------------------------------------------------- | ------------------------------------------------ |
| Both several incoming and several outgoing paths         | Rejected before deployment                       |
| A split path that is neither conditional nor the default | Linter warning/error; runtime fatal when entered |
| A join without an `Activation Condition`                 | Rejected before deployment                       |
| A split where nothing matches and there is no default    | Process stops with an error                      |
| A join whose condition can never be met                  | Process stops with an error                      |
