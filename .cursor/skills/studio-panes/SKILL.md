---
name: studio-panes
description: >-
  Author and edit Studio PaneProviders (property panes, inspectors, module
  side panels). Use when adding a pane, changing shouldBeDisplayed, writing
  Pane or PaneContent, registering panes into left/right/bottom areas, or
  debugging why a pane is hidden or empty.
---

# Studio Panes

For architecture (PaneWrapper flow, helper locations, plugin panes), see `docs/architecture/panes.md`.

## Visibility vs rendering

`shouldBeDisplayed` is the **only** wrapper visibility gate. `PaneWrapper` returns `null` before mounting `Pane` / `PaneContent` when the gate is false — the header and body both disappear, and empty groups can hide.

Do **not** restate the gate in the renderer:

```typescript
// BAD — dead duplicate of shouldBeDisplayed
function PaneContent(props: PaneComponentProps): React.JSX.Element | null {
  const selection = getSelection(props.editorDocumentModel);
  if (!selection || selection.type !== 'signal') {
    return null;
  }
  // ...
}

// GOOD — gate already proved a signal event is selected
function PaneContent(props: PaneComponentProps): React.JSX.Element {
  const modeled = getSelectedEventDefinition(props.editorDocumentModel);
  assertEventDefinitionType(modeled, 'signal');
  return <PaneProperty type="text" label="Signal ref" value={modeled.signalRef ?? '—'} disabled />;
}
```

If a renderer `return null` checks something the gate does **not**, **leave that `return null`**. Do not fold it into `shouldBeDisplayed`. Moving it into the gate hides the pane header (and can hide the group tab) in cases that previously showed an empty card. Typical renderer-only empties: `isReadyForInteraction()`, missing process instance while loading, missing view payload.

Do **not** `assertNotNull` data the gate did not prove — that throws during those empty-header cases.

## What belongs where

| `shouldBeDisplayed` | Renderer |
|---------------------|----------|
| Document type / URI | Read properties to display |
| Selection none / single / multiple | `assertNotNull` only for data the gate proved |
| Element type, event definition, view type | `?? '—'`, optional rows, empty-state copy |
| Domain predicates that decide *whether the pane exists* (HTTP implementation, loop characteristics, …) | `collapsed !== true` around `PaneContent` |
| | `return null` for readiness / missing payload the gate does not cover |

Reuse existing helpers instead of writing ad-hoc type checks:

- BPMN: `shouldBeDisplayedForBpmnElementOfType` in `bpmn-editor/panes/PropertiesPaneFunctions.ts`
- DMN: `shouldBeDisplayedForDmnViewType` / `shouldBeDisplayedForDmnDrdElementOfType` in `dmn-editor/panes/PropertiesPaneFunctions.ts`
- Debugger: named `shouldDisplay*` in `ShouldBeDisplayedConditions.ts`

Those helpers must **not** add `isReadyForInteraction()`. Readiness belongs in `getBpmnSelectionForPropertiesPane` / `getDmnSelectionForPropertiesPane` (and equivalent renderer checks) so the header can still show.

## Skeleton

```typescript
export const paneProvider: PaneProvider = {
  getPaneTitle,
  shouldBeDisplayed,
  Pane: PaneFull,
  PaneContent,
};

function PaneFull(props: PaneComponentProps): React.JSX.Element {
  return (
    <Pane>
      <PaneHeader studio={props.studio} title={getPaneTitle()} paneId={props.paneId} collapsed={props.collapsed} />
      {props.collapsed !== true && <PaneContent {...props} />}
    </Pane>
  );
}
```

## Data access

Cast `props.editorDocumentModel` to the concrete model and call public getters. Do not use `studio.getSharedRessource()` or `editorDocument.data.current` for selections / parsed models. Trigger pane re-renders with a `selectionRevision` metadata bump.

Form-builder panes may check **local** `FormBuilderEditorMediator` snapshot state; that is not a `PaneWrapper` duplicate. Do not copy that pattern into editor-document panes.
