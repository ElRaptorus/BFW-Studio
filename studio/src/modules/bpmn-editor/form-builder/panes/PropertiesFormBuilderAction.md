---
title: Form Builder — Action Properties
---

# Action Properties

This pane shows the properties of the currently selected form action in the Form Builder.

Form actions define the buttons displayed at the bottom of the rendered form.

## Action ID

A unique identifier for the action. A submitting action sends this id as `actionId`. An aborting action sends it as the cancel reason. The label is display text only.

## Label

The text displayed on the button.

## Preset

A predefined action template. Presets provide sensible defaults:

| Preset  | Default Label | Effect  | Other               |
| ------- | ------------- | ------- | ------------------- |
| Confirm | Confirm       | Submit  | Primary styling     |
| OK      | OK            | Submit  | Primary styling     |
| Yes     | Yes           | Submit  |                     |
| No      | No            | Submit  | Skips validation    |
| Cancel  | Cancel        | Dismiss |                     |
| Abort   | Abort         | Abort   | Destructive styling |
| Custom  | Custom        | Submit  |                     |

Changing the preset in the dropdown changes only the stored preset name. The toolbox buttons apply the defaults above.

## Effect

- **Submits User Task** finishes the task with the field values and this action's id.
- **Closes Form Only** closes the form. It does not contact the Engine.
- **Cancels User Task** cancels the task after a confirmation. That aborts the whole process instance tree.

## Skips validation

Shown only for a submitting action. When enabled, the fields are collected without required or pattern checks.

## Default (primary styling)

Marks this action as the primary button. Enter activates the first default action that submits. Primary actions receive highlighted styling.

## Danger (destructive styling)

When enabled, the button uses destructive styling. This is appearance only and does not change the effect.
