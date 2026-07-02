---
title: Parallel Gateway
---

# Parallel Gateway

![Parallel Gateway](ParallelGateway.svg)

The `Parallel Gateway` splits the flow into concurrent paths and joins them back together **without checking any conditions**.

## Splitting

Every outgoing [Sequence Flow](help://bpmn/properties/sequence_flow) is taken, so all paths run at the same time. Any condition on an outgoing flow is **ignored**.

## Merging

The Parallel Gateway waits until **all** of its incoming paths have arrived, then continues as one.

A single Parallel Gateway must not both split and join at the same time (several incoming **and** several outgoing flows). Model the split and the join as two separate gateways.
