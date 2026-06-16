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

Select a Decision, then choose the desired expression type from the Properties pane. The editor will switch to the appropriate view for editing.
