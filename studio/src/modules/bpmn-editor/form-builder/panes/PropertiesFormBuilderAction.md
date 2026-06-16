---
title: Form Builder — Action Properties
---

# Action Properties

This pane shows the properties of the currently selected form action in the Form Builder.

Form actions define the buttons displayed at the bottom of the rendered form. They determine how the user can interact with and submit the form at runtime.

## Action ID

A unique identifier for the action. This ID is included in the form submission payload so the engine and downstream handlers know which button the user clicked.

## Label

The text displayed on the button.

## Preset

A predefined action template. Presets provide sensible defaults:

| Preset  | Default Label | Submits Form | Default Styling |
| ------- | ------------- | ------------ | --------------- |
| Confirm | Confirm       | Yes          | Primary         |
| OK      | OK            | Yes          | Primary         |
| Yes     | Yes           | Yes          | Normal          |
| No      | No            | No           | Normal          |
| Cancel  | Cancel        | No           | Normal          |
| Custom  | Custom        | Yes          | Normal          |

Changing the preset updates the action's defaults but you can override any property afterwards.

## Submits Form

When enabled, clicking this action button triggers `finishUserTask` on the engine, submitting the collected form data. When disabled, the action fires without submitting — useful for "Cancel" or "Reset" scenarios.

## Default (primary styling)

Marks this action as the primary/default button. Only one action should have this flag set. Primary actions receive highlighted styling to draw the user's attention.

## Danger (destructive styling)

When enabled, the button is styled with a destructive/warning appearance (typically red) to indicate an irreversible or high-impact operation.
