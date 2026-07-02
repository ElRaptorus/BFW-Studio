---
title: Link Intermediate Throw Event
---

# Link Intermediate Throw Event

![Link Intermediate Throw Event](LinkIntermediateThrowEvent.svg)

A `Link Intermediate Throw Event` is the **jump-off point** of a link — a labelled jump inside a single process. Instead of drawing a long Sequence Flow across the diagram, the flow jumps to the [Link Intermediate Catch Event](help://bpmn/properties/link_intermediate-catch_event) that shares the same `Name`. This keeps large models readable.

## Configuration

### Name

The `Name` is **required** and is what pairs a throw with its catch.

## What happens when it runs

A link acts as a real jump in the flow. When this Throw Event is reached:

- if exactly one catch shares its name, the flow continues at that catch;
- if **no** catch matches the name, the element fails;
- if **more than one** catch shares the name, the pairing is ambiguous and the element fails.
