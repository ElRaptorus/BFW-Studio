---
title: Link Intermediate Catch Event
---

# Link Intermediate Catch Event

![Link Intermediate Catch Event](LinkIntermediateCatchEvent.svg)

A `Link Intermediate Catch Event` is the **landing point** of a link — a labelled jump inside a single process. It lets you connect two places in the same process without drawing a long Sequence Flow across the diagram, which keeps large models readable.

When a [Link Intermediate Throw Event](help://bpmn/properties/link_intermediate-throw_event) with a matching `Name` is reached, the flow continues here.

## Configuration

### Name

The `Name` is **required** and is what pairs a throw with its catch. Every catch within a process must have a unique `Name`.

## What happens when it runs

A link acts as a real jump in the flow. When a Throw Event is reached:

- if exactly one catch shares its name, the flow continues at that catch;
- if **no** catch matches the name, the element fails;
- if **more than one** catch shares the name, the pairing is ambiguous and the element fails.
