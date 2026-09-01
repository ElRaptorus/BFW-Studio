---
title: Item Definitions
---

# Item Definitions

Item Definitions define the data types used throughout your DMN model. They can be simple types (referencing FEEL built-in types) or composite types with multiple components.

## Simple Types

A simple Item Definition references a FEEL built-in type: `string`, `number`, `boolean`, `date`, `time`, `dateTime`, `dayTimeDuration`, `yearMonthDuration`, or `Any`.

Optional `allowedValues` constraints can restrict the valid values (e.g., `> 0`, `"low", "medium", "high"`).

## Composite Types

A composite Item Definition contains `itemComponent` children, each of which is itself an Item Definition. This allows modeling structured data (like records or objects).

## Usage

1. Open the Item Definitions pane in the Scripts panel (empty canvas / no DRG element selected).
2. Add, edit, or remove type definitions. Simple types pick from the Type field (FEEL builtins plus other Item Definition names, or free text).
3. Reference them from Decision Output Type, Input Data Type, BKM Output Type, and Literal Expression Output Type — those fields offer the same catalog. Table column Type menus stay on the decision-table headers (builtins only).
