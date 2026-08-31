---
title: Boxed Expressions
---

# Boxed Expressions

DMN CL3 boxed expressions provide structured computation patterns beyond simple decision tables and literal expressions.

## Supported Types

| Type                    | Description                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Context**             | A set of named entries (key-value pairs), where each value is itself an expression. |
| **Invocation**          | Calls a Business Knowledge Model with bound parameters.                             |
| **List**                | An ordered collection of expressions.                                               |
| **Relation**            | A table of named columns (like a mini-database).                                    |
| **Conditional**         | If-then-else branching.                                                             |
| **Filter**              | Filters a list using a boolean expression.                                          |
| **For**                 | Iterates over a list, producing a new list.                                         |
| **Every / Some**        | Quantified expressions (universal/existential).                                     |
| **Function Definition** | Defines a reusable function with formal parameters.                                 |

## Usage

Double-click a Decision (or BKM) to open its expression view. The view switcher at the top of the editor selects table, literal, or boxed editing — not the Properties pane. Boxed structure (context entries, invocations, and so on) is edited on the canvas.
