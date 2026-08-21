# Common Pitfalls

Recurring mistakes, non-obvious constraints, and gotchas discovered while working on the Studio. Agents should consult this file when working in an unfamiliar area and **add new entries** whenever they encounter a subtle bug or architectural constraint that is easy to get wrong.

Each entry follows the format: what goes wrong, why it happens, and the correct approach.

---

## BPMN moddle: `extends` on extension payload types

**Mistake**: Declaring a custom type that lives under `<bpmn:extensionElements>` with `"extends": ["bpmn:ExtensionElements"]` (alongside `superClass: ["Element"]`).

**Why it fails**: moddle forbids creating that type (`cannot create <evil:Properties> extending <bpmn:ExtensionElements>`). The score persist command then cannot add `evil:properties` to `definitions.extensionElements.values`, so XML may contain only an empty `<bpmn:extensionElements />` while the UI still shows a computed score from RAM.

**Correct approach**: Model the payload as `superClass: ["Element"]` only, with `meta.allowedIn` (commonly `["*"]`, same pattern as `camunda:Properties` in `camunda-bpmn-moddle`) so instances serialize as child elements under `bpmn:ExtensionElements`.

---

## BPMN `currentXml` vs `updateCurrentData`

**Mistake**: On `EVENT_BPMN_MODELER_ADAPTER_XML_CHANGED`, calling only `updateCurrentData(xml)` and assuming all BPMN XML consumers update.

**Why it fails**: `EditorDocumentModel.updateCurrentData` sets the base `currentData` field (dirty state, `editorDocument.data.current`, save pipeline). `BpmnDocumentModel` also keeps a private `this.xml` field; the **`currentXml` getter returns `this.xml`**, not `getCurrentData()`. The Editor Document Inspector XML view and open-in-tab use `model.currentXml`, so they stay stuck on the last load/save string even though the document is dirty and `getCurrentData()` is fresh.

**Correct approach**: In the XML-changed handler, set `this.xml = xml` (or change `currentXml` to read from `getCurrentData()`) before or together with `updateCurrentData(xml)`.

---

## Dialog startup timing

**Mistake**: Calling `bifrost.dialog.open()` during module `onLoad` or `onActivate`.

**Why it fails**: The dialog system queues dialogs internally. If the renderer is not yet mounted, the queued dialog never appears — and because the queue is blocked, all subsequent `dialog.open()` calls are also silently swallowed. The UI appears to freeze for all dialog interactions.

**Correct approach**: Wrap the call in the `ready` event:

```typescript
bifrost.events.on('ready', () => {
  bifrost.dialog.open({ ... });
});
```

---

## `isCommandEnabled` and notifications during render

**Mistake**: Throwing from `isCommandEnabled` for unregistered commands, or opening a new error notification on every `isCommandEnabled` failure without deduplication.

**Why it fails**: Many components (`MenuBarButton`, `StatusBarButton`, SDK pane chrome, `ContextMenu`, etc.) call `isCommandEnabled` during render. `NotificationManager.open` emits `EVENT_OPEN_NOTIFICATION`; `Workbench` subscribes and calls `setNotifications`, which re-renders the tree. If each render opens another notification, the app enters an infinite re-render loop and freezes.

**Correct approach**: Return `false` for unknown commands (log once per command name). For predicate errors, show at most one notification per distinct `(command name, error message)` while still returning `false`.

---

## Removing pane group registrations

**Mistake**: Deleting a `bifrost.panes.registerPaneGroup(area, groupId, [...])` call when removing the last pane from a group.

**Why it fails**: Multiple modules register panes into the same group. Later `registerPaneGroup` calls for that group expect the group to already exist. Removing the initial registration causes a runtime error: `PaneGroup with id '...' not found in area '...'`.

**Correct approach**: Remove the pane entry from the array, but keep the `registerPaneGroup` call — even if the array is empty:

```typescript
bifrost.panes.registerPaneGroup('right', 'property', []);
```

---

## Module theme tokens in core

**Mistake**: Adding module-specific CSS custom properties (`--theme-my-module-*`) to `bifrost/styles/theme.light.scss` or `theme.dark.scss`.

**Why it fails**: The core theme files must have no knowledge of modules. Adding module tokens there creates a coupling that violates the module isolation boundary and makes the token impossible to remove without editing core.

**Correct approach**: Define module tokens in the module's own SCSS file using the explicit class pattern:

```scss
.bifrost.bifrost-theme--light {
  --theme-my-module-bg: #fff;
}
.bifrost.bifrost-theme--dark {
  --theme-my-module-bg: #323232;
}
```

---

## Theme alias variables on `:root`

**Mistake**: Defining `--color-*: var(--theme-*)` alias variables on `:root`.

**Why it fails**: Theme-dependent aliases must resolve within the `.bifrost` scope where theme classes are applied. Placing them on `:root` means they resolve before the theme class is evaluated, producing incorrect or empty values.

**Correct approach**: Define aliases inside `.bifrost { }`. Only fixed color constants (e.g., `--color-black: #000`) belong on `:root`.

---

## `ref.current` during render

**Mistake**: Reading or writing `ref.current` directly during the render phase of a React component.

**Why it fails**: The React Compiler rules (`react-hooks/refs`) treat ref access during render as impure. This causes lint errors and can break future compiler optimizations.

**Correct approach**: Use the latest-ref pattern — assign `ref.current` inside a `useEffect`:

```typescript
useEffect(() => {
  ref.current = value;
});
```

Read `ref.current` only inside event handlers, effects, or callbacks — never during render.

---

## ~~`getModuleFromStudio` false positives~~ (RESOLVED)

> **Resolved (2026-05-12):** The `getModuleFromStudio` bridge has been removed. SDK components now import React, react-select, react-dnd, and MDX Editor directly. The `react-hooks/refs` false positives no longer occur.

---

## Conditional hook calls

**Mistake**: Wrapping a hook call inside an `if` block to make a feature optional:

```typescript
if (config.enableDrag) {
  useDrag(ref); // violation
}
```

**Why it fails**: `react-hooks/rules-of-hooks` requires hooks to be called unconditionally and in the same order every render.

**Correct approach**: Call the hook unconditionally and disable via config:

```typescript
useDrag(ref, { canDrag: config.enableDrag });
```

---

## Direct cross-module function calls

**Mistake**: Importing and calling functions from another module directly.

**Why it fails**: The module architecture enforces isolation through the command system. Direct imports create hidden coupling, bypass enabled predicates, and break the dependency direction (foundation modules must never depend on consumer modules).

**Correct approach**: Use `bifrost.commands.executeCommand()` for cross-module calls. For foundation-to-consumer communication, emit events on shared mediators instead.

---

## Abbreviating variable names

**Mistake**: Using short names like `sol`, `cmd`, `ctx`, `doc`, `dir` for variables.

**Why it fails**: The `id-length` ESLint rule requires names of at least 2 characters, but more importantly, the project naming convention requires fully qualified, descriptive names for readability.

**Correct approach**: Use `currentSolution`, `clickHandler`, `context`, `editorDocument`, `containingDirectory`, etc. Exceptions: loop indices (`i`, `j`, `k`), sort comparators (`a`, `b`), and the discard variable (`_`).

---

## Sync predicates cannot call async commands

**Mistake**: Trying to call `bifrost.commands.executeCommand()` inside a `CommandEnabledPredicateFn` or a toolbar button's `visible` callback to check cross-module state.

**Why it fails**: Both `enabledPredicateFn` and the toolbar `visible` callback are **synchronous** (`(...args) => boolean`). `executeCommand` returns a `Promise`, so the predicate returns a Promise object (truthy), not the actual boolean result.

**Correct approach**: For sync predicates, use `bifrost.commands.isRegistered(commandName)` to check whether a module is loaded. Move the actual data check into the **async command handler** and bail out early with a notification:

```typescript
bifrost.commands.register(
  'myModule.myCommand',
  async () => {
    // Async check is safe here
    const hasData = await bifrost.commands.executeCommand<boolean>('otherModule.hasData', [uri]);
    if (!hasData) {
      bifrost.notifications.open('No data available.');
      return;
    }
    // ... proceed with expensive work
  },
  {
    visibleInSearch: true,
    description: 'My Command',
    enabledWhen: () => {
      // Sync predicate: only check availability, not data
      return bifrost.commands.isRegistered('otherModule.hasData');
    },
  },
);
```

---

## Unnecessary success notifications

**Mistake**: Showing `bifrost.notifications.open('Stash applied.')` or similar success toast after every completed action.

**Why it's wrong**: Many actions produce an immediate, visible change in the UI — file explorer decorations update, the Git Pane contents shift, editor content reverts. A success notification on top of that is visual noise that interrupts the user's flow without conveying new information.

**Correct approach**: Only show success notifications when the action has **no immediate visual feedback** (e.g., `git push`, `git pull`, `git sync`). Errors and warnings should always be shown regardless. See `docs/architecture/notifications.md` § "When to Show Notifications" for the full guideline.

---

## Inline `import()` in type annotations

**Mistake**: Using `import('...').Type` inline in function signatures or variable declarations:

```typescript
async (editorDocument: import('@evil/bifrost_fw_sdk').EditorDocument) => { ... }
```

**Why it's wrong**: Inline `import()` type annotations scatter dependency information across the file, making it impossible to see at a glance which modules a file depends on. They also defeat import sorting and dead-import detection.

**Correct approach**: Always place imports at the top of the file. Use `import type` for type-only imports:

```typescript
import type { EditorDocument } from '@evil/bifrost_fw_sdk';

// ... later in the file:
async (editorDocument: EditorDocument) => { ... }
```

Enforced by the ESLint rule `@typescript-eslint/consistent-type-imports` with `disallowTypeAnnotations: true`.

---

## Using `any` aliases for bpmn.io types

**Mistake**: Defining local type aliases like `type ViewerCanvas = any` or `type ModelerElementRegistry = any` instead of importing the actual types from diagram-js/bpmn-js.

**Why it's wrong**: diagram-js and bpmn-js now ship full TypeScript declarations. Using `any` aliases discards all type safety through the adapter chain — every consumer that calls `getCanvas()`, `getElementRegistry()`, etc. silently inherits `any`, defeating TypeScript's value.

**Correct approach**: Import the real types from diagram-js and use them as return types on adapter methods:

```typescript
import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

getCanvas(): Canvas {
  return this.viewer.get('canvas') as Canvas;
}
```

For packages without TypeScript declarations (bpmn-moddle, bpmn-js-differ, diagram-js-minimap), use the local `.d.ts` shims in `studio/src/types/`. If no shim exists yet, create one.

---

## Ignoring `ElementRegistry.get()` returning `undefined`

**Mistake**: Calling `elementRegistry.get(id)` and using the result without a null check.

**Why it fails**: The typed `ElementRegistry.get()` returns `ElementLike | undefined`. When the element doesn't exist (e.g., the ID refers to a definition or a removed element), the result is `undefined`. Accessing properties on `undefined` throws at runtime.

**Correct approach**: Always guard the result:

```typescript
const element = elementRegistry.get(elementId);
if (element == null) {
  return;
}
```

---

## `Canvas.viewbox(false)` type mismatch

**Mistake**: Calling `canvas.viewbox(false)` and getting a TypeScript error because the declaration only accepts `Rect | undefined`.

**Why it happens**: The runtime diagram-js Canvas supports `false` to force recomputing the viewbox, but the TypeScript declaration doesn't include this overload.

**Correct approach**: Use a cast: `canvas.viewbox(false as any) as CanvasViewbox`. This preserves the correct runtime behavior while satisfying the type checker.

---

## PaneProperty `onChange` vs `onCommit` semantics

**Mistake**: Using `onCommit` when you want real-time keystroke updates, or using `onChange` when you want validated commit-on-blur behavior.

**Why it happens**: Before the 2026-03-31 API fix, `PaneProperty type="text"` only had `onChange`, which actually fired on blur/Enter (commit semantics). This was confusing because the name suggested per-keystroke behavior. The fix split the API into two distinct props.

**Correct approach**:
- Use `onCommit` when you want the validated, blur/Enter-triggered callback (property editors, settings inputs).
- Use `onChange` when you need real-time per-keystroke updates (search fields, free-form text entry like commit titles).
- You can combine both: `onChange` for UI updates and `onCommit` for validated persistence.
- `PaneProperty type="select"` still uses `onChange` since selection is inherently a commit action.

---

## Animating duotone Phosphor icons with `ph-spin`

**Mistake**: Adding `ph-spin` to a `ph-duotone` icon and expecting it to rotate around its center, the same way it works for `ph`, `ph-light`, `ph-bold`, and `ph-fill` icons.

**Why it fails**: Duotone icons render two pseudo-elements — `::before` (background layer) and `::after` (foreground layer with `margin-left: -1em` to overlay). Chromium's inline-block width calculation doesn't always collapse the negative margin, making the element's computed box up to 2em wide instead of 1em. `transform-origin: center` then targets the center of the too-wide box, causing the icon to orbit off-center ("wobbling").

**Correct approach**: `phosphor-utilities.scss` handles this automatically. The `.ph-duotone.ph-spin` rule disables the element-level animation and applies it to `::before` and `::after` individually (with `display: inline-block` to enable transforms on the pseudo-elements). Both pseudo-elements share the same visual origin, so they rotate in sync around the correct center. No special action is needed when using `ph-spin` on duotone icons — just be aware that the mechanism is different under the hood.

---

## bpmnlint resolver: package name prefixing

**Mistake**: Using `pkg === 'evil-studio'` in a custom bpmnlint resolver and expecting it to match when rules are configured as `evil-studio/rule-name`.

**Why it happens**: bpmnlint's `Linter.parseRuleName()` runs `prefixPackage()` on any non-`bpmnlint` package name. This silently transforms `evil-studio` into `bpmnlint-plugin-evil-studio`. The resolver then receives the *prefixed* name, not the shortcut used in the config.

**Correct approach**: Match the prefixed package name in the resolver:

```typescript
resolveRule(pkg: string, ruleName: string) {
  if (pkg === 'bpmnlint') return builtinRuleFactories[ruleName] ?? null;
  if (pkg === 'bpmnlint-plugin-evil-studio') return customRuleFactories[ruleName] ?? null;
  return null;
}
```

The config can still use the shortcut (`evil-studio/rule-name`) — bpmnlint handles the mapping internally.

---

## diagram-js palette: separators are NOT automatic between groups

**Mistake**: Assuming that placing palette entries in different `group` values (e.g., `z-ext-linter` vs `z-ext-tokensim`) will automatically render a visual `<hr>` separator between them.

**Why it happens**: Diagram-js groups create separate `<div class="group">` wrappers in the palette DOM, but there is **no** automatic separator `<hr>` inserted between groups. The only separators that appear are from entries with `separator: true` — these render as `<hr class="separator">` inside their group's wrapper. The visible divider in the standard palette (between tool entries and element creators) comes from an explicit `tool-separator` entry with `{ group: 'tools', separator: true }` in bpmn-js's `PaletteProvider`.

**Correct approach**: Add an explicit `separator: true` entry as the first entry in the module group:

```typescript
return {
  'ext-separator': {
    group: 'z-extensions',
    separator: true,
  },
  'my-toggle': {
    group: 'z-extensions',
    className: '...',
    // ...
  },
};
```

When multiple palette providers share the same group, use staggered priorities (e.g., 600 vs 599) so the provider with the separator entry is merged first, guaranteeing the `<hr>` appears above all extension entries.

---

## Pane registration: batch related panes in one `prependToPaneGroup` call

**Mistake**: Calling `bifrost.panes.prependToPaneGroup()` separately for each pane an module registers.

**Why it matters**: Multiple calls work but produce harder-to-read initialization code. The method accepts an **array** of panes, so related registrations should be grouped into a single call.

**Wrong**:

```typescript
bifrost.panes.prependToPaneGroup('right', 'property', [
  bifrost.panes.getPaneViaPaneProvider('ext/PaneA', 'ext/provider/PaneA', require('./PaneA')),
]);

bifrost.panes.prependToPaneGroup('right', 'property', [
  bifrost.panes.getPaneViaPaneProvider('ext/PaneB', 'ext/provider/PaneB', require('./PaneB')),
]);
```

**Correct**:

```typescript
bifrost.panes.prependToPaneGroup('right', 'property', [
  bifrost.panes.getPaneViaPaneProvider('ext/PaneA', 'ext/provider/PaneA', require('./PaneA')),
  bifrost.panes.getPaneViaPaneProvider('ext/PaneB', 'ext/provider/PaneB', require('./PaneB')),
]);
```

The order within the array determines the top-to-bottom display order in the pane group.

---

## BPMN element properties: use spec-compliant moddle elements, not custom properties

**Mistake**: Storing BPMN element configuration as `camunda:Property` custom properties (e.g., `engine.setLoopBreakCondition`, `engine.assignUserIds`, `engine.setServiceTaskType`) instead of using the corresponding BPMN 2.0 XML elements.

**Why it matters**: Custom properties are opaque strings with no schema validation. The BPMN 2.0 spec provides typed elements (`StandardLoopCharacteristics`, `MultiInstanceLoopCharacteristics`, `HumanPerformer`, `PotentialOwner`, the `implementation` attribute) that bpmn-js understands natively and that other BPMN tools can interoperate with.

**Correct approach**: Use `BpmnDocumentElementAccess` set handlers to dispatch to dedicated command handlers (`UpdateLoopCharacteristicsHandler`, `UpdateUserTaskResourcesHandler`, `UpdateServiceTaskHandler`) which create/update the proper moddle elements via `bpmnFactory.create()` and `commandStack.execute()`.

---

## Merge-conflict BPMN files: let the adapter throw, handle in the renderer

**Mistake**: Trying to detect merge conflicts in the renderer via metadata flags and preventing model loading proactively. This creates race conditions (metadata set after render, model partially loaded, refs dangling) and duplicates enforcement logic.

**Why it's wrong**: The `BpmnModelerComponentAdapter` already guards against conflict markers with a regex check and throws if they are found. Pre-empting this in the renderer leads to two competing detection paths and subtle bugs (e.g., the adapter loading a dummy XML that renders fine, while the renderer simultaneously tries to show an error view).

**Correct approach**: Let `componentDidMount` load the model normally. The adapter will throw for invalid XML. Catch the error and inspect its message to decide whether to show a merge-conflict-specific error view or a generic load error. This keeps a single source of truth for conflict detection.

```tsx
// In componentDidMount — no special-casing, just let the adapter throw:
async componentDidMount() {
  try {
    this.model = await studio.editors.getEditorDocumentModel(editorDocument);
    this.attachBpmnDocument();
  } catch (error) {
    this.setState({ errorWhileLoading: error });
  }
}

// In render — check the error message:
if (this.state.errorWhileLoading?.message.includes('unresolved merge conflicts')) {
  return (
    <Editor>
      <EditorToolbar>
        <EditorToolbarButton command="git.merge.openResolver" ... />
      </EditorToolbar>
      <EditorContent>
        <EditorLoadingError title="Merge conflicts must be resolved" ... />
      </EditorContent>
    </Editor>
  );
}
```

## Renderer commands: pass the model, don't look it up

**Mistake**: A command handler uses an async lookup to retrieve the `EditorDocumentModel` that the calling renderer already holds:

```typescript
// BAD — command handler
bifrost.commands.register('myExt.doSomething', async (uri?: string) => {
  const model = await bifrost.editors.getEditorDocumentModel(doc); // unnecessary async lookup
  model.doSomething();
});

// BAD — renderer
<EditorToolbarButton command="myExt.doSomething" commandArgs={[entry?.uri]} />
```

**Why it's wrong**: The renderer always receives the `EditorDocument` and has access to the `EditorDocumentModel` (either as a prop or by resolving it once during mount). Re-deriving the model inside the command handler adds latency, duplicates state resolution, and prevents the enabled predicate from checking model state synchronously.

**Correct approach**: Pass the model from the renderer as a `commandArg`. The command handler receives it directly and the enabled predicate can inspect it synchronously:

```typescript
// Command registration — model is the first argument
bifrost.commands.register(
  'myExt.doSomething',
  (model: MyDocumentModel) => { model.doSomething(); },
  { enabledWhen: (model: MyDocumentModel) => model != null && model.isReady() },
);

// Renderer — passes the model it already holds
<EditorToolbarButton command="myExt.doSomething" commandArgs={[this.model]} />
```

This applies to `EditorToolbarButton`, `getClickHandler()`, and direct `executeCommand` calls from renderers. The only exception is `std.editor.*` zoom commands, which follow a convention of receiving `editorDocument` and resolving the model internally to stay consistent across all document types.

---

## bpmn-js canvas operations on zero-dimension containers

**Symptom**: `TypeError: Failed to execute 'scale' on 'SVGMatrix': The provided float value is non-finite`.

**Root cause**: `canvas.viewbox()` returns `outer.width === 0` and `outer.height === 0` when the HTML container exists in the DOM but has not yet received a layout from the browser. This produces `NaN` or `Infinity` when computing zoom scales, which SVGMatrix rejects.

This error has **two** common trigger patterns:

### Variant A: viewbox sync before DOM attach

**Mistake**: Calling `addViewboxSync()` on `BpmnViewerWithSync` before attaching to a visible DOM element.

**Why**: `addViewboxSync` fires an immediate `viewBoxChangedCallback()` that reads `canvas.viewbox()`.

**Fix**: Attach first, then sync:

```typescript
viewer.attachTo(htmlElement);
// Only AFTER the viewer is in the DOM:
viewer.addViewboxSync(otherViewer);
```

### Variant B: `zoomToViewport()` in deferred layouts (SplitterLayout, tabs, collapse panels)

**Mistake**: Calling `adapter.zoomToViewport()` inside `onceInteractive()` when the container is hosted in a `SplitterLayout`, a collapsed tab, or any parent that defers layout.

**Why**: `onceInteractive` fires via `setTimeout(0)` after the bpmn-js modeler reports it is attached. But the surrounding layout container (e.g., a SplitterLayout's secondary panel) may not have completed its CSS layout pass yet, so the container still has `width × height = 0 × 0`.

**Fix — at the call site**: Defer the zoom to the next animation frame, which guarantees the browser has completed the layout pass:

```typescript
adapter.onceInteractive(() => {
  requestAnimationFrame(() => {
    adapter.zoomToViewport();
  });
});
```

**Fix — at the adapter/viewer level**: Both `BpmnModelerComponentAdapter` and `BpmnViewerWithSync` guard `zoomToViewport()` and `setZoom()` against zero-dimension containers by returning early when `viewbox.outer.width === 0 || viewbox.outer.height === 0`. This prevents the SVGMatrix crash for all callers, but does *not* retry the zoom — callers are responsible for deferring or retrying.

---

## Service task type detection: check `implementation` attribute, not Camunda extensions

**Mistake**: Detecting HTTP or custom service tasks by checking `camunda:type` or a `engine.setServiceTaskType` custom property.

**Why it matters**: The Studio now uses the BPMN 2.0 `implementation` attribute with values like `"http"` (built-in HTTP handler) or a free-text plugin dispatch key. Checking Camunda-specific attributes will silently fail on diagrams created or updated with the current editor.

**Correct**:

```typescript
import { BpmnServiceTaskImplementation } from '@evil/bifrost_fw_sdk/types/bpmn/BpmnElementTypes';

function isHttpServiceTask(element: ElementLike): boolean {
  return element.businessObject?.get('implementation') === BpmnServiceTaskImplementation.Http;
}
```

---

## Editor chrome ordering: title bar before toolbar

**Mistake**: Rendering the `EditorToolbar` before the `EditorTitle` inside an `<Editor>` component.

**Why it matters**: The Studio's visual convention places the title bar (file name, progress, sublabel) at the very top, followed by the toolbar (action buttons, zoom controls). Reversing the order creates a disorienting layout where action buttons sit above the context they operate on.

**Correct approach**: Always render `EditorTitle` before `EditorToolbar`:

```tsx
<Editor>
  {this.renderTitleBar()}
  {this.renderToolbar()}
  <EditorContent>...</EditorContent>
</Editor>
```

---

## PaneInfoBarAction / EditorToolbarButton referencing unregistered commands causes infinite error flood

**Mistake**: Removing a command registration without removing all UI references to it (`PaneInfoBarAction`, `EditorToolbarButton`, menu items).

**Why it's catastrophic**: `PaneInfoBarAction` and similar components call `isCommandEnabled(commandName)` on every render. If the command is not registered, `CommandManager.isCommandEnabled` throws. `CommandMediator` catches the throw and opens an error notification. The notification triggers a pane/UI re-render, which calls `isCommandEnabled` again — infinite loop that freezes the application.

**Correct approach**: When removing a command, search the entire codebase for all references to its name string. If the command is still needed by a different consumer (e.g., a pane action vs. a merge editor toolbar button), keep the registration or create a separate command. If truly removing, delete all `PaneInfoBarAction`, `EditorToolbarButton`, `MenuItem_Command`, and `executeCommand` references.

---

## Modeler-level structural manipulation in merge auto-apply

**Mistake**: Using `bpmn-js` modeler APIs (`modeling.createShape`, `modeling.moveElements`, `modeling.updateProperties`) to programmatically apply structural BPMN changes during merge auto-apply.

**Why it fails** (three independent failures):

1. **Lost `$parent` after JSON serialization**: The BPMN diff runs in a **web worker** and the result is `JSON.parse(JSON.stringify(changes))`. Since `$parent` is a non-enumerable moddle property, it is lost during serialization. `applyAdded` therefore cannot resolve the parent shape for any newly added element, causing all additions to silently fail.

2. **Connections deliberately skipped**: The old engine skipped all connection additions (`SequenceFlow`, `Association`, `MessageFlow`) because `modeling.connect()` requires live element references that don't survive serialization. New sequence flows were never created.

3. **`#ref:` strings corrupt moddle references**: `bpmn-js-differ` represents element references as `#ref:<id>` strings (its internal `unref` notation). The old engine passed these strings directly to `modeling.updateProperties(shape, { targetRef: '#ref:Gateway_1' })`, which corrupts the moddle model and produces `targetRef="undefined"` in the exported XML.

**Correct approach**: Use **XML-level merging** via `DOMParser` / `XMLSerializer`. The `xmlMergeEngine()` function in `autoApplyEngine.ts` operates on the raw XML strings, copying/removing/replacing DOM elements. This avoids all three failures because: XML elements carry their parent relationship in the DOM tree, connections are just XML elements with `sourceRef`/`targetRef` attributes, and no `#ref:` translation is needed.

---

## Per-attribute conflict resolution via modeler updateProperties

**Mistake**: Using `modeling.updateProperties(shape, props)` on a hidden `BpmnModeler` to apply conflict resolutions, where `props` keys come from `resolveAttributeLabel()` (display labels like `"Element Type"`, `"Element Name"`) and values come from `stringifyValue()` (serialized representations like `"#ref:Gateway_1"`).

**Why it fails**: `modeling.updateProperties()` expects raw moddle property names (e.g. `$type`, `name`) as keys and live moddle objects as values. Display-formatted attribute names are not recognized by the moddle schema, so the update silently does nothing. Even if the keys were correct, stringified values (especially object references) would corrupt the model. Additionally, `acceptStartingSideForKey` never called the viewer refresh at all — it only updated the resolution map, leaving the viewer permanently stale.

**Correct approach**: Re-run `xmlMergeEngine()` with an adjusted skip set on every resolution change. `BpmnMergeResultModeler` stores both XML strings and recomputes the merged XML by removing resolved-to-apply-side elements from the conflict skip set (or adding reverted auto-applies to it). The rebuilt XML is loaded into the viewer, ensuring the display always matches the resolution state. `getResultXml()` also rebuilds from scratch, guaranteeing the written file reflects all resolutions.

---

## bpmn-js-differ swaps oldValue / newValue in attribute change reports

**Mistake**: Trusting that `attrs[prop].oldValue` contains the before-value and `attrs[prop].newValue` the after-value in `bpmn-js-differ`'s `_changed` entries.

**Why it's wrong**: The `ChangeHandler.changed()` function signature is `changed(model, property, newValue, oldValue)`, but the caller passes `jsondiffpatch`'s `d[0]` (left/before) as the third argument and `d[1]` (right/after) as the fourth. The result is:

- `attrs[prop].oldValue` = the **after** value (value in the new/changed definition)
- `attrs[prop].newValue` = the **before** value (value in the old/base definition)

This is the opposite of what the names suggest.

**Correct approach**: When reading attribute changes from `bpmn-js-differ`, always swap the values: use `values.newValue` as `oldValue` (before) and `values.oldValue` as `newValue` (after). This swap is applied in both `BpmnMergeResolver.buildSideDetail()` and `changeSummaryBuilder.ts: buildModifiedEntry()`.

---

### Linter rules that walk `flowElements` must skip Event Subprocesses

**Mistake**: Writing a linter rule that iterates over `container.flowElements`, treats every `bpmn:SubProcess` as a regular flow node, and flags it (e.g. as "unreachable") or recurses into it without checking `triggeredByEvent`.

**Why it fails**: Event Subprocesses (`bpmn:SubProcess` with `triggeredByEvent === true`) are triggered by their typed start event, not by incoming sequence flows. They cannot have sequence flows crossing their boundary (enforced by `event-subprocess-no-flows`). Treating them as regular flow nodes produces false positives (e.g. "unreachable") and recursing into them can leak their internal elements into the parent scope's analysis.

**Correct approach**: When iterating flow nodes for reachability, disconnection, or structural analysis, skip elements where `is(el, 'bpmn:SubProcess') && el.triggeredByEvent`. When recursing into child scopes, only recurse into subprocesses with `!el.triggeredByEvent`. See `unreachable-elements.ts` and the `collectFlowElements` helper used by `process-error-events`, `service-task-error-boundary`, and `gateway-type-mismatch` for reference.

---

### `fs.rename` fails across mount points (EXDEV)

**Mistake**: Using `fs.rename()` to move a directory between two paths that may reside on different filesystems (e.g., `/tmp` on tmpfs and the workspace on an external drive mounted at `/run/media/...`).

**Why it fails**: `fs.rename` is a single syscall that only works within the same filesystem. When source and destination are on different mount points, it fails with `EXDEV: cross-device link not permitted`. This is common in Electron apps where `os.tmpdir()` returns a path on the root filesystem while the user's project may be on an external or network drive.

**Correct approach**: Use a helper that tries `fs.rename` first and falls back to `fs.cp` + `fs.rm` on `EXDEV`. See `moveDirectory()` in `registerGitHandlers.ts` for the pattern.

---

### Menu modifiers on async menus must await the menu parameter

**Mistake**: Registering a `registerMenuModifier` callback that calls `insertAfterMenuItem(menu, ...)` without checking if `menu` is a `Promise`.

**Why it fails**: Some menu factories (notably `std/application/main`) are async — they `await` things like recently-opened file lists. `MenuManager.registerMenuModifier` wraps the factory and passes its raw return value to the modifier. When the factory is async, the modifier receives a `Promise<Menu>`, not a `Menu`. Calling `.find()` (inside `insertAfterMenuItem`) on a Promise throws `TypeError: n.find is not a function`.

**Correct approach**: Make the modifier `async` and `await` the menu parameter before using it:

```typescript
bifrost.menus.registerMenuModifier('std/application/main', async (menuOrPromise) => {
  const menu = await menuOrPromise;
  return bifrost.menus.insertAfterMenuItem(menu, 'target-id', [...]);
});
```

This is only necessary for menus whose factory is async. Sync menu factories (like context menus) pass a plain array and do not need awaiting.

---

### SDK peer dependencies must be aliased in the rspack config

**Mistake**: The SDK declares packages like `react-dnd`, `react-select`, or `@mdxeditor/editor` as `peerDependencies`, but npm still installs separate copies in `studio-sdk/node_modules/`. After replacing the `window` bridge with direct imports, the SDK's compiled JS resolves to its local copy, while the Studio uses its own copy. This creates duplicate React contexts — providers in the Studio are invisible to hooks in the SDK.

**Symptom**: `Invariant Violation: Expected drag drop context` (for `react-dnd`), or similar "missing context/provider" errors for other libraries.

**Why it fails**: rspack resolves imports relative to the importing file's location. SDK output files live under `studio-sdk/`, so `require('react-dnd')` resolves to `studio-sdk/node_modules/react-dnd` — a different module instance from `studio/node_modules/react-dnd` where `DndProvider` was created.

**Correct approach**: Add explicit `resolve.alias` entries in `rspack.config.electron.js` to force all imports to resolve to the Studio's `node_modules` copy:

```javascript
resolve: {
  alias: {
    react: path.resolve(__dirname, 'node_modules/react'),
    'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    'react-dnd': path.resolve(__dirname, 'node_modules/react-dnd'),
    'react-select': path.resolve(__dirname, 'node_modules/react-select'),
    'dnd-core': path.resolve(__dirname, 'node_modules/dnd-core'),
    '@mdxeditor/editor$': path.resolve(__dirname, 'node_modules/@mdxeditor/editor'),
    '@monaco-editor/react': path.resolve(__dirname, 'node_modules/@monaco-editor/react'),
  },
}
```

Note the `$` suffix on `@mdxeditor/editor$` — this restricts the alias to exact matches, so sub-path imports like `@mdxeditor/editor/style.css` still resolve normally.

**Rule of thumb**: Any library that the SDK lists as a `peerDependency` and that uses React context internally must be aliased in the Studio's rspack config.

---

## `require.cache` in Rspack-bundled Node.js targets

**Mistake**: Using `require.cache` in the Plugin Host bundle (or any `target: 'node'` Rspack bundle) to invalidate modules loaded via `createRequire(__filename)`.

**Why it fails**: Rspack replaces `require` with `__webpack_require__`, so `require.cache` in bundled code is `__webpack_require__.cache` — a separate module cache used by the bundler. Modules loaded via `createRequire(__filename)` (the native Node.js require) are stored in the real Node.js module cache (`Module._cache`). Deleting from `__webpack_require__.cache` has no effect on the native cache.

**Correct approach**: Use the native require's `.cache` property:

```typescript
import { createRequire } from 'node:module';
const nativeRequire = createRequire(__filename);

// To invalidate:
delete nativeRequire.cache[modulePath];
// NOT: delete require.cache[modulePath]
```

---

## ~~Mocha + ts-node + Node.js ESM resolution failures~~ (RESOLVED)

> **Resolved (2026-05-13):** The test runner was migrated from Mocha + ts-node to Vitest, eliminating this class of issues entirely.

**Symptom**: Integration tests failed with `ERR_MODULE_NOT_FOUND` on imports like `../../OsSpecificKeystroke` (no `.js` extension), despite the code being TypeScript.

**Root cause**: Mocha 11's `esm-utils.js` uses `import()` to load test files. On Node.js v24+, this triggers Node's strict ESM resolver, which requires explicit file extensions for relative imports. `ts-node` compiles TypeScript to JavaScript but does not rewrite import specifiers, so extension-less imports that work fine under CommonJS resolution fail under ESM resolution.

**Why Vitest fixes this**: Vitest uses Vite's bundler-style module resolver (powered by esbuild), which resolves TypeScript imports the same way a bundler does — extension-less imports, path aliases, and `#imports` all work without configuration. There is no `ts-node` or Node.js ESM loader in the chain.

**Decision**: See `docs/decisions.md` entry for 2026-05-13.

---

## `plugin.enabled` vs `plugin.status` — use `enabled` for UI rendering decisions

**Symptom**: After disabling a plugin at runtime via the Plugins Pane, the plugin card still renders as "enabled" — no dimming, no "Disabled" badge — even though the event fires and the pane re-renders.

**Root cause**: `PluginInfo` has two fields that describe a plugin's state:

| Field | Type | Meaning |
|-------|------|---------|
| `enabled` | `boolean` | **User intent**: should this plugin be active? |
| `status` | `'loaded' \| 'disabled' \| 'error' \| 'not-loaded'` | **Runtime state**: what is the plugin doing right now? |

When a plugin is disabled at runtime via `PluginHost.unloadPlugin()`, the host sets `status: 'not-loaded'` and `enabled: false`. The `'disabled'` status is only set during the initial `discoverAndLoadPlugins()` when a plugin is found in the `disabledPlugins` setting *before* loading. So at runtime, a disabled plugin has `status: 'not-loaded'`, not `status: 'disabled'`.

If UI code checks `plugin.status === 'disabled'` for visual indicators (CSS dimming, badge text), it will never match for plugins disabled at runtime.

**Correct approach**: Use `!plugin.enabled` for all visual "disabled" indicators. Use `plugin.status` only for runtime-specific indicators (e.g., `'error'` badge for plugins that failed to load).

```typescript
// CSS class for dimming:
const isDisabled = !plugin.enabled;

// Status badge:
if (plugin.status === 'error') return 'Error';
if (!plugin.enabled) return 'Disabled';
return null;
```

**Decision**: See `docs/decisions.md` entry for 2026-05-18.

---

### Webview `onMessage` registration vs iframe mount order

**Date**: 2026-05-19
**Subsystem**: Plugin Host → PluginIframeManager
**Severity**: Ordering gotcha (silent failure)

~~`PluginIframeManager.setMessageHandler(iframeId, handler)` previously only took effect if the iframe was already `register()`'d. If a plugin called `api.webviews.onMessage(iframeId, callback)` before the corresponding `PluginIframe` component mounted, the handler was silently dropped.~~

**Fixed (2026-05-20)**: `setMessageHandler` now stores handlers in a `pendingHandlers` map when the iframe entry does not yet exist. When `register()` is subsequently called (on iframe mount), it drains the pending handler into the new entry. This makes registration order-independent — plugins can safely call `onMessage` at any time during `activate()`, regardless of whether the iframe has mounted.

For editor documents, the `onDidOpen` callback pattern remains the idiomatic approach since it provides the `iframeId` and `uri` context. For panes, calling `onMessage` eagerly during `activate()` now works correctly.

---

### Plugin webview bridge script must be included manually

**Date**: 2026-05-20
**Subsystem**: Webview System → bridge-script.ts
**Severity**: Easy oversight (no API in iframe)

The Studio bridge script (`studio-bridge.js`) is served by the `evil-webview://` protocol at the path `/studio-bridge.js`, but it is **not** auto-injected into plugin iframes. Plugin HTML files must include it explicitly:

```html
<script src="/studio-bridge.js"></script>
```

Without this tag, `window.acquireStudioApi` is `undefined` and the iframe has no communication channel with the host. The iframe will render but cannot send/receive messages, and no error is shown.

**Correct approach**: Always include the bridge script before your app bundle in the HTML entry point. Check for `window.acquireStudioApi` existence in your JavaScript and log a warning if it is missing.

---

### Collapsed panes do not mount the iframe

**Date**: 2026-05-20
**Subsystem**: Webview System → IframePaneProvider
**Severity**: Ordering gotcha (delayed mount)

`IframePaneProvider` conditionally renders the `PluginIframe` component only when `collapsed !== true`. This means:

1. The iframe is **not** created when the pane group is initially hidden
2. `onMessage` handlers registered before the pane is first expanded will not have a mounted iframe to attach to
3. The `ready` message from the iframe is sent only on first expansion

**Correct approach**: Accept that pane iframes have deferred mount. Design the message protocol to handle late initialization (e.g., send a `ready` message on mount and wait for the host's `init` reply).

---

### Sanitizer fixer must recurse into subprocesses

**Severity**: Silent fix failure (no-op)

The sanitizer **analyzer** (`detectShapelessFlowElements`) correctly recurses into `bpmn:SubProcess` children to detect ghost elements at any nesting depth. However, the **fixer** (`findProcessContaining`) originally only searched direct `flowElements` of root `bpmn:Process` elements — it never descended into subprocesses.

This caused ghost elements inside subprocesses to be correctly detected but impossible to fix: `findProcessContaining` returned `null`, and `fixShapelessFlowNode` / `fixShapelessSequenceFlow` silently returned an empty command array. The user would click "Fix" or "Fix All" with no visible effect.

**Correct approach**: The fixer helper `findDirectContainer` (replacing the old `findInFlowElements`) must recursively walk into `bpmn:SubProcess` children and return the **immediate parent container** — not the root process. This ensures the fix command targets the correct `flowElements` array. The same recursion applies to both `fixShapelessFlowNode` and `fixShapelessSequenceFlow`.

---

### ViewMediator access after toggling pane visibility is a race condition

**Severity**: Command failure (thrown error, visible in DevTools)

When a command makes a pane area visible via `setVisibilityOfPaneAreaByPaneId` and then immediately accesses a `ViewMediator` registered by a component inside that pane, it will fail if the pane was not already visible. The reason: `setVisibilityOfPaneAreaByPaneId` mutates internal state and emits `EVENT_PANE_LAYOUT_UPDATED`, but the Workbench renders pane areas through `useDeferredValue`. React is free to delay the deferred render across multiple frames, so the component that registers the ViewMediator (e.g., a `Tree` component) has not yet mounted when the next synchronous line in the command handler runs.

**Wrong:**
```ts
bifrost.panes.setVisibilityOfPaneAreaByPaneId('inspectors/editor_document_inspector', true);
const treeview = bifrost.views.getById('editorInspector'); // throws if pane was hidden
```

**Correct:**
```ts
bifrost.panes.setVisibilityOfPaneAreaByPaneId('inspectors/editor_document_inspector', true);
const treeview = await bifrost.views.waitForAndGetById('editorInspector');
```

`waitForAndGetById` resolves immediately if the mediator already exists, or listens for the internal `EVENT_VIEW_MEDIATOR_REGISTERED` event emitted by `registerViewMediator`. It rejects after a configurable timeout (default 5 s).

### `setDirty` throws if the editor document is not open

**Severity**: Plugin error (thrown, visible in Plugin Console)

`EditorMediator.setDirty(uri, isDirty)` throws `No open editor document found for URI: …` if the URI does not correspond to a currently open tab. Plugins calling `setDirty` from a webview's `ready` handler can hit this race if the editor document has not been fully opened yet.

**Mitigation**: Only call `setDirty` after receiving the `onDidOpen` callback for the document, or check `getEditorDocumentByUri(uri)` first.

### `registerMenuBarItemModifier` requires explicit positioning

**Severity**: Bridge error (thrown, visible in Plugin Console)

The imperative `api.menuBar.registerMenuBarItemModifier(config)` throws if neither `insertAfter` nor `insertBefore` is set in the config. Unlike `registerMenuBarItem` which appends to an area, modifier registration requires explicit relative positioning.

For append-style placement (no relative positioning needed), use `api.menuBar.registerMenuBarItem(area, items)` instead. Alternatively, use manifest `contributes.paneToggles`, where omitting both fields falls back to direct area registration.

### `getMenuSync` fails for menus with async modifier chains

**Severity**: Runtime error (thrown)

`bifrost.menus.getMenuSync(menuId)` throws `Expected to not get a Promise for menu '…', but got one` whenever any modifier in the factory chain is async. The `std/application/main` menu always has async modifiers (bpmn-editor, engine modules, git-cruiser), so `getMenuSync` will always fail for it.

**Correct**: Use `await bifrost.menus.getMenu(menuId, args)` for menus that may have async modifiers. Integration tests should use `executeAsync` with `getMenu` instead of `execute` with `getMenuSync`.

### Model-less editor save: delegate absence is silent

**Severity**: UX gap

`Ctrl+S` on a dirty model-less document (plugin webview editor) where no `onSaveRequest` handler has been registered returns `false` silently — no error notification is shown. The user sees the dirty dot remain with no feedback. Plugin authors must ensure they register a save delegate for any document type that supports dirty state.

### Ctrl+S does not reach the host from inside a plugin webview iframe

**Severity**: UX gap (silent no-op without a workaround)

`KeybindingsMediator` binds keyboard shortcuts to `document.body` of the main renderer window (`studio/src/bifrost/browser/KeybindingsMediator.ts`). Keydown events originating inside a plugin's `<iframe>` (e.g. while typing in a webview-based editor) are dispatched within the iframe's own `Document` and never bubble across the frame boundary — standard DOM/browser behavior, not Studio-specific. Pressing Ctrl+S while focus is inside a webview editor therefore never reaches `std.editor.saveFocusedDocument`, and a registered `onSaveRequest` delegate is never invoked.

**Correct approach**: webview-based editor document types must intercept the shortcut themselves, inside the iframe, and relay it via `postMessage` (`(event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's'` → `event.preventDefault()` → `studioApi.postMessage({ type: 'save-requested' })`). The backend's message handler must perform the same persistence + `setDirty(uri, false)` as its `onSaveRequest` delegate, since `onSaveRequest` alone only covers host-triggered saves (Save menu, command palette, unsaved-changes-on-close dialog). See the `text-file-editors` fixture plugin (`studio/test/fixtures/plugins/text-file-editors/`) for a worked example.

### `onStartup`/eager plugins discovered after boot never activate (`'ready'` is a one-shot event)

**Severity**: Plugin permanently stuck in `pending` status; a plugin that registers editor document types (e.g. via `api.editors.registerWebviewDocumentType()`) never makes its file types openable

`PluginHost.discoverAndLoadPlugins()` defers activation of `onStartup` plugins (and eager plugins that declare permissions) until the `bifrost.events.on('ready', ...)` callback fires, so that permission-approval dialogs don't try to render before the renderer's React tree has mounted. `'ready'` is emitted **exactly once**, at the end of the window's initial `Bifrost.initialize()` call (`Bifrost.postInitialize()`). `discoverAndLoadPlugins()` is also called later in the window's lifetime — by `PluginHost.refresh()`, which backs the "Reload Plugins" command (`plugins.refreshPluginList`) and the cross-window plugin-state resync — and, before the fix, always registered a *fresh* `on('ready', ...)` subscription. Since `'ready'` had already fired once and would never fire again, any `onStartup`/permission-gated plugin discovered this way (e.g. a plugin folder dropped into the plugins directory after the Studio was already running, followed by "Reload Plugins" instead of a full restart) waited forever for an event that had already passed. The plugin's card showed `Pending activation` indefinitely, no permission dialog ever appeared, and its `activate()` — including any `registerWebviewDocumentType()` calls — never ran, so files matching its document types fell through to "Could not open document".

**Correct approach**: before subscribing to `'ready'`, check whether the app has already finished its initial boot (`bifrost.isInitialized`, set `true` at the very end of `Bifrost.initialize()`, right after `'ready'` is emitted). If it's already `true`, invoke the deferred-plugin-loading logic immediately instead of waiting for the event. See `PluginHost.discoverAndLoadPlugins()` in `studio/src/bifrost/electron-renderer/plugin-host/PluginHost.ts`, and the regression test `'onStartup plugin added after boot activates once discovered via refresh'` in `studio/test/integration/plugins/plugin-host.test.ts`.

**Related, but distinct**: the manifest's `activationEvents` has no way to declaratively pre-register an editor document type / URI pattern (unlike VS Code's `contributes.customEditors`). `onDocumentType:X` activation only works for a type that some *other*, already-active code has registered (e.g. the built-in `bpmn`/`dmn` types) — a plugin cannot use it to lazily activate itself for a document type it defines. `onStartup` (or plain eager loading, which is functionally identical in terms of the `'ready'`-gated permission dialog) is therefore the only viable activation strategy for a plugin that registers its own webview document types.

### Plugin theme CSS: dots in theme IDs must be escaped in selectors

**Severity**: Theme completely non-functional (Studio renders unstyled)

Plugin theme IDs are auto-namespaced to `plugin.<pluginName>.<localId>`, which contains dots. When building CSS selectors like `.bifrost.bifrost-theme--plugin.theme-demo.demoNight`, CSS interprets the dots as **separate class selectors** — targeting an element with classes `bifrost-theme--plugin`, `theme-demo`, and `demoNight`. The actual DOM class is a single name with literal dots. The selector never matches.

**Correct**: Escape dots in CSS selectors: `.bifrost.bifrost-theme--plugin\.theme-demo\.demoNight`. Use `themeId.replace(/\./g, '\\.')` before interpolating into CSS. This applies to both `PluginHostBridge.injectPluginThemeCSS` and `ContributionRegistrar.registerTheme`.

### Plugin themes require base theme layering

**Severity**: Theme completely non-functional (Studio renders unstyled)

Built-in themes (Bifrost Night, Forge World Night, etc.) each define a complete set of ~400 CSS custom property tokens. Plugin themes only provide partial overrides (typically 4–50 tokens). If only the plugin theme class is applied, the ~350 unoverridden tokens become `undefined`, leaving the entire Studio unstyled.

**Correct**: `ThemeMediator.getThemeClassNames()` computes the correct class string. For plugin themes (IDs starting with `plugin.`), it includes the matching base theme class (`bifrost-theme--dark` or `bifrost-theme--light`) before the plugin theme class. `App.tsx` uses this method to set the root element's `className`. The plugin's `<style>` element wins via CSS source order for the tokens it overrides; all other tokens inherit from the base theme.

**Important**: Direct DOM manipulation via `classList.add/remove` in `ThemeMediator.applyTheme` is overwritten by React reconciliation, since `App.tsx` controls the root `className`. Theme class computation must go through `getThemeClassNames()` → React state → JSX `className` to survive re-renders.

### Plugin theme tokens must use actual Studio token names

**Severity**: Theme overrides silently ignored (no visual effect)

Plugin themes define CSS custom property overrides. If the token names don't match the actual tokens used in the Studio's SCSS, the overrides are applied but have no visible effect. For example, `--theme-background` does nothing because the Studio uses `--theme-bg`.

The canonical token names are defined in `studio/src/bifrost/styles/theme.dark.scss` and `theme.light.scss`. The most commonly overridden tokens are `--theme-bg`, `--theme-fg`, `--theme-fg-secondary`, `--theme-accent`, `--theme-border`, and the `--theme-surface-*` family. Plugin developers should reference these files for the full token list.

### Overly broad `.djs-overlay` CSS rules kill pointer events on native bpmn-js overlays

**Severity**: Feature completely non-functional (drill-down, future bpmn-js interactive overlays)

`component.bpmn-diff-infrastructure.scss` originally contained:

```scss
.bifrost {
  .djs-overlay { pointer-events: none; }
}
```

This compiles to `.bifrost .djs-overlay { pointer-events: none; }`, which disables pointer events on **every** `.djs-overlay` in the application — not just diff viewers. The native bpmn-js drill-down button (`.bjs-drilldown`) lives inside a `.djs-overlay.djs-overlay-drilldown` wrapper, so it inherits `pointer-events: none`, making it visible but completely unclickable.

**Correct**: Scope the rule to the diff/merge containers where it's actually needed:

```scss
.splitter-layout--bpmn-diff .djs-overlay,
.splitter-layout--bpmn-merge .djs-overlay {
  pointer-events: none;
}
```

**Additional hardening** for Studio's own overlays: `BpmnElementOverlayManager.addTrackedOverlay()` sets `pointer-events: none` on both the diagram-js `htmlContainer` wrapper and the inner container div after creation, so Studio overlays are always click-through regardless of CSS. Interactive children (documentation indicators, script markers) declare `pointer-events: all` explicitly.

---

### `BpmnElementOverlayManager.updateAll` must not destroy-and-recreate all overlays

**Severity**: Performance (flicker on every re-render), correctness (orphaned React roots)

The original `updateAll()` implementation called `removeAll()` followed by `addOverlay()` for every element in the new set. This caused two problems:

1. **Flicker**: Every overlay was destroyed and recreated on each refresh cycle — even if nothing changed. For diagrams with many annotated elements, this produced visible flicker.
2. **React root leaks**: `addReactElementOverlay` created a `createRoot()` for each overlay container, but `removeAll()` only called `overlays.remove(id)` on the diagram-js side. The React roots were never `unmount()`ed, leaving orphaned React trees.

**Correct approach** (implemented): `BpmnElementOverlayManager` now tracks each overlay in an `activeOverlays: Map<elementId, TrackedOverlay>` that stores the diagram-js overlay ID, a structural fingerprint, and the React root. `updateAll()` performs a diff:

- **Removed**: elements in the old set but not the new set → `reactRoot.unmount()` + `overlays.remove(id)`
- **Unchanged**: fingerprint matches → skip entirely
- **Added/changed**: remove the old overlay (with proper cleanup), then create the new one

The `update(elementId)` method follows the same pattern for single-element updates, ensuring it only removes the *tracked* overlay for that element rather than calling the diagram-js `overlays.get({ element })` which would indiscriminately remove all overlays (including bpmn-js native ones like drill-down buttons).

---

### SDK type declarations must match implementation enum values exactly

**Severity**: Critical (runtime type mismatch for plugin authors)

The SDK type declarations in `studio-sdk/types/dmn/` are ambient declarations (`declare class`) that define the public API surface visible to plugin authors. If enum values or type shapes in the SDK diverge from the actual implementation, plugin code will compile against the SDK but fail at runtime.

**Example of the bug (fixed 2026-06-03)**: `DmnElementType.Decision` was declared as `'Decision'` in the SDK but the implementation used `'dmn:Decision'` (moddle-prefixed). Plugin code comparing `element.type === DmnElementType.Decision` would always be `false`.

**Prevention rules**:
1. SDK enum values must be copied verbatim from the implementation source (e.g. `studio/src/modules/dmn-editor/DmnElementTypes.ts`)
2. SDK method signatures must only declare methods that actually exist on the implementation class
3. When adding new SDK types, verify the method exists in the implementation before declaring it
4. The SDK build step (`tsc` in `studio-sdk/`) does **not** catch these mismatches because `declare class` is ambient — only runtime testing reveals the gap

---

## Command Naming: Old Prefixes Removed

**Date**: 2026-06-03

Before the command naming normalization, many commands used camelCase compound prefixes instead of dotted segments. These old prefixes have been replaced:

| Old Prefix | New Prefix |
|------------|------------|
| `machineSanctum.*` | `dev.machineSanctum.*` |
| `settings.*` | `std.settings.*` |
| `startpage.*` | `std.startpage.*` |
| `help.*` | `std.help.*` |
| `aboutpage.*` | `std.aboutpage.*` |
| `bpmnDiff.*` | `bpmn.diff.*` |
| `bpmnLinter.*` (commands) | `bpmn.linter.*` |
| `feel.*` | `bpmn.feel.*` |
| `dmnDiff.*` | `dmn.diff.*` |
| `gitCruiser.*` (commands) | `git.*` |
| `merge.*` | `git.merge.*` |
| `engineBrowser.*` (commands) | `engine.workspace.*` |
| `engineDebugger.*` (commands) | `engine.debugger.*` |
| `engineMenubar.*` | `engine.menubar.*` |
| `engineRemoteBpmnViewer.*` (commands) | `engine.modelViewer.*` |
| `TaskView.*` | `engine.debugger.taskView.*` |

**Important**: Settings keys were also renamed during this migration (e.g., `engineBrowser.processInstanceList.autoRefresh` → `engine.processExplorer.autoRefresh`). Both command IDs and settings keys now use the `engine.*` prefix.

If you encounter a command that uses an old prefix, it is a bug. The first dotted segment of every command ID must be one of: `std`, `bpmn`, `dmn`, `engine`, `git`, `plugins`, `dev`.

---

## SES `lockdown()` and npm Package Compatibility

SES `lockdown()` (Phase 7) freezes all JavaScript intrinsics (`Object.prototype`, `Array.prototype`, etc.) inside plugin Worker Threads. Packages that mutate intrinsics will throw at runtime.

**Common incompatible patterns:**
- `Object.prototype.toJSON = ...` (custom serialization)
- Polyfills that patch `Array.prototype.flat`, `String.prototype.replaceAll`, etc.
- Libraries using `eval()` or `new Function()` for template compilation

**Workaround**: Use `overrideTaming: 'moderate'` in the `lockdown()` call (already configured), which allows `obj.prop = value` override patterns while still blocking `Object.prototype.prop = value` patches.

**Dynamic `import()` not supported**: The Compartment does not provide an `importHook`. Plugins that use `import()` (or dependencies that use it internally) will fail. All module loading must go through the gated `require()`.

---

## Plugin Network Access: Total Blackout

Plugins have **zero network access** in v1. The following are all `undefined` or blocked inside the sandbox:

- `globalThis.fetch`
- `require('http')`, `require('https')`, `require('net')`
- `XMLHttpRequest`, `WebSocket`
- Dynamic `import()` from URLs

There is no proxied network API. This is a deliberate security decision to prevent supply chain attacks and data exfiltration. If network access is needed in the future, it would be implemented as a controlled proxy with URL allowlisting.

---

## Plugin Command Namespace Convention

All plugin commands are automatically prefixed with `plugin.<name>.` at registration time (transparent prefixing, Phase 7). Plugins use short IDs internally:

- Plugin registers `api.commands.register('greet', handler)` → registered as `plugin.happy-plugin.greet`
- Plugin executes `api.commands.executeCommand('greet')` → resolved to `plugin.happy-plugin.greet`
- Plugin executes `api.commands.executeCommand('std.notifications.show')` → passes through (known group)

The `plugins.*` prefix (plural) is reserved for internal Studio commands and is hard-denied for plugins. Do not confuse `plugin.<name>.*` (user plugin commands) with `plugins.*` (internal commands).

---

## Plugin Settings Namespace Enforcement

Plugins can only **write** to settings keys starting with `plugin.<pluginName>.`. Attempting to write to any other key throws `PermissionDeniedError`.

Plugins can **read** any setting (unrestricted). Settings are user preferences, not secrets.

Settings **registration** (descriptors) is similarly constrained: all descriptor keys must start with `plugin.<pluginName>.`.

---

## Missing manifest permissions

**Mistake**: A plugin calls `std.*` (or other gated) commands without declaring the matching permission in `package.json` / manifest `permissions`.

**Why it fails**: `PermissionGate` denies the call at runtime even when the command exists and the handler would succeed. There is no fallback or prompt to auto-grant — the plugin simply cannot reach Studio APIs it did not declare.

**Correct approach**: Declare every permission the plugin needs before shipping. The seven available permissions are: `filesystem`, `commands.std`, `commands.bpmn`, `commands.dmn`, `renderer-modules`, `native`, `system-info`. Map each API usage to its permission (e.g. `api.commands.executeCommand('std.notifications.show')` requires `commands.std`).

---

## `native` permission bypasses SES

**Mistake**: Granting `native` in the manifest for convenience, or bundling a dependency that loads `.node` binaries without reviewing whether native code is truly required.

**Why it matters**: The `native` permission allows loading compiled `.node` modules, which execute **outside** the SES Compartment in the plugin Worker Thread. This effectively bypasses the sandbox for that code path — the same supply-chain and memory-safety risks the sandbox is meant to contain.

**Correct approach**: Only grant `native` to plugins that genuinely need native bindings. Treat it as the highest-risk permission; prefer pure-JS alternatives. Review third-party dependencies for optional native addons before requesting the permission.

---

## Quarantine recovery

**Mistake**: Expecting a quarantined plugin to re-enable via the normal enable toggle in the Plugins pane after repeated crashes (default: 3 crashes within 60 seconds).

**Why it fails**: `QuarantineManager` blocks reload until quarantine state is explicitly cleared. A simple toggle does not reset the crash counter or trust flag — the plugin stays quarantined and will not load.

**Correct approach**: Use **Trust & Re-enable** from the plugin card wrench menu. That flow calls `trustAndReEnablePlugin()`, which clears quarantine in `QuarantineManager` before reloading. Document this for plugin authors whose plugins crash during development.

---

## Scoped package name normalization

**Mistake**: Using the raw npm scoped name (`@scope/name`) in identifiers such as command IDs, pane IDs, theme IDs, settings namespaces, or webview hostnames.

**Why it fails**: Scoped package names contain `@` and `/`, which are rejected by `CommandManager`'s validation regex and are illegal in URL hostnames. Any identifier constructed as `` plugin.${pluginName}.${id} `` will fail if `pluginName` contains these characters.

**Correct approach**: The Studio normalizes scoped names at discovery time in `discoverSinglePlugin()` using `pluginNameToHostname()` from `ScopedPluginName.ts`. The `DiscoveredPlugin.name` (and thus `PluginInfo.name`) is always the safe form: `@scope/name` becomes `scope--name`. The original npm name is preserved in `PluginInfo.packageName` for display purposes. All identifier construction sites (`PluginHostBridge`, `ContributionRegistrar`, `CommandsApi`, etc.) receive the already-normalized `name`, so they need no special handling.

---

## Cross-plugin iframe messaging blocked

**Mistake**: A plugin registering `api.webviews.onMessage` for another plugin's iframe ID, or calling `postMessage` targeting another plugin's iframe.

**Why it fails**: `PluginHostBridge` enforces iframe ownership on both inbound handlers and outbound `postMessage`. Cross-plugin iframe communication is intentionally forbidden to prevent one plugin from snooping on or injecting into another plugin's UI surface.

**Correct approach**: Restrict messaging to iframes owned by the calling plugin. For host-mediated coordination between plugins, use Studio commands, events, or shared settings — not direct iframe bridges. Attempts throw `PermissionDeniedError`.

---

## Fire-and-forget `activatePlugin` calls cause "Pending activation" deadlock

**Mistake**: Calling `activationManager.activatePlugin(name)` in a loop without serialization for `onStartup` plugins. The activation involves async IPC (permission dialogs, `PH_LOAD_PLUGIN`, sandbox startup, command registration). Without serialization:
- Multiple permission dialogs compete simultaneously.
- Plugin status stays `'pending'` because concurrent activations interfere.
- Stub callbacks from `ContributionRegistrar` see `state === 'activating'` and return early instead of waiting, producing false "command was not registered" warnings.

Note: You also cannot `await` the activations directly inside `discoverAndLoadPlugins` — the UI must finish rendering before permission dialogs can be shown, so blocking the init chain would deadlock the entire Studio.

**Correct approach**: `onStartup` activations are deferred until the Bifrost `ready` event fires (guaranteeing the UI is available), then run **sequentially** via `activatePluginsSequentially()` so permission dialogs don't compete. `ActivationManager` stores the activation promise in `pendingActivations` so concurrent callers (e.g. stub callbacks triggered by the user while activation is in flight) join the existing promise rather than returning early.

---

## Deprecated SES `lockdown()` options cause console warnings

**Mistake**: Passing `dateTaming` or `mathTaming` to `lockdown()`. These options were removed in SES 2.x and produce `[stderr]` deprecation warnings at startup.

**Correct approach**: Only pass supported options: `errorTaming`, `overrideTaming`, `consoleTaming`. The deprecated taming options were no-ops in SES 2.x — removing them is behavior-neutral.

---

## Spreading a Proxy produces an empty object

**Mistake**: Using `{ ...createNamespaceProxy('editors'), onDidOpen(...) {...} }` in the sandbox worker's `createPluginApi()`. JavaScript's spread operator calls `Object.keys()` / `ownKeys` on the target; a `Proxy` with only a `get` trap has no enumerable keys, so the spread yields `{}`. Only the explicitly defined methods remain, and all Proxy-based methods silently vanish.

**Correct approach**: When a namespace needs both explicit callback methods **and** a catch-all Proxy for arbitrary API requests, create a `new Proxy(explicitMethods, { get(target, method) { if (method in target) return target[method]; return (...args) => sendApiRequest(ns, method, args); } })`. The explicit methods take priority; unknown methods fall through to the Proxy trap.

---

## Bridge handler methods expecting `pluginName` in `args[0]`

**Mistake**: Writing bridge handler methods (e.g. `handleStatusBarApi`, `handlePanesApi`) that destructure `pluginName` from `args[0]`, assuming the caller prepends its name. The sandbox worker sends only the plugin's actual arguments — it does not prepend `pluginName`. This shifts every argument position and corrupts all parameters.

**Correct approach**: Every bridge handler receives `callerName` as a separate parameter from `executeApiRequest`, which derives it from the attested `payload.pluginName` stamped by the SandboxManager. Handlers must use `callerName` for namespacing and **never** read a plugin name from the args array.

---

## `PH_REGISTER_CALLBACK` errors silently swallow the ack

**Mistake**: Calling `bridge.registerCallback(payload)` inside `handleHostMessage` without a try/catch. If the bridge throws (e.g. "Command already registered"), the ack message is never sent. The SandboxManager's `request()` promise hangs forever, and the worker's `await` also hangs, leading to a startup timeout.

**Correct approach**: Wrap `bridge.registerCallback()` in a try/catch. On failure, send an error ack (`{ success: false, error: msg }`) with the same `requestId`, so the SandboxManager can reject the worker's pending promise immediately.

---

## No cleanup of bridge resources after failed plugin activation

**Mistake**: When a plugin's sandbox times out or crashes during activation, commands and callbacks partially registered before the failure remain in the `CommandManager`. On retry, these cause "Command already registered" errors.

**Correct approach**: Call `bridge.disposePlugin(pluginName)` in the `ActivationManager` catch block (via `PluginHost.cleanupPluginResources()`) so that all partially registered resources are torn down before the error state is reported.

---

## Plain-object sandbox API namespaces silently missing methods

**Mistake**: Defining a sandbox-worker API namespace (like `settings`) as a plain object with only a subset of methods, while the bridge handles additional methods (like `has`, `getSchema`, `getDefaults`, `add`, `removeValue`). The missing methods are `undefined` on the object, so calling them produces `TypeError: api.settings.X is not a function` at runtime.

**Correct approach**: Wrap the namespace in a `Proxy` (same pattern as `editors`, `workspace`, `statusBar`, etc.) where explicit methods (like `onDidChange`) are defined on the target, and all other methods fall through to `sendApiRequest(namespace, method, args)`. This ensures every bridge-supported method is accessible.

---

## Callback disposers must return `{ dispose }`, not a plain function

**Mistake**: Having `createCallbackApi.register()` return a plain function `() => void` as the disposer, while plugin code (and the canonical `AbstractSubscription` pattern in the Studio) expects an object with a `.dispose()` method. Calling `.dispose()` on a function produces a `TypeError`.

**Correct approach**: Return `{ dispose() { ... } }` from `createCallbackApi.register()`. This aligns with the `AbstractSubscription` pattern used throughout the codebase and matches what plugin authors expect.

---

## `registerCallback` silently succeeds for unhandled namespace+method

**Mistake**: The bridge's `registerCallback` method uses a chain of `if` statements with no fallback. An unrecognised `namespace.method` combination falls through all branches without registering anything, but the ack still reports `{ success: true }`. The plugin believes the callback is wired, but it never fires.

**Correct approach**: Each `if` branch should `return` after handling. At the end of the method, log a `console.warn` with the unhandled namespace, method, and plugin name so the issue is visible in the Plugin Host log.

---

## TypeScript fixture plugins must be recompiled after source changes

**Mistake**: Editing `src/index.ts` of a TypeScript-based fixture plugin (like `webview-showcase`) without recompiling to `dist/index.js`. The sandbox loads the file specified in `package.json`'s `"main"` field — typically `dist/index.js` — not the TypeScript source. A stale `dist/index.js` will run old code that may contain incompatible API usage (e.g., passing callbacks inline where the sandbox API now expects separate callback registrations).

**Symptom**: `DataCloneError: <function> could not be cloned` — a function ends up in a `port.postMessage()` call because the old compiled code passes it as part of an argument object.

**Correct approach**: After editing a TypeScript fixture plugin, run `npx tsc --project tsconfig.json` in the plugin directory to regenerate `dist/index.js`. If the user copies plugins to a custom directory, they must re-copy after recompilation.

---

## Sandbox startup timeout too short for plugins with many registrations

**Mistake**: Setting a short startup timeout (`DEFAULT_STARTUP_TIMEOUT_MS`) when plugins like `kitchen-sink` make 80+ sequential `await` calls during `activate()`. Each call is a full IPC round-trip (Worker → SandboxManager → Renderer → SandboxManager → Worker) taking 20–100ms per hop. Combined with SES `lockdown()` overhead (~1–2s), this easily exceeds short timeouts, especially on slow filesystems.

**Correct approach**: Use a 60-second default startup timeout. For the long term, consider batching callback registrations to reduce the number of sequential IPC round-trips.

---

## `connection.send()` does not include `requestId` at message top level

**Mistake**: Using `connection.send(PH_CALLBACK_RESULT, { ...payload, requestId })` to forward callback results from the child process to the renderer. `send()` creates a fire-and-forget message with no top-level `requestId`. The renderer's `handleResponse()` checks `message.requestId` at the top level and returns `false` if missing. Every `request(PH_CALLBACK_INVOCATION)` therefore times out after 30 seconds.

**Correct approach**: Use `connection.respond(type, requestId, payload)` which places `requestId` at the message top level, matching `handleResponse()`'s expectation. Also send an error response (via `respond()`) when callback routing fails in `SandboxManager.routeCallback()`, instead of silently returning.

---

## Worker-side `host.event` handler must dispatch to local callbacks

**Mistake**: The worker's `host.event` message handler was a no-op (`// Events are handled by registered callbacks`). `SandboxManager.broadcastEvent()` posts events to all workers, but the worker never dispatched them to plugin-registered `api.events.on()` callbacks.

**Correct approach**: Maintain an `eventCallbackMap` (`Map<string, string[]>`) mapping event names to callback IDs. When `host.event` arrives, look up the matching callback IDs and invoke them via the `localCallbacks` map. The `events.on()` method must register into both `localCallbacks` and `eventCallbackMap`.

---

## `node:` prefix bypasses ModuleGate security checks

**Mistake**: The `gatedRequire` function in `ModuleGate.ts` checks module specifiers against string sets like `ALWAYS_BLOCKED` and `REQUIRES_FILESYSTEM`. These sets contain bare names (`'fs'`, `'child_process'`, etc.), but Node.js also accepts the `node:` prefix (`require('node:fs')`). A plugin can bypass all security checks by using `require('node:child_process')`.

**Correct approach**: Normalize the specifier by stripping the `node:` prefix before any checks: `const normalized = specifier.startsWith('node:') ? specifier.slice(5) : specifier`. Apply normalization in both `gatedRequire()` and `gatedRequire.resolve()`.

---

## Activation error must dispose event subscriptions

**Mistake**: When `doActivatePlugin()` fails with an exception, the catch block sets the state to `'error'` and cleans up plugin resources, but does not dispose the activation event subscriptions. Since `activatePlugin()` does not block on `'error'` state (only `'activated'` and `'disabled'`), the subscriptions keep firing, re-triggering activation, which fails again — creating a retry loop with notification spam.

**Correct approach**: Call `this.disposeSubscriptions(pluginName)` in the catch block of `doActivatePlugin()`.

---

## Proxy `in` operator may behave unexpectedly through SES membranes

**Mistake**: Using `if (method in target)` in a Proxy `get` trap to check whether an explicit method exists on the target object. When the Proxy crosses an SES `Compartment` boundary, the membrane wrapping may interfere with the `in` operator's behavior, causing it to return `false` for methods that actually exist on the target. This causes the fallthrough to `sendApiRequest`, which serializes the entire argument list — including callback functions — through `port.postMessage()`, resulting in `DataCloneError`.

**Correct approach**: Use `typeof target[method] === 'function'` instead of `method in target`. This directly accesses the property and checks its type, which is robust against membrane interference. Additionally, the `sendApiRequest` and `sendRegisterCallback` functions validate arguments with `assertNoFunctions()` as a defense-in-depth measure.

---

## Each command ID may be registered only once

**Mistake**: Calling `commands.register('some.command', handler)` and then calling `commands.register('some.command', handler, { visibleInSearch: true, description: '...' })` to add palette visibility. This throws `"Command already registered: some.command"` at module load time, preventing the entire module from starting.

**Why it happens**: Every `register` call invokes `doRegisterCommand`, which stores the callback and metadata in a single registry entry keyed by command name. A second call with the same ID attempts to overwrite an existing entry and is rejected.

**Correct approach**: Use exactly one `register` call per command ID, combining all desired options:

- **Internal/programmatic command** — omit options (defaults: not searchable, no context):
  `commands.register('some.command', handler)`
- **User-facing searchable command** — set visibility and description in the same call:
  `commands.register('some.command', handler, { visibleInSearch: true, description: 'Some Command' })`
- **Command with context or enabled predicate** — add `expectsContext` and/or `enabledWhen` to the same options object.

Never call `register` twice for the same ID.

---

## `insertAfterMenuBarItem` / `insertBeforeMenuBarItem` requires the anchor item to already exist

**Mistake**: A module's `initializePanes` calls `bifrost.menuBar.insertAfterMenuBarItem(menuBarItems, 'pane/left/plugins', ...)` inside a menu modifier, but the `plugins` module has not loaded yet. `insertAfterMenuBarItem` throws `"Could not find item with id 'pane/left/plugins'"`, which propagates through the menu rebuild, crashing the entire pane system (left sidebar, right property panes, and menu bar all break).

**Why it happens**: Modules load sequentially in `createAndInitializeBifrost.ts`. Menu modifiers registered by earlier modules run immediately. If the anchor ID belongs to a module that loads later, it doesn't exist yet when the modifier executes for the first time.

**Correct approach**: Only reference anchor IDs from modules that load **before** yours. The load order and the menu item insertion chain are:

| Load order | Module | Registers menu item | Safe anchors |
|-----------|--------|-------------------|--------------|
| 1 | `std` | `pane/left/explorer`, `pane/left/search` | (base items) |
| 2 | `git-cruiser` | `pane/left/git` | `pane/left/search` |
| 3 | `engine-workspace` | `pane/left/engines` | `pane/left/git` |
| 4 | `plugins` | `pane/left/plugins` | `pane/left/git` |

Check `createAndInitializeBifrost.ts` for the authoritative load order before choosing an anchor.

---

## `updateCurrentData` without `updateOriginalAndCurrentData` causes permanent dirty state

**Mistake**: An `EditorDocumentModel` subclass calls `this.updateCurrentData(data)` to push new data to the renderer. The document tab immediately shows a dirty indicator (dot) and never clears, even though the view is read-only and has nothing to "save".

**Why it happens**: `EditorDocumentModel` tracks `originalData` and `currentData` separately. `updateCurrentData` only sets `currentData`. If `originalData` was never set (or was set to a different value), the framework sees `original !== current` and marks the document dirty. This is by design for file-backed editors (where dirty means "unsaved changes"), but breaks non-file views like dashboards and process lists.

**Correct approach**: Override `updateCurrentData` to keep both in sync:

```typescript
protected updateCurrentData(data: any): void {
  super.updateOriginalAndCurrentData(data, data);
}
```

This forces `originalData` and `currentData` to always be identical, preventing the dirty state from ever appearing. All non-file-backed `EditorDocumentModel` subclasses (engine views, debugger views, etc.) should include this override.

---

## Linter reachability rule must not rely on `outgoing` / `incoming` properties

**Mistake**: A linter rule traverses the BPMN graph by iterating `flowNode.outgoing` (the moddle-resolved back-reference array). For externally authored or imported BPMN files that lack explicit `<bpmn:outgoing>` / `<bpmn:incoming>` child elements on flow nodes, this array is empty — so the BFS finds nothing reachable beyond the start event, producing false "Element is not reachable" findings.

**Why it happens**: In the BPMN 2.0 spec, `<bpmn:incoming>` and `<bpmn:outgoing>` on flow nodes are redundant convenience elements. The authoritative connection is defined by the `sourceRef` / `targetRef` attributes on `<bpmn:sequenceFlow>`. Many BPMN editors omit the redundant elements entirely, and `bpmn-moddle` only populates the back-references when it resolves them during import (which doesn't always happen for externally loaded XML).

**Correct approach**: Build an adjacency map from sequence flow `sourceRef` / `targetRef` instead of relying on `flowNode.outgoing`:

```typescript
const outgoingTargets = new Map<string, string[]>();
for (const el of elements) {
  if (is(el, 'bpmn:SequenceFlow') && el.sourceRef?.id && el.targetRef?.id) {
    if (!outgoingTargets.has(el.sourceRef.id)) {
      outgoingTargets.set(el.sourceRef.id, []);
    }
    outgoingTargets.get(el.sourceRef.id)!.push(el.targetRef.id);
  }
}
```

Then use `outgoingTargets.get(current.id)` during BFS traversal. This works regardless of whether `<bpmn:outgoing>` elements are present in the XML.

---

## `registerSharedRessource` for per-document state breaks multi-instance isolation

**Mistake:** Using `studio.registerSharedRessource(key, value)` to share selection state, parsed models, or other per-document data between a model and its panes.

**Why it's wrong:** `registerSharedRessource` is a global singleton store keyed by string. When two tabs register the same key (e.g. two Process Explorer tabs connected to different engines), the last write wins. Inspector panes reading the shared resource display data from whichever tab updated last — not necessarily the active one. This silently breaks multi-engine isolation and multi-tab workflows.

**Correct approach:** Store per-document state on private model fields and expose it via public getters. Panes cast `props.editorDocumentModel` to the concrete model type and call the getter directly (the "Debugger pattern"):

```typescript
// In the model
private selectedElement: MySelection | null = null;
private selectionRevision = 0;

selectElement(element: MySelection): void {
  this.selectedElement = element;
  this.selectionRevision++;
  this.updateMetadata({ selectionRevision: this.selectionRevision });
}

getSelectedElement(): MySelection | null {
  return this.selectedElement;
}

// In the pane
const model = props.editorDocumentModel as MyDocumentModel | null;
const selection = model?.getSelectedElement() ?? null;
```

The `selectionRevision` counter in metadata acts as a lightweight re-render trigger without persisting the actual selection object to localStorage. See `docs/architecture/editor-documents.md` §Data Placement Rules for the full data placement principle.

**Legitimate uses of `registerSharedRessource`:** True global singletons like `EngineConnectionManager` or intentionally cross-engine aggregates like `TASK_INBOX_PENDING_COUNTS_KEY` for sidebar badges.

### P-Studio-1 — Do not run a lightweight GraphQL query after a full data load

**Symptom:** The debugger shows stale FNI data (missing tokens, missing `typeProperties`, missing `errorInfo`). Child PI links from Call Activities disappear after WS events update the in-memory model. PI state transitions are not reflected in the UI.

**Root cause:** The `SubscribeThenSnapshot` class used to run a **lightweight** GraphQL snapshot query after subscribing to the WS channel. This lightweight snapshot (missing tokens, timestamps, typeProperties, errorInfo) replaced the full data already loaded by `EngineAdapter.loadProcessWithXml()`. Every subsequent WS event then rebuilt `flowNodeInstances` from the lightweight overlays, discarding previously-loaded full data.

**Correct approach:** `SubscribeThenSnapshot` should never perform its own GraphQL query. It uses a **subscribe-before-load** pattern: `subscribe()` establishes the WS subscription and starts buffering events, then `setInitialSnapshot()` is called after the full data load completes, draining any events that arrived during the load window. For FNI detail data not carried by WS events (tokens, timestamps), a batched GraphQL query (`queryFlowNodeInstances` with `id: { in: [...ids] }`) fires after a 500ms coalescing debounce, then triggers a single atomic render cycle. PI state changes trigger a full re-query immediately.

### P-Studio-2 — Do not use `payloadContract` for catch-side message events

**Symptom:** A contract authored on a catch-side message event (IntermediateCatchEvent, BoundaryEvent, StartEvent, ReceiveTask) is silently ignored at runtime, or the wrong pane appears in the Studio.

**Root cause (historical):** Before D-MSG-3, the Engine stored all message event contracts as `payload_contract` on `EventDefinition.Message`. This was semantically wrong — catch-side events receive data, so they should use `result_contract` (same as tasks). The Studio's BPMN editor and debugger reflected this by only showing contracts for task types.

**Correct approach:** Contracts are direction-aware flow-node concerns:
- **Throw-side** (sends data): use `<evil:payloadContract>` at the flow-node level → stored in `type_data.payload_contract` → shown in the Payload Contract pane
- **Catch-side** (receives data): use `<evil:resultContract>` at the flow-node level → stored in `type_data.result_contract` → shown in the Result Contract pane
- **Never** place contracts inside `<bpmn:messageEventDefinition><bpmn:extensionElements>` — the Engine's SaxHandler ignores them there since D-MSG-3
- **Signal events** have no contract support — do not add contract elements to signal events

### P-Studio-3 — All `fragment+` URIs must include `fragmentId`

**Symptom:** Opening a fragment document (or closing any document while a non-conforming fragment tab is open) crashes the entire Editor Area irrecoverably with `"Could not parse fragment/data from uri (fragmentId missing)"`.

**Root cause:** `EditorAreaManager.closeEditorDocument()` iterates ALL open tabs with `fragment+` URIs and calls `parseOpenInNewTabUrl()` on each. That function requires a `fragmentId` key in the hash fragment. If any tab uses `fragment+` in its URI scheme but hand-builds the URI without `fragmentId`, the parse throws and the entire editor area crashes — including the ability to close tabs.

**Correct approach:** Always use `getUrlForOpenInNewTab(type, parentUri, fragmentId, additionalData)` from the SDK to build fragment URIs. Never hand-build strings with the `fragment+` prefix. The `fragmentId` and `parentUri` are mandatory for the fragment lifecycle management (close parent → close children, rename propagation).

**Defense layers:**
1. **Gate at open time** — `EditorMediator.doFocusOrOpenEditorDocument()` validates all `fragment+` URIs via `parseOpenInNewTabUrl()` before creating a new editor document. If parsing fails, the document is rejected and a **user-visible error notification** is pushed. The malformed document never enters the editor area.
2. **Catch in existing-document iteration** — `EditorAreaManager.getFragmentEditorDocumentsByParentUri()` and `EditorArea.getParentUriIfFragmentUri()` catch parse errors on already-open documents (e.g. from deserialized state) and push an error notification instead of crashing. Malformed documents are excluded from fragment matching but remain openable for manual inspection/closure.

### P-Studio-4 — Do not discard fields from WS event payloads

**Symptom:** `typeProperties` (including `child_process_instance_id` for Call Activities) and `errorInfo` from `FlowNodeInstanceFinished` events are not reflected in the debugger.

**Root cause:** `SubscribeThenSnapshot.handleFniFinished` previously only updated the `state` field from the event, silently discarding `typeProperties` and `errorInfo` even though the Engine includes them in the event payload.

**Correct approach:** Always merge all available fields from WS event payloads into the in-memory snapshot. The batched GraphQL fetch supplements this with fields not on the event (tokens, timestamps), but fields that ARE on the event should be consumed immediately.

### P-Studio-5 — Plugin overlays only support pre-defined types

**Symptom:** A plugin tries to inject custom HTML or arbitrary CSS into a BPMN overlay and gets an empty div or no visual output.

**Root cause:** The plugin overlay system supports exactly four types: `badge`, `icon`, `action`, `status`. The `BpmnApiBridge.createOverlayHtmlElement()` renders only these known types. Any other type string produces an empty container.

**Correct approach:** Use one of the four supported overlay types. For complex visuals, use an overlay factory (`registerOverlayFactory`) which renders via React components managed by the `PluginOverlayStore`.

### P-Studio-6 — `onClickCommand` must reference the same plugin's command

**Symptom:** An interactive overlay's click handler silently does nothing, or the command is rejected at execution time.

**Root cause:** Plugin overlays with `onClickCommand` are validated at render time — the command must be prefixed with the plugin's own namespace (`plugin.<name>.<commandId>`). Cross-plugin command triggers are rejected to prevent privilege escalation.

**Correct approach:** Always reference your own plugin's commands. Use the full prefixed command ID.

### P-Studio-7 — Renderer modules must not access `window.bifrost`

**Symptom:** A renderer module works in development but breaks after an update.

**Root cause:** Renderer modules are injected into the same V8 isolate as the Studio, so `window.bifrost` is technically accessible. However, it is undocumented, unstable, and may be restricted or removed in future phases.

**Correct approach:** Use only diagram-js DI services and the `pluginChannel` for all communication. The channel is the sanctioned boundary between renderer modules and the plugin host.

### P-Studio-8 — Context pad entries cannot use synchronous visibility callbacks

**Symptom:** A plugin developer expects a `visibleWhen(element)` callback on context pad entries, but no such API exists.

**Root cause:** The plugin sandbox runs in a separate process with an asynchronous IPC bridge. The diagram-js `getContextPadEntries(element)` method is synchronous. A callback-based filter would require blocking the renderer on IPC — unacceptable for responsiveness.

**Correct approach:** Use the `elementIds` allowlist pattern. Subscribe to element events in the host, compute qualifying IDs, then push `updateContextPadEntry(id, { elementIds: [...] })` through the bridge. The `PluginContextPadProvider` performs an O(1) Set lookup synchronously.

### ~~P-Studio-9 — Plugin module `require()` cache is not invalidated on reload~~ (RESOLVED)

Resolved 2026-06-24. `PluginModuleLoader.loadPluginModules()` now evicts the module from `__non_webpack_require__.cache` before every load, so disable → re-enable cycles and file changes on disk are always picked up without a Studio restart.

### P-Studio-10 — Multiple renderer-module plugins collide on the `pluginChannel` DI name

**Symptom:** When two or more plugins declare `bpmnModules`, only one plugin's renderer module receives `postToRendererModule` messages. The other plugin's module is instantiated but never gets messages from the host. Disabling all other plugins "fixes" it.

**Root cause:** diagram-js uses a single flat DI container. All `additionalModules` contribute to the same injector. If two plugins both registered `{ pluginChannel: ['value', channel] }`, the last entry wins — both modules receive the same channel instance, but `postToRendererModule` delivers messages to the plugin's own channel (which may no longer be the one injected by DI).

**Correct approach (implemented in `PluginModuleLoader`):** Each plugin's channel is registered under a unique DI name (`pluginChannel__<pluginName>`). At load time, `rewriteChannelInjections()` rewrites the module's `$inject` arrays, replacing the generic `pluginChannel` token with the plugin-specific name. This is fully transparent to plugin authors — they always write `$inject = [..., 'pluginChannel']` and the loader handles namespacing.

**Plugin authors:** Always use `'pluginChannel'` in `$inject` arrays. Never use `pluginChannel__*` directly — the prefixed names are internal and may change.

### P-Studio-11 — GraphQL `__typename` becomes `_Typename` after `camelizeKeys`

**Symptom:** Discriminating a GraphQL union/interface by `__typename` always falls through to the default branch, even though the engine sent the field.

**Why it happens:** `@elraptorus/daemonengine_client` camelizes response keys. The converter treats a leading `_` plus a lowercase letter as snake_case (`_t` → `_T`), so `__typename` becomes `_Typename`.

**Correct approach:** Do not rely on `__typename` as the sole discriminant. Prefer payload fields (`messageRef`, `errorCode`, `type` enum). If a typename is required, read `_Typename` — that is the field the client actually delivers. See `convertGraphqlProcessModel` in `studio/src/modules/engine-core/bpmn/graphqlProcessModelToSdk.ts`.

### P-Studio-12 — Debugger / model-viewer Model graph is required

**Symptom:** Opening a process instance or deployed model fails with "has no GraphQL processModel".

**Why it happens:** `getProcessInstanceWithModel` / `getProcessVersionWithModel` returned no `processModel`, or conversion failed.

**Correct approach:** The Model graph is the only runtime read path. There is no `parseBpmn` or moddle fallback for deployed semantics. Fix the engine response or the converter. Canvas rendering still uses `bpmnXml`. `parseBpmn()` remains the authoring-path parser (linter, modeler).

### P-Studio-13 — Start events have no input/output mappings

**Symptom:** Debugger Input Mappings / Output Mappings panes appear on a Message Start Event and are always empty.

**Why it happens:** `hasDataPipeline` historically treated every event position as a mapping carrier. Engine `StartEventNode` exposes `eventDefinition`, `resultContract`, and `isInterrupting` only — catch-side start data is validated by `resultContract`, not `outMappings`.

**Correct approach:** Gate Input Mappings on `hasInputMappings` and Output Mappings on `hasOutputMappings` (Engine GraphQL field table). Message Start Events show the Result Contract pane, not mapping panes.

---

## Complex Gateway `activationCondition` on the runtime path comes from the Model graph

**Mistake**: Reading a Complex Gateway's activation condition in the Debugger or model viewer from the live bpmn-js moddle (`getActivationConditionFromViewer`) or from `parseBpmn()` output.

**Why it fails**: The SDK BPMN parser (`parseBpmn`) still hardcodes `activationCondition: null`. That parser is the authoring path only. Deployed semantics come from GraphQL `ComplexGatewayNode.activationCondition`, converted onto SDK `typeData`.

**Correct approach**: Debugger and model-viewer panes read `flowNode.flowNodeModel.typeData.activationCondition` / `getSelectedBpmnFlowNode().typeData.activationCondition`. Authoring still uses the bpmn-js moddle via `BpmnDocumentElementAccess`.

---

## Setting a non-standard attribute on a standard BPMN element silently fails to serialize without a moddle `extends` entry

**Mistake**: A command handler sets `businessObject.someEngineOnlyAttribute = value` directly on a moddle instance of a **standard** BPMN type (e.g. `bpmn:AdHocSubProcess`, `bpmn:ServiceTask`) for an attribute that is engine-specific and not part of the upstream `bpmn-moddle` schema for that type — without first adding a corresponding `extends` entry in `evil-platform.json`.

**Why it fails**: moddle only serializes properties that are declared in the schema for the element's type (or one of the types it `extends`). Setting an undeclared property works fine **in memory** for the current editing session — the property round-trips through undo/redo and even through `PropertiesEditor` panes, because those all operate on the live JS object. The failure only appears at `moddle.toXML()`: the writer silently drops the property, so the saved file never contains it. Reloading that file then shows the property as unset, even though it displayed correctly right before saving. This makes the bug easy to miss during interactive testing (the pane always "looks right") and only surfaces on save → reload roundtrip.

**Concrete example (fixed 2026-07)**: `bpmn:AdHocSubProcess.implementation` (the ad-hoc plugin dispatch key, analogous to `ServiceTask.implementation`) is not a standard BPMN 2.0 attribute — `ordering` and `cancelRemainingInstances` are standard and worked immediately, but `implementation` needed its own `extends` entry:

```json
{
  "name": "AdHocSubProcessImplementation",
  "extends": ["bpmn:AdHocSubProcess"],
  "properties": [{ "name": "implementation", "isAttr": true, "type": "String" }]
}
```

**Correct approach**: Whenever a command handler introduces a new engine-specific attribute directly on a standard BPMN element's business object (as opposed to an `evil:*` extension element under `<bpmn:extensionElements>`), add a matching `extends` block to `studio/src/modules/bpmn-core/bpmn-js/moddle/evil-platform.json` (see the existing `BusinessRuleTaskScript` entry for the established pattern) **before** relying on the property surviving a save. Write a roundtrip unit test (parse → mutate → `toXML()` → re-parse → assert) for every new attribute — see `studio/test/unit/bpmn-core/adhocSubprocessModdleRoundtrip.test.ts` for the pattern. In-memory-only manual testing in the editor cannot catch this class of bug.

---

## `registerDefaultIncludedFiles` called after a solution is already open has no visible effect

**Severity**: File Explorer keeps a document type's files hidden (behind "Show hidden files") even though `registerDefaultIncludedFiles`/`registerWebviewDocumentType({ includedFilePatterns })` was called correctly

**Why it fails**: `Project.files.included` (`SolutionManager.addProjectToSolution`) is a **snapshot** of `SolutionManager.defaultIncludedFiles`, copied once when the project is added to the solution — not a live reference. `FilePatternMatcher` (`studio/src/bifrost/common/FilePatternMatcher.ts`), which the File Explorer and file-handling service use to decide visibility, reads `project.files.included` directly. Built-in modules only ever call `registerDefaultIncludedFiles` synchronously during their `onLoad`, before any solution exists, so the snapshot was always accurate by construction. Plugins are different: `onStartup` activation is deferred until after `Bifrost.postInitialize()` restores the previous solution (see the `'ready'`-is-one-shot entry above), so a plugin's `registerWebviewDocumentType({ includedFilePatterns })` call runs **after** every current project's `files.included` snapshot was already taken. Calling `bifrost.solution.onRefresh()` does not help either — it only re-emits `EVENT_SOLUTION_CHANGED` with the unchanged solution object; it does not recompute any project's `files.included`.

**Correct approach**: `SolutionManager.registerDefaultIncludedFiles`/`unregisterDefaultIncludedFiles` must republish the current pattern list into every already-open project (`reapplyIncludedFilesToOpenProjects`) and re-emit `EVENT_SOLUTION_CHANGED` themselves, in addition to updating `defaultIncludedFiles` for future projects. `PluginHostBridge`'s `registerWebviewDocumentType` handler forwards an optional `includedFilePatterns` array to `bifrost.solution.registerDefaultIncludedFiles()` and reverses it via `unregisterDefaultIncludedFiles()` in the same disposer used to unregister the document type, so patterns don't leak past plugin disable/reload/uninstall. See `RegisterWebviewDocumentTypeOptions.includedFilePatterns` in `studio-sdk/src/plugin-api/types.ts` and the `text-file-editors` fixture plugin for the reference usage.

---

## Declaring `contributes.editorDocumentTypes` does not by itself register a webview

**Symptom**: A file matching the manifest's `uriPattern` opens to a tab stuck on "Plugin activated but did not register an editor for this file" — permanently, not just briefly during activation.

**Why it happens**: `contributes.editorDocumentTypes` (see `docs/architecture/plugin-host.md` §Static editor document type contributions) only registers a **placeholder** `EditorDocumentTypeDefinition` at discovery time, before any plugin code runs — it is a promise that *something* will provide the real editor once the plugin activates, not the registration itself (deliberately: the manifest has no `webviewOptions`, so there is exactly one source of truth for iframe config, set imperatively in `activate()`). If the plugin's `activate()` function never calls `api.editors.registerWebviewDocumentType({ id: <same id>, ... })` for that same `id` — e.g. a typo in the id, an early return before the registration call, or simply forgetting it — the placeholder is never replaced. `PlaceholderEditorDocumentRenderer` detects this after the activation promise settles (`placeholderEditorDocumentTypeIds.has(documentTypeId)` is still `true`) and renders the terminal mismatch state instead of hanging forever, but this is a bug guard, not a fix — the plugin still doesn't work.

**Correct approach**: Every manifest `contributes.editorDocumentTypes` entry's `id` must have a matching `api.editors.registerWebviewDocumentType({ id, ... })` call somewhere in `activate()` (unconditionally reached, not behind a feature flag or early return). Do not repeat `includedFilePatterns` in the `registerWebviewDocumentType()` call — it's declared once in the manifest and registered at discovery time; the `activate()`-time call only needs to replace the placeholder's renderer/model, using `registerOrReplaceDocumentType` under the hood (see `PluginHostBridge.registerWebviewDocumentType`). See the `editor-doctype-broken` test fixture (`studio/test/fixtures/plugins/editor-doctype-broken/`) for a minimal reproduction used by the regression test in `studio/test/integration/plugins/plugin-host.test.ts`.

---

## `Bifrost.getSharedRessource` throws on an unknown key — defensive null-guards around it are dead code

**Symptom**: A WebdriverIO integration test does `window.bifrost?.getSharedRessource?.('some:key')` inside `client.execute`, followed by `if (adapter == null) { return ...; }`, and the whole `client.execute` call rejects instead of hitting the null-guard.

**Why it happens**: `Bifrost.getSharedRessource` **throws** when the key was never registered via `registerSharedRessource` — it does not return `undefined`. The optional-chaining (`?.`) only guards against `bifrost` or the method itself being absent, not against the call throwing once invoked. A defensive `if (result == null)` check written *after* the call looks safe but is dead code: execution never reaches it, because the throw happens inside the call expression itself. This is especially easy to get wrong in test code copied between suites — the `bpmn:modeler-adapter` key used by several BPMN plugin integration tests was never registered anywhere in `studio/src` (confirmed via `git log -S`), so every one of those tests failed with a raw `WebDriverError` instead of hitting the intended `null`-guard fallback.

**Correct approach**: Never resolve product state that plugins are meant to reach through public APIs via `getSharedRessource` unless that key is actually registered by the product (check with `git grep registerSharedRessource`). For the BPMN modeler adapter specifically, resolve it the same way the product does internally: `bifrost.editors.getEditorDocumentByUri(uri)` → `bifrost.editors.getEditorDocumentModelIfPresent(doc)` → the model's public `modelerAdapter` getter (`BpmnDocumentModel.modelerAdapter`) → `adapter.getModeler()`. Because WebdriverIO's `client.execute` callback cannot close over test-module helpers, install this resolver once per suite as a test-only global in `beforeAll` (see `installBpmnAdapterResolver` in `plugin-bpmn-modeling.test.ts` / `plugin-bpmn-palette-contextpad.test.ts`) rather than repeating the chain at every call site.

---

## Integration tests must open a solution before `jumpToFileInSolution`

**Symptom**: `studioAgent.jumpToFileInSolution(filename, docType)` fails because its first step — waiting for the file's label to appear in the File Explorer tree — times out, even for a filename that legitimately exists on disk.

**Why it happens**: `jumpToFileInSolution` only searches the currently-rendered File Explorer tree; it does not open a solution itself. If a test's `beforeAll` never calls `studioAgent.openFixturesDirectoryAsSolution(...)` (or another solution-opening helper) first, there is no tree to search, so the label can never appear regardless of whether the file exists. This is easy to miss because the error message ("file not visible") looks identical to the message you'd get from a genuinely missing or hidden file.

**Correct approach**: Every suite that calls `jumpToFileInSolution` must call an `openFixturesDirectoryAsSolution(...)`-style helper in the same `beforeAll`, before the jump. When copying a `beforeAll` from one plugin integration test file to another, double check that both the solution-open call **and** the referenced fixture filename actually exist under `test/fixtures/` — a nonexistent placeholder filename (e.g. a `simple.bpmn` that was never created) fails with the same symptom as a missing solution.

---

## Vitest `describe` blocks with shared mutable state need `{ shuffle: false }`

**Symptom**: An integration test suite with several `it()`s that register/update/unregister the same runtime entity (e.g. a context pad entry) passes when run alone or with a fixed seed, but fails intermittently — sometimes an "unregister" test runs before the corresponding "register" test, or an assertion about entry state sees a different order's leftover state.

**Why it happens**: Vitest's default config in this repo shuffles test order within a file (`sequence.shuffle: true`) to catch order-dependent bugs. Most suites are safe because each `it()` is independent, but a `describe` block whose tests mutate shared state through a single `studioAgent`/plugin instance across the whole block relies on an implicit, undeclared execution order. Shuffling silently breaks that assumption.

**Correct approach**: Pass `{ shuffle: false }` as the second argument to `describe(...)` for any block whose tests have implicit order dependencies on shared mutable state, so they always run in declaration order: `describe('palette and context pad lifecycle', { shuffle: false }, () => { ... })`. Prefer restructuring tests to be order-independent when practical (e.g. `beforeEach` that resets state), but `{ shuffle: false }` is the pragmatic fix when tests are inherently a "lifecycle" sequence (register → assert → update → assert → unregister → assert).

---

## `client.execute` cannot return an object with a top-level `error` property

**Symptom**: An integration test invokes a plugin command whose handler returns `{ success: false, error: 'permission ... denied' }`. Instead of receiving that object, the test fails with a `WebDriverError` whose message is *byte-for-byte the handler's own `error` string*. It looks exactly like the handler's `try/catch` was bypassed and the underlying rejection escaped — it was not.

**Why it happens**: WebdriverIO parses the WebDriver response before the value ever reaches the test. A returned object carrying a top-level `error` property is indistinguishable from a WebDriver protocol error response, so the parser (in `FetchRequest._request`) re-throws it as `WebDriverError(<error>)`. Nothing in the product is involved; the trap fires with no plugin, no IPC and no Bifrost in the picture:

```typescript
await client.execute(() => ({ success: false, error: 'sentinel-abc' }));
// → WebDriverError: sentinel-abc when running "execute/sync" with method "POST"
```

This is why fixtures that return a bare string (`return err.message`) always worked while structurally identical fixtures returning `{ success, error }` appeared to have a deep plugin-host bug. It cost a full investigation of the `PH_CALLBACK_INVOCATION` round trip before the sentinel experiment above isolated it.

**Correct approach**: Never return a caller-controlled object at the top level from `client.execute`. Wrap it in an envelope inside the page and unwrap it on the Node side, as `StudioAgent.executeCommand` does:

```typescript
const envelope = (await client.execute(
  async (cmd: string, cmdArgs: unknown[]) => ({
    value: await (window as any).bifrost.commands.executeCommand(cmd, cmdArgs),
  }),
  commandId,
  args,
)) as { value: unknown };

return envelope.value;
```

The `async`/`await` inside the page matters for a second reason: `bifrost.commands.executeCommand` is synchronous and hands back the handler's promise, so the promise must settle before the envelope is built. Genuine rejections are unaffected — an in-page throw still rejects `client.execute`; only *return values* change. `studio-smoke.test.ts` guards the envelope with a regression test against the test-only command `std.test.returnObjectWithErrorProperty`; if the envelope is removed, that test fails.

---

## A manifest-declared plugin command is an activation stub until the plugin actually activates

**Symptom**: A test waits for `bifrost.commands.isRegistered('plugin.<name>.<command>')` to become `true`, then executes the command — and gets `undefined` back instead of the handler's result, so assertions like `result?.activated === true` or `result?.rendererHighlightCount >= 0` fail. The same test passes when a different test in the block happens to run first.

**Why it happens**: `ContributionRegistrar` registers every `contributes.commands` entry as a stub whose only job is to trigger activation, so `isRegistered` returns `true` long before the plugin's real handler exists. For a plugin activated by `onDocumentType:bpmn` (or any other lazy trigger), the real handler only appears once the trigger has fired — typically once a matching document has been opened. Under Vitest's shuffled order, the test that happens to open the document may run *after* the test that needs the handler.

**Correct approach**: Open whatever the plugin's activation trigger needs in `beforeAll`, and wait for the plugin's real handler to answer rather than for the command to be registered — for example poll a `test.isActivated` command until it returns `{ activated: true }` (see `waitForPluginActivation` in `plugin-bpmn-renderer-module.test.ts`). Do not rely on `isRegistered` or on `waitForPluginCommand` alone to prove activation.

---

## Drilling into a DMN decision-table view drops DRD event subscriptions

**Symptom**: `onElementHover` / `onElementContextMenu` subscriptions registered by a plugin stop firing for DRD elements, even though `subscribe*` returned `ok` and the DRD is visibly back on screen.

**Why it happens**: A double click on a DRD element makes dmn-js open the decision-table view. Returning to the DRD re-creates its viewer — and with it a fresh event bus — so subscriptions wired to the previous viewer are silently orphaned. Nothing errors; the events simply never arrive.

**Correct approach**: In tests, keep view-changing interactions last within their block and pin the order (`describe(..., { shuffle: false }, ...)`); see `element interaction events` in `plugin-dmn-api.test.ts`. In plugin code, re-subscribe after a view change rather than assuming a subscription survives one (`api.dmn.onViewChanged` is the hook for this).

---

## Monaco language features live on the module root, not under `monaco.languages`

**Symptom**: Opening any editor backed by `MultiLineCodeEditor` / `OneLineCodeEditor` (Settings (JSON), FEEL inputs, Machine Sanctum examples) throws `TypeError: Cannot read properties of undefined (reading 'javascriptDefaults')` from the `onMount` handler and the editor surfaces a React error boundary instead of a code editor.

**Why it happens**: monaco-editor 0.53 moved the language-feature namespaces from `monaco.languages.<feature>` to the module root — `monaco.typescript`, `monaco.json`, `monaco.css`, `monaco.html`. The old properties still appear in `monaco.d.ts` as `{ deprecated: true }` declarations, so TypeScript keeps compiling code that reads them, but nothing assigns them at runtime: `monaco.languages.typescript` is plain `undefined`. The mistake is easy to keep alive because the callsites need a cast anyway — `@monaco-editor/react` types its mount argument as the bare editor API (`monaco-editor/esm/vs/editor/editor.api`), which carries no feature namespaces at all even though the configured instance does.

**Correct approach**: Read the feature namespace off the module root and go through `relaxJavaScriptDiagnostics` in `studio-sdk/src/components/internal/monacoJavaScriptDiagnostics.ts` rather than re-deriving it per component. For JSON validation, import the contribution module directly and use its exports (`configureMonacoJsonValidation` does this) instead of reaching through the editor instance.

---

## Restating `shouldBeDisplayed` inside pane renderers

**Mistake**: `PaneContent` (or `Pane`) returns `null` after re-checking document type, selection length, element type, or event-definition kind — the same predicate already in `shouldBeDisplayed`.

**Why it fails**: `PaneWrapper` (`studio/src/components/panes/PaneWrapper.tsx`) evaluates `shouldBeDisplayed` and never mounts `Pane` when it is false. Restating that gate in the renderer is unreachable clutter. Folding a *stricter* renderer `return null` (readiness, missing payload) into the gate is the opposite mistake: the header and group tab disappear.

**Correct approach**: Put document type, selection shape, and element/view type in `shouldBeDisplayed`. In the renderer, do not restate those checks. Keep renderer `return null` for conditions the gate does **not** cover (modeler readiness, missing payload while loading) — do not fold them into the gate, or the header disappears. `assertNotNull` only data the gate proved. Keep `?? '—'` and optional rows for missing *values*. See `docs/architecture/panes.md` and the `studio-panes` skill.

---

## Disabling a plugin does not restore its manifest editor-document-type placeholder

Disabling or reloading a plugin that already replaced its placeholder does **not** re-register the placeholder — the document type is fully unregistered (via the real registration's own disposer) until the plugin is re-enabled. A file that was openable while the plugin was active becomes unopenable (not "lazily openable again") while it's disabled. This matches the existing behavior of `registerWebviewDocumentType` without a manifest placeholder.
