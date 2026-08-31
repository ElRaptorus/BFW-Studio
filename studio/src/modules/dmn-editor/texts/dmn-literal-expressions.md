---
title: Literal Expressions
---

# Literal Expressions

A Literal Expression is a single FEEL expression that computes the output of a Decision. It is the simplest expression type.

## Usage

1. Select a Decision on the DRD.
2. Double-click the Decision to open its expression view (use the view switcher if the Decision currently uses a table or boxed expression).
3. Write a FEEL expression. The editor provides syntax highlighting and autocompletion.
4. Output Type is editable in the Properties pane while the literal view is open.

## Example

```
if Age >= 18 then "Adult" else "Minor"
```

Variables from Input Data and upstream Decisions are available as FEEL context bindings.
