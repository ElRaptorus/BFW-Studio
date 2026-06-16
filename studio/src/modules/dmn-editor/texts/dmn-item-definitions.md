---
title: Item Definitions
---

# Item Definitions

Item Definitions define the data types used throughout your DMN model. They can be simple types (referencing FEEL built-in types) or composite types with multiple components.

## Simple Types

A simple Item Definition references a FEEL type: `string`, `number`, `boolean`, `date`, `time`, `dateTime`, `duration`.

Optional `allowedValues` constraints can restrict the valid values (e.g., `> 0`, `"low", "medium", "high"`).

## Composite Types

A composite Item Definition contains `itemComponent` children, each of which is itself an Item Definition. This allows modeling structured data (like records or objects).

## Usage

1. Open the Item Definitions pane in the Properties panel.
2. Add, edit, or remove type definitions.
3. Reference them from Decision variables, Input Data variables, and BKM parameters via `typeRef`.
