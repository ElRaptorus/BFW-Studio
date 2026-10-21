# BPMN Process Landscape

---

## Overview

`studio/src/modules/bpmn-landscape/` holds process landscape maps: `.bfwmap` files in the solution that place processes, groups and notes on a canvas and show how the processes relate. A map stores which processes it shows and where; relations between processes are derived from the solution scan and never stored. The process catalog is `scanSolutionBpmnModels` in `bpmn-core` ([modules.md](modules.md) §bpmn-core). The module has no entry point yet; nothing loads it, and the editor, page and panes are not registered.

---

## Architecture

```
scanSolutionBpmnModels (bpmn-core, cached, worker)
        │ SolutionBpmnModelEntry[]
        ▼
buildProcessRelations ──► ProcessRelation[]   (derived, never saved)
                                │ key
.bfwmap ◄─► LandscapeMapFile ──►│ hiddenRelations, relationLayers
```

### Process Relations

#### buildProcessRelations

**Path:** `studio/src/modules/bpmn-landscape/buildProcessRelations.ts`

`buildProcessRelations(entries)` turns the processes of every `bpmn` scan entry into directed relations. A process is a `LandscapeProcessReference` `{ uri, processId }`, so the same id in two files stays two processes.

| Kind | Source → target | Rule |
|---|---|---|
| `callActivity` | caller → called process | A call activity's `calledElement` equals the process id; one relation per process pair, with every call activity id in `sourceFlowNodeIds`. An id defined in several files yields one relation per file; an unknown id yields none. |
| `message` | sender → receiver | A name in `thrownMessages` of one process equals a name in `caughtMessages` of another; one relation per pair and name. |
| `signal` | thrower → catcher | Same as `message` with `thrownSignals` / `caughtSignals`; a signal and a message of the same name never match. |

- **Name matching:** by the resolved `<bpmn:message>` / `<bpmn:signal>` name, the routing key the Engine uses. A message relation means "can send"; correlation is not known at design time.
- **Self-relations** are left out, because they never connect two map elements.
- **`key`:** `<kind>:<source process id>:<target process id>` plus `:<name>` for messages and signals. `hiddenRelations` stores it. Processes with the same id in different files share a key.
- **Order:** by key, then source and target URI.

### Map File Format

#### LandscapeMapFile

**Path:** `studio/src/modules/bpmn-landscape/LandscapeMapFile.ts`

`.bfwmap` is JSON. `parseLandscapeMap(text)` returns `{ ok: true, map }` or `{ ok: false, errors }` with every problem as a diagnostic sentence naming the element; it never throws. `serializeLandscapeMap(map)` writes a fixed key order, two-space indentation and a trailing newline. `createEmptyLandscapeMap(name)` returns a map without levels, elements or connectors and every relation layer on.

```json
{
  "format": "bfw-landscape-map",
  "version": 1,
  "name": "Order to Cash",
  "levels": [{ "id": "level-domain", "name": "Domain" }],
  "relationLayers": { "callActivity": true, "message": true, "signal": true },
  "elements": [
    { "id": "sales", "type": "group", "parentId": null, "label": "Sales", "collapsed": false, "x": 0, "y": 0, "width": 400, "height": 200 },
    { "id": "order", "type": "process", "parentId": "sales", "processId": "order-process", "fileHint": "processes/order.bpmn", "label": null, "shape": "box", "x": 20, "y": 40, "width": 160, "height": 60 }
  ],
  "connectors": [],
  "hiddenRelations": ["message:order-process:billing-process:InvoiceRequested"]
}
```

| Top-level key | Required | Meaning |
|---|---|---|
| `format`, `version` | yes | `"bfw-landscape-map"`, `1`. A higher version is rejected with a hint to update the Studio. |
| `name` | yes | Map title |
| `levels` | no (`[]`) | `{ id, name }`; `levels[depth]` names the groups at that nesting depth |
| `relationLayers` | no (all `true`) | Visibility of `callActivity`, `message`, `signal` relations |
| `elements` | no (`[]`) | See below |
| `connectors` | no (`[]`) | Manual links `{ id, sourceId, targetId, label, waypoints: [{ x, y }] }` between two different elements |
| `hiddenRelations` | no (`[]`) | `ProcessRelation.key` values the user hid |
| any other key | — | Kept in `unknownProperties` and written back after the known keys |

Every element has `id`, `type`, `parentId` (a band or group, or `null`), `x`, `y`, `width` and `height` (both greater than 0), and an optional `style` `{ fill, stroke }`.

| `type` | Extra fields |
|---|---|
| `band` | `label`; always top level |
| `group` | `label`, `collapsed` (default `false`) |
| `process` | `processId`, `fileHint` (BPMN file relative to the map, or `null`), `label` (`null` shows the process name), `shape` (`box` or `chevron`, default `box`) |
| `placeholder` | `label`, `shape`; a process that is not modelled |
| `mapLink` | `label`, `mapPath` (`.bfwmap` relative to the map) |
| `note` | `text` |

Validation also rejects: an id used twice across elements and connectors; a process id shown twice; a parent that is missing or not a band or group; nesting cycles; a connector to a missing element or to its own source; `fileHint` or `mapPath` that is absolute, a drive path or a URI.

---

## File Path Reference

| Component | Path |
|---|---|
| Relation derivation | `studio/src/modules/bpmn-landscape/buildProcessRelations.ts` |
| Map file format | `studio/src/modules/bpmn-landscape/LandscapeMapFile.ts` |
| Solution scan | `studio/src/modules/bpmn-core/scanSolutionBpmnModels.ts` |
| Scan parsing (worker side) | `studio/src/modules/bpmn-core/parseSolutionBpmnModel.ts`, `bpmn-model-scan-worker.ts` |
| Unit tests | `studio/test/unit/bpmn-landscape/`, `studio/test/unit/bpmn-core/scanSolutionBpmnModels.test.ts` |
