---
title: Decision Tables
---

# Decision Tables

A Decision Table maps input conditions to output values using rules. Each row is a rule; each column is either an input or output.

## Hit Policies

| Policy       | Symbol | Description                                                                           |
| ------------ | ------ | ------------------------------------------------------------------------------------- |
| UNIQUE       | U      | At most one rule matches. Error if multiple match.                                    |
| FIRST        | F      | The first matching rule (in order) wins.                                              |
| PRIORITY     | P      | The highest-priority matching rule wins.                                              |
| ANY          | A      | All matching rules must produce the same output.                                      |
| COLLECT      | C      | All matching outputs are collected (with optional aggregation: SUM, MIN, MAX, COUNT). |
| RULE ORDER   | R      | All matching outputs, in rule order.                                                  |
| OUTPUT ORDER | O      | All matching outputs, sorted by output priority.                                      |

## Editing

- Click on a cell to edit its FEEL expression.
- Right-click a column header to add, remove, or reorder columns.
- Right-click a row to add, remove, or reorder rules.
- Use the Properties pane to set Hit Policy (and Aggregation when Hit Policy is COLLECT).
- Configure input/output types and labels on the table column headers, not in Properties.
