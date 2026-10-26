# Plugin Landscape Map Enrichment

Plugins can extend the landscape map editor (`.bfwmap`) through the `api.landscape` namespace, with the same tiered permission model as BPMN and DMN. This document mirrors [plugin-dmn-enrichment.md](plugin-dmn-enrichment.md); only the landscape-specific differences (plane-scoped overlays, derived relation lines, absolute element creation) are called out. Method signatures live in `studio-sdk/src/plugin-api/LandscapeApi.ts`; the editor itself is described in [bpmn-landscape.md](bpmn-landscape.md).

## Permission Model

```
landscape (low risk)
 └── landscape.modelling (medium risk)
      └── landscape.renderer (high risk)
```

| Permission | Capabilities |
|---|---|
| `landscape` | Read elements and the map text, subscribe to events, place overlays, register an overlay factory |
| `landscape.modelling` | All of `landscape` + `api.landscape.modeling.*`, palette and context pad entries (manifest and runtime) |
| `landscape.renderer` | All of `landscape.modelling` + inject diagram-js modules, the renderer-module message channel |

`PERMISSION_HIERARCHY` (`bifrost/common/plugin-host/permissions/PermissionTypes.ts`) expands a declared tier to the lower ones. `PluginHostBridge.executeApiRequest` gates `registerPaletteEntry`, `unregisterPaletteEntry`, `registerContextPadEntry`, `unregisterContextPadEntry`, `updateContextPadEntry` and every `modeling.*` call on `.modelling`, and `postToRendererModule` on `.renderer`. The command `bpmn.landscape.modeler.registerModule` is gated on `landscape.renderer` in `CommandDenylist`; every other `bpmn.landscape.*` command needs `commands.bpmn`.

## Scope: the plane on screen

A map is one diagram-js root plus one plane root per collapsed group (see [bpmn-landscape.md](bpmn-landscape.md) §Hierarchy). Queries cover the whole map; overlays cover only what is on screen.

| Operation | Scope |
|---|---|
| `getElements(uri)`, `getElement(uri, id)` | Every element of the map, whatever plane is on screen. Relation lines are those drawn on the plane on screen. Both return `null` / `[]` for a map that is not open. |
| Overlay factory `context.elements` | The elements of the plane on screen (`snapshotLandscapeElements(modeler, uri, 'plane')`) |
| `setOverlays` / `clearOverlays` | Rendered on the plane on screen, and applied again when a plane change brings the element back |
| `modeling.*` | The whole map, through the command stack (undoable). Relation lines, the root and unknown ids are refused with a diagnostic message. |

Element snapshots (`LandscapeElementSnapshot`) are built in `modules/bpmn-landscape/plugin-api/landscapeSnapshots.ts`: `LandscapeShapeSnapshot` (band, group, process, placeholder, mapLink, note, with bounds, label, text, `processId`, `fileHint`, `mapUri`, style, `shape`, `collapsed`), `LandscapeConnectorSnapshot` and `LandscapeRelationSnapshot` (`kind`, `name`, `sourceElementId`, `targetElementId`). Relation lines are derived from the solution and never saved, so a plugin cannot create, move or delete one.

## Bridge

**Path:** `studio/src/modules/bpmn-landscape/plugin-api/`

| File | Purpose |
|---|---|
| `LandscapeApiBridge.ts` | `PluginApiNamespace` for `landscape`, registered by `bpmn-landscape/index.tsx` through `bifrost.plugins.registerApiNamespace`. Handles `setOverlays`, `clearOverlays`, `getElements`, `getElement`, `getXml`, `requestOverlayRefresh`, the palette and context pad methods, `postToRendererModule`, the modeling calls and the event subscriptions (`onElementSelected` / `Hover` / `DoubleClick` / `ContextMenu`, `onOverlayContextChanged`, `onRendererModuleMessage`). |
| `LandscapeModelingOperations.ts` | The modeling calls on the model's modeler: `createElement` creates at an absolute position (the top-left corner) inside the smallest open group or band that contains it; `appendElement` creates below an element and connects the two; `createConnection` asks the `connection.start` rule and the connection rules; `moveElement` takes a finite delta. |
| `landscapeSnapshots.ts` | Element snapshots for the API and for the overlay factory context |
| `landscapePluginModules.ts` | `landscapeModelerModuleRegistry` (a `BpmnModelerModuleRegistry`), `landscapePluginModuleLoader` (`PluginModuleLoader`) and `landscapeContributionStore` (`PluginBpmnContributionStore`) |

## Overlays

`PluginDiagramOverlayManager<ElementSnapshot>` (`bifrost/common/plugin-host/PluginDiagramOverlayManager.ts`) is shared by the DMN and the landscape bridge. It holds one overlay factory per plugin (a second registration replaces the first with a warning), resolves the chain in ascending priority with a 500 ms timeout per factory, caches the result per URI by a fingerprint of the element set (`fingerprintOf`, supplied by the bridge), and renders raw DOM overlays onto a `DiagramOverlayTarget { overlays, elementRegistry }`. `refresh(null, …)` removes what was drawn before, which is how an unreadable or closed map clears its overlays. The landscape bridge creates one with `diagramLabel: 'Landscape'`.

Overlay types are `badge`, `icon`, `action` and `status` with the positions `top-left`, `top-right`, `middle-left`, `middle-right`, `bottom-left`, `bottom-right` and `below`, as for DMN. The map has no Studio-owned overlay markers, so `originalDefaultOverlays` is always empty.

`LandscapeMapDocumentModel.refreshPluginOverlays()` runs the factories for the plane on screen after every `commandStack.changed`, selection change and plane change, and when the event `pluginLandscapeOverlayFactoriesChanged` (`bifrost/contracts/StudioEvents.ts`) fires. `getModeler()`, `getText()` and `executePluginCommand()` on the model are the only entry points the bridge uses.

**Click commands:** `onClickCommand` must be a command of the same plugin. A bare name is prefixed with `plugin.<owner>.`. For a direct overlay (`setOverlays`, owner known) the click runs only when `isOwnedRegisteredCommand(commandId, owner)` holds; otherwise it is rejected with a console warning. Overlays resolved from the factory chain carry no owner, so their commands run without that check. The same gap exists in the DMN editor; it is not specific to landscape.

## Palette and context pad

Entries come from two sources, both held in `landscapeContributionStore`: the manifest fields `landscapePalette` and `landscapeContextPad` (registered by `ContributionRegistrar` at discovery) and the runtime calls. `LandscapePluginEntries.ts` provides two diagram-js providers at priority 600:

- **Palette:** the entry's `group`, default `z-plugins` ("Plugins"), entry id `plugin.<plugin>.<entry>`, icon `ph …` class or a bare Phosphor name.
- **Context pad:** an entry shows when `elementTypes` (static) and `elementIds` (dynamic, changed by `updateContextPadEntry`) both match. Clicking runs the command with `{ elementId, elementType }`.

Entries disappear with the plugin (`disposePlugin`) and when the plugin unregisters them.

## Renderer modules

`landscapeModules` entries (manifest) are CommonJS diagram-js modules loaded by `landscapePluginModuleLoader` into `landscapeModelerModuleRegistry`. `LandscapeMapDocumentModel` passes `landscapeModelerModuleRegistry.getAll()` as `additionalModules` to `new LandscapeModeler(config, additionalModules)`, after the built-in modules, so a map opened after the plugin loaded has them. Each module gets `pluginChannel` through DI for `postMessage` / `onMessage`; the plugin side uses `api.landscape.postToRendererModule` and `onRendererModuleMessage`. Studio modules register their own modules with `bpmn.landscape.modeler.registerModule`.

## Manifest

| Field | Requires | Entry |
|---|---|---|
| `contributes.landscapePalette` | `landscape.modelling` | `{ id, icon, title, command, group? }`; `command` is prefixed with `plugin.<name>.` |
| `contributes.landscapeContextPad` | `landscape.modelling` | `{ id, icon, title, command, elementTypes? }` |
| `contributes.landscapeModules` | `landscape.renderer` | `{ entry, description? }` |

`ManifestReader` cross-validates: a palette or context pad entry without `landscape.modelling` or `landscape.renderer` gives a warning, `landscapeModules` without `landscape.renderer` an error. The schema is `bifrost/common/plugin-host/manifest/ManifestSchema.json`; the TypeScript types are in `studio-sdk/src/plugin-api/manifest/ManifestTypes.ts`. Field semantics are as for the DMN fields in [plugin-manifest.md](plugin-manifest.md).

## Tests

- Unit: `test/unit/bifrost/ManifestReaderLandscape.test.ts`
- Integration: `test/integration/plugins/plugin-landscape-api.test.ts` with the fixtures `landscape-kitchen-sink`, `landscape-no-perm` and `landscape-read-only` under `test/fixtures/plugins/`
