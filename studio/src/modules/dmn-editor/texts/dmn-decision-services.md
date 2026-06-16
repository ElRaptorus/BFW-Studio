---
title: Decision Services
---

# Decision Services

A Decision Service defines a subset of a DRD that can be invoked as a single unit. It exposes output decisions while encapsulating internal logic.

## Structure

A Decision Service contains:

- **Output Decisions** — The decisions whose results are returned when the service is invoked.
- **Encapsulated Decisions** — Internal decisions that are part of the service logic but not directly exposed.
- **Input Decisions** — External decisions that the service depends on (provided by the caller).
- **Input Data** — External input data required by the service.

## Usage

1. Add a Decision Service element to the DRD canvas.
2. Drag decisions into the appropriate compartment (output or encapsulated).
3. The service automatically identifies required input decisions and input data.
