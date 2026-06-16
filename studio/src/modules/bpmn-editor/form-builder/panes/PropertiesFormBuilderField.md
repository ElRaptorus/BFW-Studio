---
title: Form Builder — Field Properties
---

# Field Properties

This pane shows the properties of the currently selected form field in the Form Builder.

## Field ID

A unique identifier for the field within the form. This ID is used as the key in the form data payload when the form is submitted.

## Type

The field type determines how the field is rendered at runtime. Available types:

| Type           | Description                        |
| -------------- | ---------------------------------- |
| Text           | Single-line text input             |
| Number         | Numeric input                      |
| Date           | Date picker                        |
| Checkbox       | Multiple-choice checkboxes         |
| Dropdown       | Single-choice select menu          |
| Radio Group    | Single-choice radio buttons        |
| Multi-line     | Multi-line textarea                |
| File Upload    | File attachment                    |
| Toggle         | On/off boolean switch              |
| Section Header | Decorative heading (no data value) |

## Required

When enabled, the field must have a non-empty value before the form can be submitted. Section Headers do not support this property.

## Placeholder

Hint text displayed inside the field when it is empty.

## Default Value

Pre-filled value when the form is first shown to the user.

## Pattern (regex)

A regular expression pattern the field value must match for the form to be considered valid. Leave empty to skip pattern validation.

## Hint

A short explanatory text displayed below the field to guide the user.

## Options (Select, Radio, Checkbox)

For choice-based field types, define the available options. Each option has:

- **Value** — the machine-readable key submitted with the form data
- **Label** — the human-readable text shown to the user
