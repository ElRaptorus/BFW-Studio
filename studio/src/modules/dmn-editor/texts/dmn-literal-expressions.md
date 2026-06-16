---
title: Literal Expressions
---

# Literal Expressions

A Literal Expression is a single FEEL expression that computes the output of a Decision. It is the simplest expression type.

## Usage

1. Select a Decision on the DRD.
2. Set its expression type to "Literal Expression" in the Properties pane.
3. Double-click the Decision to open the expression editor.
4. Write a FEEL expression. The editor provides syntax highlighting and autocompletion.

## Example

```
if Age >= 18 then "Adult" else "Minor"
```

Variables from Input Data and upstream Decisions are available as FEEL context bindings.
