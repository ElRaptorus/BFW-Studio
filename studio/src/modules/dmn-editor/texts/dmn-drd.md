---
title: Decision Requirements Diagram
---

# Decision Requirements Diagram (DRD)

The DRD is the visual canvas of a DMN model. It shows the dependencies between decisions, input data, and knowledge sources.

## Element Types

| Element                      | Description                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------- |
| **Decision**                 | A business decision that produces an output based on inputs and logic.          |
| **Input Data**               | External data that feeds into decisions.                                        |
| **Business Knowledge Model** | Reusable decision logic (functions) that can be invoked by decisions.           |
| **Knowledge Source**         | An authority or reference for a decision (non-executable, documentary).         |
| **Decision Service**         | A published subset of a DRD, exposing selected decisions as a callable service. |

## Connections

- **Information Requirement** — A Decision depends on another Decision or Input Data.
- **Knowledge Requirement** — A Decision or BKM invokes a BKM.
- **Authority Requirement** — A governance link to a Knowledge Source.

## Navigation

- Pan: Click and drag on empty canvas.
- Zoom: Scroll wheel or toolbar buttons.
- Select: Click on an element. Shift+click for multi-select.
- Edit expression: Double-click a Decision.
