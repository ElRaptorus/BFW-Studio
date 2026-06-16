# manifest-errors

Fixture plugin that tests **manifest validation error handling**. Its manifest contains structural errors that must prevent the plugin from loading.

## Purpose

Verifies that the `ContributionRegistrar` rejects manifests with fatal validation errors and marks the plugin as `failed` instead of loading it. The plugin's `activate()` function throws unconditionally — if it ever runs, the validation gate has a bug.

## Manifest errors present

| Error                      | Location                          | Why it's fatal                                                          |
| -------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| Missing `apiVersion`       | `bifrostStudio` root              | Required field; without it the plugin cannot be version-checked         |
| Missing `activationEvents` | `bifrostStudio` root              | Required field; the Plugin Host cannot determine when to activate       |
| Missing `id` on command    | `contributes.commands[0]`         | Commands require an `id` to be registerable                             |
| Invalid `when` condition   | `contributes.keybindings[0].when` | `"invalidCondition"` is not in the `KeybindingWhenCondition` vocabulary |

## Expected behavior

- Plugin appears in the Plugins pane with status `failed` and error details.
- `activate()` is **never** called.
- Valid contributions in the same manifest (e.g., the second command with a valid `id`) are **not** registered — the entire manifest is rejected.

## Registered commands

None — the plugin is never activated.
