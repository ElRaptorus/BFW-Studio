# BPMN Diff

---

## Overview

`bpmn-diff` is the BPMN-specific module for diagram comparison, history preview, and change summary features. It registers two document types: `bpmn.diff` for side-by-side comparison and `bpmn.history-preview` for viewing/restoring historical diagram versions. Both use synchronized viewers, visual change overlays, and property panes. The diff engine runs `bpmn-js-differ` in a web worker to keep the UI responsive.

The module is the single owner of all BPMN-aware UI that was previously spread across git-cruiser. Git-cruiser provides generic Git primitives (file retrieval, log, branch creation, file restoration) via commands; bpmn-diff handles everything BPMN-specific (rendering, parsing, diff computation, process name extraction).

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  bpmn-diff module                                          │
│                                                               │
│  ┌──────────────┐  ┌──────────────────────────────────────┐   │
│  │ BpmnDiff      │  │ BpmnDiffDocumentModel (base)        │   │
│  │ (diff engine) │  │   └─ BpmnHistoryPreviewDocumentModel│   │
│  │ + WebWorker   │  │                                     │   │
│  └──────────────┘  │ BpmnDiffDocumentRenderer             │   │
│                     │ BpmnHistoryPreviewDocumentRenderer   │   │
│                     └──────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────┐  ┌───────────────────┐  │
│  │ bpmn-core/diff (summary + moddle)│  │ Panes             │  │
│  └──────────────────────────────────┘  │  ChangeOverview   │  │
│                                        │  ContentDiff      │  │
│  Calls: git.getFileAtRef        └───────────────────┘  │
│         (command, history only)                                │
└───────────────────────────────────────────────────────────────┘
```

### Diff Engine

The diff engine classes (`BpmnDiff`, `BpmnDiffingWorkerClient`, `BpmnDiffingWorker`, `BpmnViewerWithSync`, `bpmnDiffConstants`) have been moved to `bpmn-core/diff/` as shared infrastructure. They are imported from `../../bpmn-core/diff` by the bpmn-diff module. See the barrel export at `studio/src/modules/bpmn-core/diff/index.ts`.

#### BpmnDiff

**Path:** `studio/src/modules/bpmn-core/diff/BpmnDiff.ts`

Core class that orchestrates the diff. Spawns a `BpmnDiffingWorkerClient` web worker, sends both XML strings, and maps the raw `bpmn-js-differ` buckets (`_added`, `_changed`, `_layoutChanged`, `_removed`) to internal categories (`added`, `moved`, `updated`, `deleted`). Applies a post-filter that rejects `Lane`, `Participant`, and `SequenceFlow` entries from the `moved` category.

Key types:

- `BpmnDiffChangesByAction` — `{ added, moved, updated, deleted }`, each `Record<elementId, BpmnDiffChange>`
- `BpmnDiffChangesById` — `Record<elementId, BpmnDiffChange[]>` (multiple actions per element)

#### BpmnDiffingWorkerClient / BpmnDiffingWorker

**Paths:**
- `studio/src/modules/bpmn-core/diff/BpmnDiffingWorkerClient.ts`
- `studio/src/modules/bpmn-core/diff/webworker/BpmnDiffingWorker.ts`

The worker parses both XMLs with `createBpmnModdleForDiff()` (BPMN + Camunda + Bifrost Forge World platform namespaces), runs `diff()` from `bpmn-js-differ`, and posts the JSON-cloned result back. The client extends `AbstractWorkerClient` for structured invoke/response messaging.

### Change Summary Builder

**Canonical path:** `studio/src/modules/bpmn-core/diff/changeSummaryBuilder.ts`
**Thin re-export:** `studio/src/modules/bpmn-diff/changeSummaryBuilder.ts` (barrel-style re-exports for bpmn-diff callers)

Stateless module that transforms raw `bpmn-js-differ` output into structured summary data and markdown. Consumed by the summary dialog command, ChangeOverview, ContentDiff (via the document model), git-cruiser history preview, and the BPMN merge resolver. Applies the same layout-change filter as `BpmnDiff` (rejects `Lane`, `Participant`, `SequenceFlow` from the `layoutChanged` category) so that all consumers produce consistent output regardless of whether they go through the `BpmnDiff` class or use raw diff data directly.

`buildAugmentedChangeSummary(rawDiff, beforeXml, afterXml)` merges semantic buckets with **definitions / file metadata** (`diffDefinitionsMetadata`), **Camunda custom properties** (`diffCustomPropertiesMaps` over moddle-parsed definitions), and **Bifrost Forge World linter ruleset score changes** (`diffLinterScores` from `evilLinterScoreDiff.ts`). Camunda custom property diffing is retained for backward compatibility with legacy diagrams; new diagrams use `evil:` extension elements. Helpers `buildDefinitionsMetadataBetweenXml`, `buildCustomPropertiesSummaryBetweenXml`, and `buildLinterScoreChangesBetweenXml` support merge (base→ours / base→theirs) without a full `ChangeSummary`.

Key exports:

| Export | Purpose |
|--------|---------|
| `buildChangeSummary(rawDiff, options?)` | Transforms raw diff buckets into a `ChangeSummary` |
| `buildAugmentedChangeSummary(rawDiff, beforeXml, afterXml)` | Same plus definitions metadata; Camunda custom property deltas are **merged** onto `ChangeSummaryEntry.customPropertyChanges` (not a separate top-level list) |
| `partitionCustomPropertyDeltas(deltas)` | Splits Camunda property deltas into **added** / **removed** / **changed** lists (sorted by name) for grouped UI |
| `formatSummaryValueForDisplay(value)` | Quoted / `(none)` / multiline-safe display for summary lines |
| `CustomPropertyChangeOverviewGroup` | React: renders **Custom properties → Added / Removed / Changed** under each element (diff + merge panes) |
| `getCustomPropertyChangesForElement(summary, elementId)` | Resolves merged custom property deltas for the detail pane |
| `changeSummaryHasAnySemanticChange(summary)` | True if any structural, metadata, custom-property, or linter-score change exists |
| `formatChangeSummaryAsMarkdown(summary, fileName)` | Renders a `ChangeSummary` as markdown for dialog display |
| `formatBpmnType(bpmnType)` | `bpmn:ServiceTask` → `Service Task` |

Key types:

| Type | Description |
|------|-------------|
| `ChangeSummary` | `{ added, removed, modified, layoutChanged, definitionsMetadata, linterScoreChanges, customProperties }` — `customProperties` is always `[]` after build; use `customPropertyChanges` on entries |
| `ChangeSummaryEntry` | `{ id, type, label, displayName, customPropertyChanges? }` — optional Camunda `camunda:Property` deltas with `kind: 'added' \| 'removed' \| 'changed'` (legacy diagrams only; new diagrams use `evil:` extensions) |
| `ModifiedEntry` | Extends `ChangeSummaryEntry` with `attributeChanges: AttributeChange[]` |
| `CustomPropertyDelta` | `{ propertyName, oldValue, newValue, kind }` from `camundaPropertiesDiff.ts` |
| `AttributeChange` | `{ attribute, oldValue, newValue }` |
| `DefinitionsMetadataChange` | File-level attribute diff (exporter, target namespace, etc.) |
| `LinterScoreChange` | `{ rulesetId, kind, propertyChanges }` — per-ruleset linter score diff at definitions level |
| `LinterScorePropertyDelta` | `{ property, label, oldValue, newValue }` — individual score attribute delta |
| `CustomPropertiesSummaryEntry` | Per-element Camunda `camunda:property` deltas |

### Shared Constants

**Path:** `studio/src/modules/bpmn-core/diff/bpmnDiffConstants.ts`

`ATTRIBUTE_LABELS` — human-readable labels for known BPMN diff attributes. Shared between `ContentDiff` pane, the change summary builder, and the history restore overview pane.

`LAYOUT_CHANGE_REJECTED_TYPES` — regex matching BPMN types whose layout changes are filtered out (Lane, Participant, SequenceFlow). Shared between `BpmnDiff` (overlay filter) and `changeSummaryBuilder` (summary filter).

`DEFINITIONS_METADATA_KEYS` / `DEFINITIONS_METADATA_LABELS` — which `bpmn:Definitions` attributes appear in metadata diffs (see `definitionsMetadataDiff.ts`).

### Shared Styles

**Path:** `studio/src/modules/bpmn-core/diff/styles/component.bpmn-diff-infrastructure.scss`

CSS variables and shared classes for diff overlay positioning, colors, highlight overlays, and the diff splitter layout. Consumed by `bpmn-diff` (both diff and history preview views) and the merge editor.

---

## Document Types

### bpmn.diff

| Property | Value |
|----------|-------|
| Document type | `bpmn.diff` |
| URI pattern | `fragment+bpmn.diff:...` |
| Model | `BpmnDiffDocumentModel` |
| Renderer | `BpmnDiffDocumentRenderer` |

The URI encodes `beforeUri`, `afterUri`, `beforeData` (`original` or `current`), and `afterData`.

### bpmn.history-preview

| Property | Value |
|----------|-------|
| Document type | `bpmn.history-preview` |
| URI pattern | `fragment+bpmn.history-preview:...` |
| Model | `BpmnHistoryPreviewDocumentModel` (extends `BpmnDiffDocumentModel`) |
| Renderer | `BpmnHistoryPreviewDocumentRenderer` |

Provides a combined History Fragment with two view modes:

- **Preview mode** — Read-only `BpmnViewerComponentAdapter` showing the historical diagram version
- **Diff mode** — Synchronized split `BpmnViewerWithSync` pair showing current vs. historical with overlays (inherited from `BpmnDiffDocumentModel`), including change navigation (prev/next), cross-viewer deselect, and reload tracking

The model extends `BpmnDiffDocumentModel` and overrides only `initialize()` to fetch historical XML via `git.getFileAtRef` (command delegation). All diff infrastructure (summary computation, change navigation, element selection, viewer sync, session restore) is inherited. The model adds preview mode (single-viewer), commit metadata, and `getHistoricalXml()`. A "Restore" toolbar button delegates to `git.restoreFileContent` for the actual file write.

---

## Panes

### ChangeOverview

**Path:** `studio/src/modules/bpmn-diff/panes/ChangeOverview.tsx`

Visible when a `bpmn.diff` or `bpmn.history-preview` document is active. Shows grouped lists of all changes: Definitions metadata, Linter Scores (per-ruleset, per-property, with added/removed/changed indicators), Added, Removed, Modified (with attribute + Camunda custom-property sub-items), and Layout Changed. Custom properties follow the same **change-type** grouping as BPMN attributes (not a separate “Custom properties” section). Each entry is clickable — selecting it navigates to the element in the side-by-side viewers. Uses `selectElements()` for navigation and `getChangeSummary()` for data — both provided by `BpmnDiffDocumentModel` (and inherited by the history model).

### ContentDiff

**Path:** `studio/src/modules/bpmn-diff/panes/ContentDiff.tsx`

Visible when an element is selected in either a `bpmn.diff` or `bpmn.history-preview` document. Shows per-element change status (added/deleted/moved/updated icons) and iterates all changed attributes with before/after values. When structured Camunda custom-property data exists for the selection, a **Custom properties (Camunda)** block is shown and the raw `extensionElements` attribute row is omitted to avoid duplicate noise. Each delta is labeled as **property added**, **property removed**, or **value changed**, and only the relevant before/after value columns are rendered (no empty “half diff” for add/remove). Complements ChangeOverview: the overview shows the full picture, ContentDiff shows the detail.

---

## Commands

| Command | Description | Registration |
|---------|-------------|--------------|
| `bpmn.diff.openDiffOriginalDataVsCurrentData` | Working copy diff for focused BPMN | Command search |
| `bpmn.diff.openDiffCurrentDataVsOriginalData` | Reverse working copy diff | Internal |
| `bpmn.diff.openDiffTwoFiles` | Compare two files by URI | Internal |
| `bpmn.diff.showChangeSummaryDialog` | Show markdown summary dialog from computed diff data | Internal (diff view toolbar). `enabledWhen` and the handler fall back to the focused `bpmn.diff` document when invoked with no args (tests / command search / keybindings). |
| `bpmn.diff.getChangeSummaryMarkdown` | Return markdown summary for two XMLs | Internal (called by git-cruiser commit preview) |
| `bpmn.diff.exportBeforeToNewFile` | Export the "before" document | Internal |
| `bpmn.diff.openHistoryPreview` | Open history preview for a BPMN file at a commit | Internal |
| `bpmn.diff.historyPreview.changeViewMode` | Toggle between preview/diff in history preview | Internal |
| `bpmn.diff.history.restoreFile` | Restore BPMN to historical version (delegates to `git.restoreFileContent`) | Internal |
| `bpmn.diff.suggestBranchNameForProcess` | Extract process name from focused BPMN and suggest a branch name | Internal |

### Cross-Module Integration

`bpmn.diff.getChangeSummaryMarkdown` is called by git-cruiser's `buildChangeSummaryForFiles()` during the commit flow to produce detailed per-file summaries for the commit dialog.

`bpmn.diff.openHistoryPreview` is called by git-cruiser's `fileHistory.ts` QuickJump entries. `bpmn.diff.history.restoreFile` is a wrapper that extracts the historical XML from its model and delegates to `git.restoreFileContent` for the actual file write and dialog. `bpmn.diff.suggestBranchNameForProcess` is called by `git.createBranchForProcess` to get a branch name suggestion using `bpmn-core/bpmnProcessUtils`.

The history preview model fetches historical XML via `git.getFileAtRef`, maintaining a clean separation: git-cruiser provides raw Git data, bpmn-diff handles all BPMN-specific rendering and UI.

The interactive summary dialog (`bpmn.diff.showChangeSummaryDialog`) has no cross-module dependency — it reads directly from the `BpmnDiffDocumentModel`, which already has the diff computed. The button lives in the diff view toolbar (`BpmnDiffDocumentRenderer.tsx`) and passes the current `editorDocument`. When the command is invoked without arguments, both `enabledWhen` and the handler resolve `bifrost.editors.getFocusedEditorDocument()` so the command stays enabled while a `bpmn.diff` tab is focused.

## Merge UI

Git merge **framework** (model, IPC, commands, `.bpmn`/`.dmn` walk) lives in [git-cruiser.md](git-cruiser.md). This section is the BPMN three-panel visualization.

For `content` conflicts the resolver is a nested splitter: ours | theirs on top, result preview below. All three are read-only `NavigatedViewer`s. `BpmnMergeResultModeler` holds starting-side and apply-side XML plus a resolution map. Every resolution change re-runs `xmlMergeEngine` (`DOMParser` / `XMLSerializer`) and reloads the result viewer. Viewboxes stay synced via `addViewboxSync()`.

| Operation | Starting side | Apply side |
|-----------|---------------|------------|
| merge / cherry-pick | ours | theirs |
| rebase | theirs (base) | ours (replayed) |

`xmlMergeEngine(startingXml, applyXml, applyDiff, conflictIds)` copies non-conflicting apply-side changes into the starting DOM (delete / update / move / add, including DI and lane `flowNodeRef`). Deletions before additions; connections after shapes on add. Do not merge via `modeling.createShape` / `updateProperties` — see [common-pitfalls.md](common-pitfalls.md).

Resolution is per **conflict key** (`{elementId}` or `{elementId}:cp:{propertyName}`): `auto-applied` | `pending` | `accepted-ours` | `accepted-theirs`. Rebuild uses an effective skip set: apply-side-accepted keys leave the skip set; reverted auto-applies re-enter it. Progress counts conflict keys on `'both'` elements. `onResolutionChanged` updates `MergeDocumentModel`.

Paths: `studio/src/modules/bpmn-editor/merge/` (`BpmnMergeResolver.tsx`, `BpmnMergeResultModeler.tsx`, `autoApplyEngine.ts`, `panes/BpmnMergeChangeOverview.tsx`).

---

## File Path Reference

| Component | Path |
|-----------|------|
| Module entry | `studio/src/modules/bpmn-diff/index.ts` |
| Diff engine (shared) | `studio/src/modules/bpmn-core/diff/BpmnDiff.ts` |
| Worker client (shared) | `studio/src/modules/bpmn-core/diff/BpmnDiffingWorkerClient.ts` |
| Worker (shared) | `studio/src/modules/bpmn-core/diff/webworker/BpmnDiffingWorker.ts` |
| Viewer with sync (shared) | `studio/src/modules/bpmn-core/diff/BpmnViewerWithSync.tsx` |
| Shared constants | `studio/src/modules/bpmn-core/diff/bpmnDiffConstants.ts` |
| Shared styles | `studio/src/modules/bpmn-core/diff/styles/component.bpmn-diff-infrastructure.scss` |
| Barrel export | `studio/src/modules/bpmn-core/diff/index.ts` |
| Diff document model (base) | `studio/src/modules/bpmn-diff/BpmnDiffDocumentModel.ts` |
| Diff document renderer | `studio/src/modules/bpmn-diff/BpmnDiffDocumentRenderer.tsx` |
| History preview model (extends diff) | `studio/src/modules/bpmn-diff/history/BpmnHistoryPreviewDocumentModel.ts` |
| History preview renderer | `studio/src/modules/bpmn-diff/history/BpmnHistoryPreviewDocumentRenderer.tsx` |
| Change summary builder | `studio/src/modules/bpmn-core/diff/changeSummaryBuilder.ts` (re-exported from `bpmn-diff/changeSummaryBuilder.ts`) |
| Moddle stack for diff (BPMN + Camunda + Evil) | `studio/src/modules/bpmn-core/diff/bpmnModdleWithCamunda.ts` |
| Evil linter score diff | `studio/src/modules/bpmn-core/diff/evilLinterScoreDiff.ts` |
| ChangeOverview pane | `studio/src/modules/bpmn-diff/panes/ChangeOverview.tsx` |
| ContentDiff pane | `studio/src/modules/bpmn-diff/panes/ContentDiff.tsx` |
| Styles | `studio/src/modules/bpmn-diff/styles/component.bpmn-diff.scss` |
| Process name utilities (shared) | `studio/src/modules/bpmn-core/bpmnProcessUtils.ts` |
| Help text | `studio/src/modules/bpmn-diff/texts/bpmn-diff.md` |
