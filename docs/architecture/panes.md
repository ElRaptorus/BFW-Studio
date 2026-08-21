# Panes

---

## Overview

Panes are the Studio's side-panel UI: property inspectors, documentation, scripting, and module-specific views registered into the left, right, and bottom pane areas. Every pane is a `PaneProvider` registered through `bifrost.panes`. Wrapper visibility is a single predicate — `shouldBeDisplayed` — evaluated by `PaneWrapper` before the pane component mounts. Renderers assume that predicate already passed; they may still `return null` for conditions the gate does not cover so the header stays visible.

Module-specific pane catalogs live in **[bpmn-editor-properties.md](bpmn-editor-properties.md)**, **[dmn-editor.md](dmn-editor.md)** §Pane System, and **[engine.md](engine.md)**. Layout, groups, and tab bars live in **[workbench-layout.md](workbench-layout.md)**.

---

## Architecture

### Registration

Modules register a pane by pairing a pane id with a `PaneProvider` module:

```typescript
bifrost.panes.getPaneViaPaneProvider('ext/MyPane', 'ext/provider/MyPane', require('./MyPane'));
```

The module must export `paneProvider: PaneProvider`. Panes are then placed into a pane group on an area (`left` / `right` / `bottom`) via `registerPaneGroup` / `prependToPaneGroup` / `appendToPaneGroup`.

### PaneProvider Contract

**Path:** `studio-sdk/src/contracts/PaneTypes.ts`

| Field | Role |
|-------|------|
| `getPaneTitle` | Header title for the current editor context |
| `shouldBeDisplayed` | Sole visibility gate (optional; omitted means always visible) |
| `Pane` | Full pane: header + body. Mounted only when the gate is true |
| `PaneContent` | Body only. Called from `Pane` when `collapsed !== true` |
| `classNames` | Optional extra CSS on the wrapper |

```typescript
export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};
```

### Visibility vs rendering

```
PaneArea / PanesList
        │
        ▼
  PaneWrapper
        │  shouldBeDisplayed(document, model, studio) === false  →  return null
        │  shouldBeDisplayed === true (or omitted)
        ▼
  paneProvider.Pane   →   PaneHeader + (if not collapsed) PaneContent
```

`PaneWrapper` (`studio/src/components/panes/PaneWrapper.tsx`) evaluates `shouldBeDisplayed` and **does not mount** `Pane` when it is false. `PanesList`, `PaneGroupTabBar.getDisplayableGroups()`, and the right/bottom group tab bars use the same predicate to hide empty groups.

Consequences:

- `Pane` / `PaneContent` never run for a hidden pane. Restating document type, selection length, element type, or event-definition kind inside the renderer is dead code when those checks are already in `shouldBeDisplayed`.
- A renderer `return null` for a condition the gate does **not** check must stay in the renderer. Folding it into `shouldBeDisplayed` hides the header (and can hide the group tab) in cases that previously showed an empty card.
- After the gate passes, data that it proved is fetched and asserted (`assertNotNull` / typed assertion). Do not assert data the gate did not prove.
- Empty *property values* (`?? '—'`, optional rows, empty-state copy) are rendering, not visibility.

Canonical renderer after a type gate, with a readiness empty-body that the gate does not cover:

```typescript
function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getBpmnSelectionForPropertiesPane(props);
  if (selection == null) {
    return null;
  }
  return <PropertiesCallActivity key={getKeyForPropertiesPane(selection)} {...props} />;
}
```

`getBpmnSelectionForPropertiesPane` / `getDmnSelectionForPropertiesPane` return `null` when the modeler is not ready. That empties the body; the header stays because `shouldBeDisplayed` does not require readiness.

`PaneFull` may still skip `PaneContent` when `props.collapsed === true`. That is collapse UX, not visibility.

### What belongs in `shouldBeDisplayed`

| Include | Do not include |
|---------|----------------|
| Document type / URI scheme | Fetching values to display |
| Selection shape (none / single / multiple) | Empty string / missing optional property |
| Element type, event definition, view type | `collapsed` |
| Domain predicates that decide *whether the pane exists* (loop characteristics present, HTTP implementation, …) | Modeler `isReadyForInteraction()` |
| | Missing process instance / view payload / GraphQL process graph while loading |
| | Local React state used only for editing |

BPMN helpers: `studio/src/modules/bpmn-editor/panes/PropertiesPaneFunctions.ts` (`shouldBeDisplayedForBpmnElementOfType`, type-list helpers). They require document type and exactly one matching element. They do **not** include `isReadyForInteraction()`.

DMN helpers: `studio/src/modules/dmn-editor/panes/PropertiesPaneFunctions.ts` (`shouldBeDisplayedForDmnViewType`, `shouldBeDisplayedForDmnDrdElementOfType`, `shouldBeDisplayedForDmnDrdNoSelection`). Same rule: document / view / selection only.

Debugger helpers: `studio/src/modules/engine-debugger/property-panel/ShouldBeDisplayedConditions.ts`.

Model viewer / decision viewer: per-pane `shouldBeDisplayed` in the pane file, using `isModelViewerDocument` / `isDecisionViewerDocument` plus selection type.

### Data access

Panes read working data from the focused `EditorDocumentModel` (cast + public getters), never from `studio.getSharedRessource()` and never from `editorDocument.data.current` for selections or parsed models. See `docs/architecture/editor-documents.md` §Data Placement Rules and the `editor-document-data-placement` rule.

Selection changes re-render panes by incrementing a `selectionRevision` counter in document metadata.

### Exception: local mediator state

Form-builder panes (`PropertiesFormBuilderField`, `PropertiesFormBuilderAction`) keep a React snapshot subscribed to `FormBuilderEditorMediator`. That snapshot can update independently of a Workbench re-render, so a type check against *local* state is not the same as restating `shouldBeDisplayed`. Do not copy this pattern into editor-document panes.

---

## Public API / User-Facing Features

Users see panes as stacked cards in a pane area. Groups with at least one displayable pane appear as tabs (icon tabs on the right, text tabs on the bottom). Collapse is per-pane (`PaneObject.collapsed`).

Plugin panes use the same `PaneProvider` contract via `IframePaneProvider` / `TreeViewPaneProvider`; their runtime visibility is `setVisible` rather than a document-type predicate. See **[plugin-host.md](plugin-host.md)** and **[webviews.md](webviews.md)**.

---

## File Path Reference

| Component | Path |
|-----------|------|
| `PaneProvider` type | `studio-sdk/src/contracts/PaneTypes.ts` |
| `PaneWrapper` | `studio/src/components/panes/PaneWrapper.tsx` |
| `PanesList` | `studio/src/components/panes/PanesList.tsx` |
| `PaneManager` / `PaneMediator` | `studio/src/bifrost/common/PaneManager.ts`, `PaneMediator.ts` |
| BPMN property helpers | `studio/src/modules/bpmn-editor/panes/PropertiesPaneFunctions.ts` |
| DMN property helpers | `studio/src/modules/dmn-editor/panes/PropertiesPaneFunctions.ts` |
| Debugger visibility helpers | `studio/src/modules/engine-debugger/property-panel/ShouldBeDisplayedConditions.ts` |
| SDK pane chrome | `studio-sdk/src/components/panes/` (`Pane`, `PaneHeader`, `PaneProperty`, `buildSimplePropertyPaneProvider`) |
