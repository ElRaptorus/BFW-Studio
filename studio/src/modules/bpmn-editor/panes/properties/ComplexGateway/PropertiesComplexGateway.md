---
# This is a comment, which might be helpful to explain the concept of help texts
title: Complex Gateway
---

# Complex Gateway

![Complex Gateway](ComplexGateway.svg)

The `Complex Gateway` is the engine's **opinionated, deterministic** take on the BPMN 2.0 Complex Gateway. Where the specification leaves the element under-defined, the engine gives it a precise contract: a **conditional split** that forbids accidental unconditional fan-out, and a single-fire **threshold join** that fires as soon as a FEEL `Activation Condition` becomes true (for example "proceed as soon as 2 of 3 approvals arrive").

> **Not portable BPMN.** These semantics are specific to this engine. A model relying on the behaviour below will **not** behave the same way on other BPMN engines. If you need a portable model, use an [Inclusive Gateway](help://bpmn/properties/inclusive_gateway) instead.

A `Complex Gateway` must be **either** a split (one incoming, many outgoing) **or** a join (many incoming, one outgoing). A gateway with both multiple incoming and multiple outgoing [Sequence Flows](help://bpmn/properties/sequence_flow) is a _mixed_ gateway and is **rejected at deploy time** (`complex_gateway_mixed`). Model splitting and joining as two separate nodes.

## Complex Split (diverging)

A split has one incoming and multiple outgoing flows. It evaluates **all** outgoing [Conditional Flows](help://bpmn/properties/conditional_flow) and activates every path whose condition is truthy — like an Inclusive split, but with one crucial difference: **there is no unconditional fall-through**.

- **Every outgoing flow must carry a condition OR be the [Default Flow](help://bpmn/properties/default_flow).** An unconditional, non-default flow is **rejected at deploy time** (`complex_gateway_unconditional_flow`).
- If one or more conditions are truthy, all matching paths are taken (tokens are forked).
- If no condition is truthy and a default flow exists, only the default flow is taken.
- If no condition is truthy and there is **no** default flow, the process instance fails at runtime (`complex_split_no_matching_condition`).
- If a condition expression fails to evaluate, the process instance fails at runtime (`complex_split_condition_failed`).

## Complex Join (converging) — threshold join

A join waits for tokens from its incoming branches and fires **once**, the moment its `Activation Condition` becomes `true`. This is a **threshold** (quorum) join: you decide, in FEEL, how many branches must arrive before the process continues.

### Activation Condition

The join's fire rule lives in the `Activation Condition` FEEL expression (persisted as the standard `<bpmn:activationCondition>` element). It is **required** for a join — deploying a join without one is rejected (`complex_gateway_join_missing_activation_condition`).

In addition to the usual bindings (`token`, `context`, `dataObjects`, `process`, `processInstance`, `identity`), the expression receives two special counters:

- `activatedCount` — how many incoming branches have delivered a token **so far**.
- `incomingCount` — the total number of incoming sequence flows into the join.

During evaluation, `token` is the **merge of all branch payloads that have arrived so far** (last-wins per key), so data-driven conditions are possible. Common patterns:

- `activatedCount >= 2` — fire as soon as any 2 branches arrive (2-of-N quorum).
- `activatedCount = incomingCount` — wait for every branch (a strict join).
- `activatedCount >= 2 and token.approved = true` — quorum plus a data check.

### Fire, wait, or fail

The engine re-evaluates the join on **every token arrival** and after **every flow node state change**:

1. **Fire** — the condition is `true`. The join merges the arrived payloads and continues along its single outgoing flow. This happens exactly once.
2. **Wait** — the condition is `false` but at least one branch could still deliver a token.
3. **Fail (Twist 1)** — the condition is `false` **and** every incoming branch has already arrived or is now dead, so the threshold can never be met. The join fails at runtime (`complex_join_condition_unmet`). This makes an impossible quorum fail loudly instead of leaving the process stuck forever.

If the `Activation Condition` itself throws while evaluating, the join fails at runtime (`complex_join_condition_failed`).

## Scoped cancellation (Twist 2)

When a threshold join fires, the branches that lost the race may still be running. The winning fire **cancels the losing branches** so nothing is left dangling. This cancellation is **scoped**: it only touches work that lives **between the Complex Split that opened the branches and the Complex Join that closes them** — a single-entry / single-exit (SESE) region. Work elsewhere in the process is untouched, and process-wide message/signal subscriptions are left intact.

Every Complex Join is paired with exactly one dominating Complex Split, and this pairing is checked at deploy time. A model is rejected if:

- the join has no Complex Split above it (`complex_join_no_paired_split`);
- a branch escapes the region other than through the split (entry) or join (exit) (`complex_region_cross_boundary`);
- two regions partially overlap instead of being disjoint or fully nested (`complex_region_overlap`).

Cancelled activities run their normal cleanup (subscriptions removed, timers stopped, child processes aborted) and are recorded as `interrupted` with the reason `cancelled_by_complex_join`. Nested regions are respected: an inner join cancels only its own inner region.

## Constraints at a glance

| Situation                                              | Result        | When                                                                                               |
| ------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------- |
| Both >1 incoming and >1 outgoing (mixed)               | Rejected      | Deploy (`complex_gateway_mixed`)                                                                   |
| Split flow neither conditional nor default             | Rejected      | Deploy (`complex_gateway_unconditional_flow`)                                                      |
| Join without an `Activation Condition`                 | Rejected      | Deploy (`complex_gateway_join_missing_activation_condition`)                                       |
| Join with no paired split / leaky / overlapping region | Rejected      | Deploy (`complex_join_no_paired_split`, `complex_region_cross_boundary`, `complex_region_overlap`) |
| Split: no truthy condition and no default              | Process fails | Runtime (`complex_split_no_matching_condition`)                                                    |
| Join: threshold can never be met                       | Process fails | Runtime (`complex_join_condition_unmet`)                                                           |

A Complex Join is **not a valid retry checkpoint** — retry from an upstream task or the process start instead.
