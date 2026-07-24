# DMN Overlay Demo

**Test fixture plugin** for exercising and verifying the Studio's DMN Overlay API, element event subscriptions, view awareness, and permission gating.

## What This Plugin Does

### Automatic Overlay Factory (declarative)

Registers an overlay factory via `api.dmn.registerOverlayFactory()` that places
badges/icons/status pills on DRD elements based on their type and requirement
counts (see `index.js` for the exact rules).

### Command-Based Overlays (imperative)

| Command                                        | What it does                                    |
| ---------------------------------------------- | ----------------------------------------------- |
| `DMN Overlay Demo: Set Overlays`               | Places badges/icons on `Decision_Discount`      |
| `DMN Overlay Demo: Set Interactive Overlay`    | Places a clickable badge on `Decision_Discount` |
| `DMN Overlay Demo: Clear Overlays`             | Removes all overlays set by this plugin         |
| `DMN Overlay Demo: Clear Overlays for Element` | Removes overlays for a specific element         |

The imperative overlays target the hardcoded element ID `Decision_Discount`
from `test-solution-dmn/simple-decision.dmn` and `kitchen-sink.dmn`.

### Element Event & View Subscriptions

| Command                                    | What it does                                             |
| ------------------------------------------ | -------------------------------------------------------- |
| `DMN Overlay Demo: Subscribe Selection`    | Subscribes to element selection events on the DRD view   |
| `DMN Overlay Demo: Subscribe View Changed` | Subscribes to active-view changes (DRD ↔ decision table) |
| `DMN Overlay Demo: Get Active View`        | Returns the currently active view                        |
| `DMN Overlay Demo: Get Last Selected`      | Returns the last selected element's data                 |
| `DMN Overlay Demo: Get Last View Changed`  | Returns the last view-changed event                      |
| `DMN Overlay Demo: Get Collected Events`   | Returns all events collected since activation            |

### Diagnostic & Error-Path Commands

| Command                                      | What it does                                                        |
| -------------------------------------------- | ------------------------------------------------------------------- |
| `DMN Overlay Demo: Get Elements`             | Returns all elements on the active DRD                              |
| `DMN Overlay Demo: Get Element Detail`       | Returns detailed info for a specific element                        |
| `DMN Overlay Demo: Get XML`                  | Verifies that `api.dmn.getXml()` returns a string                   |
| `DMN Overlay Demo: Get Click Count`          | Returns how many times the interactive overlay was clicked          |
| `DMN Overlay Demo: Get Factory Call Count`   | Returns how many times the overlay factory was invoked              |
| `DMN Overlay Demo: Is Overlays Set`          | Returns whether imperative overlays are currently active            |
| `DMN Overlay Demo: Set Overlays Missing URI` | Attempts to set overlays on a non-existent document (expects error) |
| `DMN Overlay Demo: Subscribe Missing URI`    | Attempts to subscribe on a non-existent document (expects error)    |

## Permissions

Requires the `dmn` permission.

## Intended Use

This is an **integration test fixture**, not a production plugin.
