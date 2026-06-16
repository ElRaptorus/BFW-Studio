# manifest-warnings

Fixture plugin with a **valid but imperfect manifest** that produces validation warnings without blocking activation.

## Purpose

Verifies that the manifest validator distinguishes between fatal errors (which block loading) and non-fatal warnings (which allow loading). The plugin must load and activate successfully despite the warnings.

## Activation

Eager — activates on `onStartup`.

## Manifest warnings present

| Warning                                  | Location                    | Why it's non-fatal                                                                 |
| ---------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| Unknown field `futureField`              | `bifrostStudio.futureField` | Forward-compatibility: unknown fields are logged but don't invalidate the manifest |
| Unknown field `alsoUnknown`              | `bifrostStudio.alsoUnknown` | Same as above                                                                      |
| Missing `displayName` in `bifrostStudio` | `bifrostStudio` root        | Optional; falls back to `package.json` top-level `displayName`                     |

## Manifest contributions

| Type         | Details                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| **Commands** | `manifestWarnings.hello` — title: `"Hello with Warnings"`, category: `"Warnings"` |
| **Settings** | `manifestWarnings.verbose` (boolean, default: `false`)                            |

## Registered commands

| Command                  | Behavior                  |
| ------------------------ | ------------------------- |
| `manifestWarnings.hello` | Returns `{ hello: true }` |

## Console output

Logs `[manifest-warnings] activated — despite having warnings` and `[manifest-warnings] deactivated` to stdout.
