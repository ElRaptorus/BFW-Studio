# BPMN Overlay Demo

**Test fixture plugin** for exercising and verifying the Studio's BPMN Overlay API, element event subscriptions, and permission gating.

## What This Plugin Does

### Automatic Overlay Factory (declarative)

Registers an overlay factory via `api.bpmn.registerOverlayFactory()` that places
a **warning badge** on any BPMN element meeting these criteria:

- Has **more than one outgoing sequence flow**
- Is **not** a Gateway (Exclusive, Parallel, Inclusive, etc.)
- Is **not** a SequenceFlow itself

The badge displays the number of outgoing flows and a tooltip:
`"N outgoing flows without gateway"`.

> **Note:** On well-modeled diagrams where all branching goes through gateways,
> this factory produces zero overlays — by design. To see it in action, create
> a Task with two outgoing sequence flows (no gateway in between).

### Command-Based Overlays (imperative)

These overlays are placed on demand via the Search Commands palette. When invoked
from the palette (without arguments), they automatically target the **currently
focused BPMN document**. When called programmatically (e.g. from integration
tests), you can pass an explicit URI as the first argument.

| Command                                         | What it does                                              |
| ----------------------------------------------- | --------------------------------------------------------- |
| `BPMN Overlay Demo: Set Overlays`               | Places a warning badge and an info icon on `StartEvent_1` |
| `BPMN Overlay Demo: Set Interactive Overlay`    | Places a clickable badge on `StartEvent_1`                |
| `BPMN Overlay Demo: Clear Overlays`             | Removes all overlays set by this plugin                   |
| `BPMN Overlay Demo: Clear Overlays for Element` | Removes overlays for a specific element                   |

The imperative overlays target the hardcoded element ID `StartEvent_1`. If your
diagram does not contain an element with that ID, the overlays will not appear
(but no error is shown — the overlay is simply invisible).

### Element Event Subscriptions

| Command                                   | What it does                                                       |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `BPMN Overlay Demo: Subscribe Selection`  | Subscribes to element selection events on the active BPMN document |
| `BPMN Overlay Demo: Get Last Selected`    | Returns the last selected element's data                           |
| `BPMN Overlay Demo: Get Collected Events` | Returns all events collected since activation                      |

### Diagnostic Commands

| Command                                     | What it does                                               |
| ------------------------------------------- | ---------------------------------------------------------- |
| `BPMN Overlay Demo: Get Elements`           | Returns all elements in the active BPMN document           |
| `BPMN Overlay Demo: Get Element Detail`     | Returns detailed info for a specific element               |
| `BPMN Overlay Demo: Get XML`                | Verifies that `api.bpmn.getXml()` returns a string         |
| `BPMN Overlay Demo: Get Click Count`        | Returns how many times the interactive overlay was clicked |
| `BPMN Overlay Demo: Get Factory Call Count` | Returns how many times the overlay factory was invoked     |
| `BPMN Overlay Demo: Is Overlays Set`        | Returns whether imperative overlays are currently active   |

### Error-Path Commands (for testing)

| Command                                       | What it does                                                        |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `BPMN Overlay Demo: Set Overlays Missing URI` | Attempts to set overlays on a non-existent document (expects error) |
| `BPMN Overlay Demo: Subscribe Missing URI`    | Attempts to subscribe on a non-existent document (expects error)    |

## Permissions

Requires the `bpmn` permission (read BPMN element data, subscribe to editor
events, and place overlays on diagram elements).

## Intended Use

This is an **integration test fixture**, not a production plugin. It exercises:

1. The declarative overlay factory pipeline (`registerOverlayFactory`)
2. The imperative overlay API (`setOverlays`, `clearOverlays`)
3. Element event subscriptions (`onElementSelected`)
4. Element data queries (`getElements`, `getElement`, `getXml`)
5. Interactive overlay click handling (`onClickCommand`)
6. Error paths (missing URI, missing elements)
7. Plugin lifecycle cleanup (`deactivate` disposes the factory)
