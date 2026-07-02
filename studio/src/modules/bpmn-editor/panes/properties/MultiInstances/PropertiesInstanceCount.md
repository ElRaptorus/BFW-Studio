---
title: Instance Count (Loop Cardinality)
---

# Instance Count (Loop Cardinality)

> **Not executed by the current Engine.** You can draw and deploy Multi-Instance loops, but the Engine will not run them. Avoid them in executable processes for now.

The `Instance Count` (also called loop cardinality) sets how many rounds a Multi-Instance activity runs. It accepts a whole number, or a [formula](help://bpmn/runtime_expressions) that works one out.

## Usage

Provide a fixed number or a formula that resolves to a positive whole number.

**Fixed count:**

```feel
5
```

**A count worked out from the process data:**

```feel
count(token.items)
```

## Interaction with Input Collection

You can set Instance Count, an [Input Collection](help://bpmn/properties/multi_instance_input), or both. When only one is set, it alone determines the number of instances. When both are set, the intended meaning is that every collection item is still processed while Instance Count bounds how many run at once — treat combining the two as advanced usage.
