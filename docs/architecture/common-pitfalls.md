# Common Pitfalls

Recurring mistakes and non-obvious constraints. Add an entry only if a competent person could hit it **again** without this note. One-off bugfixes, CI incident reports, and named failing tests do not belong here.

Each entry: **Mistake** / **Why** / **Correct approach**. Keep it to a few lines. Point at architecture docs instead of copying their tables.

Test-harness rules live in [`docs/testing.md`](../testing.md).

---

## BPMN moddle: `extends` on extension payload types

**Mistake**: Declaring an `bfw:*` payload under `<extensionElements>` with `"extends": ["bpmn:ExtensionElements"]`.

**Why**: moddle forbids creating that type, so persist commands cannot add children and XML stays empty.

**Correct approach**: `superClass: ["Element"]` only, plus `meta.allowedIn` (commonly `["*"]`). Same pattern as `camunda:Properties`.

---

## Non-standard attributes need a moddle `extends` entry

**Mistake**: Setting an engine-only attribute on a standard BPMN business object without a matching `extends` block in `bfw-platform.json`.

**Why**: In-memory editing works; `moddle.toXML()` silently drops undeclared properties. The pane looks correct until save → reload.

**Correct approach**: Add the `extends` entry first and cover it with a parse → mutate → `toXML()` → re-parse unit test.

---

## BPMN `currentXml` vs `updateCurrentData`

**Mistake**: On XML-changed, calling only `updateCurrentData(xml)`.

**Why**: `BpmnDocumentModel.currentXml` reads a private `this.xml`, not `getCurrentData()`. The inspector XML view stays on the last load string.

**Correct approach**: Set `this.xml = xml` together with `updateCurrentData(xml)`.

---

## Dialog startup timing

**Mistake**: `bifrost.dialog.open()` during module `onLoad` / `onActivate`.

**Why**: The dialog queue blocks until the renderer mounts. Early opens are swallowed; later opens never appear.

**Correct approach**: Open from `bifrost.events.on('ready', …)`.

---

## Command enablement must not throw or notify on every render

**Mistake**: Throwing from `isCommandEnabled` for unknown commands, or opening a new error notification on every failure. Leaving `PaneInfoBarAction` / `EditorToolbarButton` pointed at a deleted command.

**Why**: Chrome calls `isCommandEnabled` during render. A notification re-renders the tree → infinite freeze.

**Correct approach**: Return `false` for unknown commands (log once). Deduplicate predicate-error notifications by `(command, message)`. When removing a command, delete every UI reference.

---

## Removing pane group registrations

**Mistake**: Deleting `registerPaneGroup` when the last pane leaves a group.

**Why**: Other modules still register into that group and expect it to exist.

**Correct approach**: Keep `registerPaneGroup(area, groupId, [])` even if the array is empty.

---

## Restating `shouldBeDisplayed` inside pane renderers

**Mistake**: `PaneContent` returns `null` after re-checking document type, selection, or element kind.

**Why**: `PaneWrapper` already gates on `shouldBeDisplayed`. Folding a stricter renderer check into the gate hides the header.

**Correct approach**: Selection and type in the gate. Renderer `return null` only for readiness / missing payload. See [`panes.md`](panes.md).

---

## Module theme tokens belong in the module

**Mistake**: Adding `--theme-my-module-*` to core `theme.light.scss` / `theme.dark.scss`.

**Why**: Core must not know modules.

**Correct approach**: Define tokens in the module SCSS under `.bifrost.bifrost-theme--light` / `--dark`. Aliases that depend on theme tokens go on `.bifrost`, not `:root`.

---

## `ref.current` during render

**Mistake**: Reading or writing `ref.current` in the render body.

**Why**: `react-hooks/refs` treats that as impure.

**Correct approach**: Assign inside `useEffect`. Read refs only in handlers, effects, or callbacks.

---

## Conditional hook calls

**Mistake**: `if (config.enableDrag) { useDrag(ref); }`

**Why**: Hooks must run in the same order every render.

**Correct approach**: Call the hook unconditionally and disable via options (`canDrag: config.enableDrag`).

---

## Direct cross-module function calls

**Mistake**: Importing another module's functions.

**Why**: Bypasses commands, enabled predicates, and foundation → consumer isolation.

**Correct approach**: `bifrost.commands.executeCommand()`. Foundation modules emit events on shared mediators.

---

## Sync predicates cannot call async commands

**Mistake**: `enabledWhen` / toolbar `visible` calling `executeCommand` (returns a Promise, always truthy).

**Why**: Those callbacks are synchronous.

**Correct approach**: Sync checks use `isRegistered`. Data checks live in the async handler.

---

## Unnecessary success notifications

**Mistake**: A success toast after every completed action.

**Why**: Visible UI change already confirms the action.

**Correct approach**: Toast success only when there is no immediate visual feedback (`git push` / `pull` / `sync`). Always show errors. See [`notifications.md`](notifications.md).

---

## Inline `import()` in type annotations

**Mistake**: `editorDocument: import('@elraptorus/bfw_studio_sdk').EditorDocument`

**Why**: Hides dependencies and breaks import sorting.

**Correct approach**: Top-level `import type`. Enforced by `@typescript-eslint/consistent-type-imports`.

---

## `ElementRegistry.get()` returns `undefined`

**Mistake**: Using `elementRegistry.get(id)` without a null check.

**Correct approach**: Guard `if (element == null) return`.

---

## Zero-dimension canvas operations

**Mistake**: `canvas.viewbox()`, `zoomToViewport()`, or DMN `READY_FOR_INTERACTION` while the container has `outer.width === 0`.

**Why**: Zoom math produces non-finite SVGMatrix values. Splitters, tabs, and collapsed panes defer layout.

**Correct approach**: Attach to a visible DOM node first. Defer zoom until layout (`requestAnimationFrame` / resize observer). DMN waits for a non-zero DRD viewbox before marking interactive.

---

## PaneProperty `onChange` vs `onCommit`

**Mistake**: Using `onCommit` for keystroke updates or `onChange` for blur/Enter persistence.

**Correct approach**: `onCommit` = validated blur/Enter (property editors). `onChange` = live keystrokes (search). `type="select"` still uses `onChange` (selection is a commit).

---

## Animating duotone Phosphor icons with `ph-spin`

**Mistake**: Expecting `ph-duotone ph-spin` to rotate around the same origin as fill/bold icons.

**Why**: Dual pseudo-elements inflate the box; `transform-origin: center` orbits off-center.

**Correct approach**: Use the classes as-is. `phosphor-utilities.scss` already spins `::before` / `::after` individually.

---

## Status bar: `Array.concat` flattens array-likes

**Mistake**: `result = result.concat(factoryFn())` when the factory returns an array-like object.

**Why**: `concat` copies indexed properties into bare cells and the bar fills with digits.

**Correct approach**: Run factory output through `normalizeStatusBarItems` before concat. See [`status-bar.md`](status-bar.md).

---

## Diagnostics: do not clear the focused URI on `diagram.destroy`

**Mistake**: `setDiagnostics(getFocusedEditorDocument().uri, owner, [])` on destroy.

**Why**: Focus has often already moved. The new document is cleared; the destroyed one leaks.

**Correct approach**: Bind the URI at import and always push/clear that bound URI.

---

## bpmnlint resolver: package name prefixing

**Mistake**: Matching `pkg === 'bifrost-forge-world'` in a custom resolver.

**Why**: bpmnlint prefixes non-`bpmnlint` packages to `bpmnlint-plugin-bifrost-forge-world`.

**Correct approach**: Match the prefixed name. Config still uses the shortcut `bifrost-forge-world/rule-name`.

---

## diagram-js palette: separators are not automatic

**Mistake**: Different `group` values expecting an `<hr>` between groups.

**Why**: Groups are only wrapper divs. Separators come from `{ separator: true }` entries.

**Correct approach**: Add an explicit separator as the first entry in the group. Stagger provider priorities so the separator merges first.

---

## BPMN properties: spec-compliant moddle, not custom properties

**Mistake**: Storing loop / assignee / service-task config as `camunda:Property` strings (`engine.*`).

**Correct approach**: Dedicated command handlers create typed BPMN elements (`implementation` attribute, loop characteristics, resources). See [`bpmn-editor-properties.md`](bpmn-editor-properties.md).

---

## Service task type is the `implementation` attribute

**Mistake**: Detecting HTTP/service-task kind from Camunda extensions.

**Correct approach**: Read `element.businessObject.get('implementation')` (e.g. `"http"`).

---

## Merge-conflict BPMN: let the adapter throw

**Mistake**: Detecting conflict markers in the renderer and blocking load with a metadata flag.

**Why**: Two detection paths race (dummy XML vs error view).

**Correct approach**: Load normally. Catch the adapter error and branch on `unresolved merge conflicts` in the message.

---

## Merge via XML, not modeler APIs

**Mistake**: Auto-apply or per-attribute merge via `modeling.createShape` / `updateProperties` on worker-serialized diffs.

**Why**: `$parent` is lost in JSON, connections need live refs, and `#ref:` strings corrupt moddle. Display labels are not moddle keys.

**Correct approach**: Merge with `DOMParser` / `XMLSerializer` (`xmlMergeEngine`). Re-run it when a conflict resolution changes. Load the rebuilt XML into the viewer.

---

## bpmn-js-differ swaps oldValue / newValue

**Mistake**: Trusting `attrs[prop].oldValue` as the before-value.

**Why**: The library's `changed(model, property, newValue, oldValue)` is called with jsondiffpatch left/right reversed.

**Correct approach**: Treat `values.newValue` as before and `values.oldValue` as after (`BpmnMergeResolver.buildSideDetail`, `changeSummaryBuilder`).

---

## Renderer commands: pass the model

**Mistake**: The handler `await`s `getEditorDocumentModel` that the renderer already holds.

**Correct approach**: Pass the model as `commandArgs`. The enabled predicate can then inspect it synchronously. Exception: `std.editor.*` zoom commands take `editorDocument` by convention.

---

## `enabledWhen` must not assume arguments are present

**Mistake**: `enabledWhen: (editorDocument) => editorDocument.documentType === 'dmn.diff'`.

**Why**: Command search and tests call with no args. The predicate throws; the user sees "command is not enabled".

**Correct approach**: `(editorDocument ?? bifrost.editors.getFocusedEditorDocument())?.documentType === …`

---

## `require.cache` in Rspack-bundled Node targets

**Mistake**: Invalidating plugins via `delete require.cache[path]` in Electron main/renderer bundles.

**Why**: Rspack inlines modules; Node's `require.cache` is not the module graph.

**Correct approach**: Reload through Plugin Host (dispose + re-activate), not `require.cache`.

---

## SDK peer dependencies must be aliased in Rspack

**Mistake**: SDK and Studio resolving separate copies of React-context libraries (`react-dnd`, `react-select`, `@mdxeditor/editor`).

**Why**: Providers in Studio are invisible to SDK hooks (`Expected drag drop context`).

**Correct approach**: `resolve.alias` in `rspack.config.electron.js` to `studio/node_modules`. Exact-match `$` on `@mdxeditor/editor$` so CSS subpaths still resolve.

---

## `plugin.enabled` vs `plugin.status`

**Mistake**: Treating `status === 'disabled'` as “user turned it off”.

**Why**: Runtime unload sets `enabled: false` and `status: 'not-loaded'`. `'disabled'` is only used at discovery for the settings list.

**Correct approach**: Visual off-state uses `!plugin.enabled`. Use `status` for `'error'` / load progress.

---

## Command IDs: first segment is a known group

**Mistake**: Registering `machineSanctum.*`, `gitCruiser.*`, `bpmnDiff.*`, or any camelCase compound prefix.

**Correct approach**: First dotted segment is one of `std`, `bpmn`, `dmn`, `engine`, `git`, `plugins`, `dev`. Plugin user commands are `plugin.<name>.*` (singular). `plugins.*` (plural) is reserved for the Studio.

---

## `insertAfterMenuBarItem` requires the anchor to exist

**Mistake**: Inserting after `pane/left/plugins` from a module that loads before `plugins`.

**Why**: The first menu rebuild throws and the pane system dies.

**Correct approach**: Anchor only on items from earlier modules. Authoritative order is `createAndInitializeBifrost.ts`.

---

## Menu modifiers on async menus must await

**Mistake**: `insertAfterMenuItem(menu, …)` when `menu` is a `Promise`.

**Why**: Async factories (application menu) pass a Promise; `.find` throws.

**Correct approach**: `async (menuOrPromise) => { const menu = await menuOrPromise; … }`

---

## Do not gate a column's menu bar on pane-area visibility

**Mistake**: `{paneArea.left.visible && <MenuBarSection …>}`.

**Why**: Hide unmounts the Show control and parked icons.

**Correct approach**: Park that area's `MenuBarSection` on the center row. See [`workbench-layout.md`](workbench-layout.md).

---

## Explorer menu modifiers must not stack dividers

**Mistake**: Inserting `{ type: 'divider' }, item` immediately before an item that already starts a group.

**Why**: Consecutive dividers render as a double line.

**Correct approach**: Give the base group-break a stable id. Insert new groups after it, or immediately before the next item with **no** extra divider.

---

## `updateCurrentData` without originals marks the document dirty forever

**Mistake**: Read-only views calling `updateCurrentData` only.

**Why**: `original !== current` is the dirty bit.

**Correct approach**: Non-file models override to `updateOriginalAndCurrentData(data, data)`.

---

## `registerSharedRessource` is not per-document state

**Mistake**: Sharing selection or parsed models via `registerSharedRessource(key, value)`.

**Why**: Global singleton. Two tabs overwrite each other.

**Correct approach**: Private model fields + public getters. Panes cast `props.editorDocumentModel`. Bump a `selectionRevision` in metadata to re-render. `getSharedRessource` **throws** on an unknown key — do not null-guard it. See [`editor-documents.md`](editor-documents.md).

---

## Linter graph walks use sequence flows, not `outgoing` / `incoming`

**Mistake**: Reachability via `flowNode.outgoing`, or treating Event Subprocesses as token-entered nodes.

**Why**: Those arrays are optional in XML. Event Subprocesses have no crossing sequence flows.

**Correct approach**: Adjacency from `sequenceFlow.sourceRef` / `targetRef`. Skip `bpmn:SubProcess` with `triggeredByEvent`.

---

## `registerDefaultIncludedFiles` after a solution is open

**Mistake**: Registering include patterns during plugin `activate()` and expecting the File Explorer to show those files.

**Why**: `project.files.included` is a snapshot taken when the project is added.

**Correct approach**: `registerDefaultIncludedFiles` must reapply patterns to open projects and emit `EVENT_SOLUTION_CHANGED`. Pass `includedFilePatterns` on the webview document type (manifest or `registerWebviewDocumentType`).

---

## Manifest `editorDocumentTypes` is only a placeholder

**Mistake**: Declaring `contributes.editorDocumentTypes` and never calling `api.editors.registerWebviewDocumentType` with the same `id` in `activate()`.

**Why**: The placeholder is a promise, not the editor. The tab stays on “Plugin activated but did not register an editor”.

**Correct approach**: Unconditional matching `registerWebviewDocumentType` in `activate()`. Disabling a plugin unregisters the type; the placeholder is **not** restored until re-enable. See [`plugin-host.md`](plugin-host.md).

---

## A manifest command is an activation stub until `activate()`

**Mistake**: Asserting a plugin command handler exists because `isRegistered` is true.

**Why**: `contributes.commands` registers a stub that only triggers activation.

**Correct approach**: Open a matching document (or otherwise activate), then poll until the real handler is present. See [`plugin-host.md`](plugin-host.md).

---

## `'ready'` is a one-shot event

**Mistake**: Discovering an `onStartup` / eager plugin after boot and waiting for `'ready'` to activate it.

**Why**: The event already fired during `postInitialize`.

**Correct approach**: If `bifrost.isInitialized`, activate immediately; otherwise subscribe to `'ready'`.

---

## Plugin sandbox constraints

**Mistake**: Assuming plugins can fetch, mutate `Object.prototype`, `require('node:…')` to skip the module gate, or write settings outside `plugin.<name>.*`.

**Why**: SES lockdown, total network blackout, and PermissionGate are by design. `native` bypasses SES (highest risk). `node:` prefixes used to skip ModuleGate — they must not.

**Correct approach**: Declare permissions in the manifest (`filesystem`, `commands.std`, `commands.bpmn`, `commands.dmn`, `bpmn` / `bpmn.modelling` / `bpmn.renderer`, same for `dmn`, `native`, `system-info`). `renderer-modules` is a legacy alias of `bpmn.renderer`. Quarantine is not cleared by toggling enabled — use the quarantine recovery path. See [`plugin-host.md`](plugin-host.md) and [`plugin-manifest.md`](plugin-manifest.md).

---

## Plugin Host callbacks and Proxies

**Mistake**: Spreading a sandbox API namespace (`{ ...api.settings }`), using `method in target` in a Proxy `get` trap, registering a disposer as a bare function, or fire-and-forget `activatePlugin`.

**Why**: SES membranes make spread/`in` miss methods (calls serialize callbacks → `DataCloneError`). Disposers must be `{ dispose }`. Unawaited activate deadlocks “Pending activation”. Failed activate must dispose subscriptions; `registerCallback` must not ack success for unknown namespace+method; host `respond` must keep `requestId` at the message top level.

**Correct approach**: Keep namespaces as Proxies (`typeof target[method] === 'function'`). Await activation. Return `{ dispose }`. Bridge handlers take `pluginName` from the payload, not `args[0]`.

---

## TypeScript fixture plugins must be recompiled

**Mistake**: Editing `studio/test/fixtures/plugins/*/src` and running integration tests against stale `dist/`.

**Correct approach**: `npm run build:plugin-fixtures` (already part of `test:integration:plugins`).

---

## Webview iframe gotchas

**Mistake**: Registering `onMessage` after the iframe has loaded; expecting a collapsed pane to host an iframe; sending Ctrl+S from inside the iframe to the Studio.

**Why**: The bridge handshake is on `load`. Collapsed panes unmount content. The iframe does not see host keybindings.

**Correct approach**: Register `onMessage` before mount. Expand the pane before asserting webview UI. Save from the host chrome or a plugin command. Cross-plugin `postMessage` is blocked. See [`webviews.md`](webviews.md).

---

## `setDirty` throws if the document is not open

**Mistake**: A plugin save delegate calling `setDirty` after the tab closed.

**Correct approach**: Only mark dirty while the document is open; treat missing document as already clean.

---

## `fs.rename` fails across mount points (EXDEV)

**Mistake**: `fs.rename` from `os.tmpdir()` onto a workspace on another filesystem.

**Correct approach**: Try rename; on `EXDEV` fall back to `fs.cp` + `fs.rm` (`moveDirectory` in git handlers).

---

## Renderer modules must not use `window.bifrost`

**Mistake**: Injected diagram-js modules calling the Studio facade.

**Why**: They run in the renderer isolate. The facade is not a plugin API.

**Correct approach**: `postToRendererModule` / `onRendererModuleMessage`. Multiple renderer-module plugins must not share the DI name `pluginChannel`.

---

## GraphQL `__typename` after `camelizeKeys`

**Mistake**: Reading `__typename` on a camelized Engine payload.

**Why**: The converter yields `_Typename`.

**Correct approach**: Read `_Typename`, or exclude `__typename` from camelize.

---

## Host CodeMirror uses `--theme-feel-*` tokens

**Mistake**: Introducing a second syntax-color token family, or adding Monaco, or treating the host language map as a generic highlighter zoo.

**Correct approach**: Host editors (`MultiLineCodeEditor`, `DiffEditor`) share FEEL theme tokens. FEEL stays `@bpmn-io/feel-editor`. Languages are the ones the Studio actually edits. See [`code-editors.md`](code-editors.md) and [`feel-editor.md`](feel-editor.md).

---

## Do not key uncontrolled editors on the live value

**Mistake**: `key={…${committedValue}}` on `PaneProperty`, CreatableSelect, `OneLineFeelEditor`, or a DMN pane that includes `name`.

**Why**: `onChange` / `onCommit` fires on blur. The key remounts the control during the click that commits. Autocomplete, radios, and match-all state reset. Mapping rows keyed `${source}->${target}` remount the source editor the same way.

**Correct approach**: No value-based key on the field being edited. Dependents remount on the **parent** id after it commits. Mapping / custom-property rows use a stable `rowId`. Debugger JSON panes key `PaneBody` / `MultiLineCodeEditor` on flow-node-instance or element id. See [`bpmn-editor-properties.md`](bpmn-editor-properties.md), [`panes.md`](panes.md), and [`code-editors.md`](code-editors.md).

---

## Suggestion-select / CreatableSelect contracts

**Mistake**: Seeding `defaultInputValue` with the selection, restoring `props.value` on Enter/blur, swallowing `inputProps.onKeyDown`, `optionize('')` as `{ value: '' }`, or keying two selects on each other's values.

**Why**: The search box filters to the current value; Enter clears the field; Clear leaves an X on a blank control; sibling remounts wipe in-progress create text.

**Correct approach**: Uncontrolled select, empty search, committed text in `.react-select__single-value`. Forward keys except Escape. `optionize('')` is `null`. Tests: do not clear before picking an existing option; wait for the X to finish before typing; create via `commitSuggestionCreateOption`; jump-to-symbol lives in the **label**, not inside `htmlId`. See [`docs/testing.md`](../testing.md).

---

## OneLineFeelEditor: Escape does not blur

**Mistake**: After typing a one-line FEEL value, clicking the canvas while CodeMirror is still focused (Escape only closed autocomplete).

**Why**: Autocomplete / lint `.cm-tooltip` covers the fitted start event. Async `setVariables` can reopen it.

**Correct approach**: Send `['Escape', 'enter']` (close completions, then blur). Canvas helpers blur `document.activeElement` and wait for `.cm-tooltip` to unmount. Correlation Key is OneLineFeelEditor — `getValue` on the wrapper is `''`; read `.cm-content`. Multi-line FEEL Inserts a newline on Enter. See [`feel-editor.md`](feel-editor.md).

---

## Context pad vs property-pane clicks

**Mistake**: Clicking a tiny pane radio while the bpmn-js / dmn-js context pad is open.

**Why**: `clickOn` waits until the pixel is unobstructed and can hang until `testTimeout`.

**Correct approach**: `sendKeyboardInput(['Escape'])` after canvas select, then click the **label**. Do not put Escape inside `selectBpmnElementByIdAndWaitForElement`.

---

## Document-type export uses a suffixed command

**Mistake**: Registering BPMN SVG/PNG/XML on unsuffixed `std.editor.exportDocumentAs`.

**Why**: DMN Export then runs BPMN `importXML` on DMN XML.

**Correct approach**: `std` forwards to `std.editor.exportDocumentAs.${documentType}`. BPMN implements `.bpmn`; DMN implements `.dmn`.

---

## Merge Change Overview must optional-call resolver methods

**Mistake**: `resolverApi?.getDefinitionsMetadataOurs()` after switching BPMN ↔ DMN merge files.

**Why**: The shared ref still holds the previous resolver type.

**Correct approach**: `resolverApi?.getDefinitionsMetadataOurs?.() ?? []` (same for other type-specific methods).

---

## `client.execute` cannot return a top-level `error` property

**Mistake**: A renderer execute callback returning `{ success, error }`.

**Why**: WebDriverIO treats a top-level `error` key as a protocol failure.

**Correct approach**: Rename the field (`message`, `failure`, …) or return a string. See [`docs/testing.md`](../testing.md).

