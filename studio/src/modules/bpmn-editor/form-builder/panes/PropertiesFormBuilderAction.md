---
title: Form Builder — Action Properties
---

# Action Properties

This pane shows the basic properties of the currently selected form action in the Form Builder. Form actions are the buttons displayed at the bottom of the rendered form. What a button does is set in the **Behavior** pane; how it looks is set in the **Design** pane.

## Action ID

A unique identifier for the action. A submitting action sends this id as `actionId`. An aborting action sends it as the cancel reason. The label is display text only.

The field only accepts an id that is not blank, has at most 255 characters, and is not used by another action of the same form. While the typed value is invalid, the stored id stays unchanged; leaving the field restores it.

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

# Behavior

This pane sets what happens when the user presses the selected form action.

## Effect

- **Submits User Task** finishes the task with the field values and this action's id.
- **Closes Form Only** closes the form. It does not contact the Engine.
- **Cancels User Task** cancels the task after a confirmation. That aborts the whole process instance tree.

## Skips validation

Shown only for a submitting action. When enabled, the fields are collected without required or pattern checks.

# Design

This pane sets how the selected form action looks. Styling does not change what the button does.

## Default (primary styling)

Marks this action as the primary button. Enter activates the first default action that submits. Primary actions receive highlighted styling.

## Danger (destructive styling)

When enabled, the button uses destructive styling.
