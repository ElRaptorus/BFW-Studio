# BPMN Sanitizer

---

## Overview

The BPMN Sanitizer is an always-on structural integrity scanner for BPMN diagrams. It detects ghost artifacts — elements that exist in the XML but are invisible on the diagram — orphaned definitions, dangling references, and empty containers. These issues typically arise from messy merges and cause unpredictable behavior at runtime.

Key characteristics:

- **Always-on** — runs on every model change, never toggleable
- **Independent from the linter** — different problem domain (structural corruption vs. modeling quality)
- **Canvas badge** — bottom-left severity-colored indicator when issues are present
- **Inspector section** — full report inside the Editor Document Inspector (bottom pane)
- **Per-issue and bulk fixes** — all executed via `commandStack` for single undo steps

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│          Detection Layer (bpmn-core/sanitizer/)               │
├──────────────┬──────────────────┬────────────────────────────┤
│  Types +     │  Analyzer        │  Fixer                     │
│  Descriptions│  (pure function) │  (CmdHelper descriptors)   │
├──────────────┴──────────────────┴────────────────────────────┤
│               SanitizerBridge (diagram-js module)             │
│  debounce → analyze → emit → badge + diagnostics              │
├──────────────────────────────────────────────────────────────┤
│  SanitizerBadge        │  SanitizerInspector                  │
│  (bottom-left canvas)  │  (EditorInspectorPane section)       │
└──────────────────────────────────────────────────────────────┘
         │                        │
    ┌────▼────┐            ┌──────▼──────┐
    │ click → │            │ bifrost.     │
    │ command │            │ panes /     │
    │         │            │ diagnostics │
    └─────────┘            └─────────────┘
```

### Separation from the Linter

| Aspect | Linter | Sanitizer |
|--------|--------|-----------|
| Purpose | Modeling quality (user errors) | Structural integrity (merge corruption) |
| Lifecycle | Toggleable via `bpmnLinter.enabled` | Always on |
| Location | Right pane group (`ph-fill ph-highlighter` icon) | Bottom inspector section + canvas badge |
| Main UI | "Findings" pane | "Sanitizer (N)" section in Editor Document Inspector |
| Scanner | `LintBridge` + `LintEngine` (71 rules) | `SanitizerBridge` (single DFS pass) |
| Fixes | Advisory only (no auto-fix) | Per-issue quick-fix + bulk "Fix All" |

---

## Detection Layer

**Directory:** `studio/src/modules/bpmn-core/sanitizer/`

### Issue Taxonomy (`sanitizerTypes.ts`)

Issue types use a **flattened discriminated union** — each type tightly couples its discriminant, category, and severity at the type level:

| Type | Category | Severity |
|------|----------|----------|
| `shapeless-flow-node` | `ghost-element` | `error` |
| `shapeless-participant` | `ghost-element` | `error` |
| `shapeless-sequence-flow` | `ghost-element` | `error` |
| `shapeless-message-flow` | `ghost-element` | `error` |
| `zombie-shape` | `zombie-element` | `warning` |
| `zombie-edge` | `zombie-element` | `warning` |
| `unreferenced-message` | `unreferenced-global` | `info` |
| `unreferenced-error` | `unreferenced-global` | `info` |
| `unreferenced-signal` | `unreferenced-global` | `info` |
| `unreferenced-escalation` | `unreferenced-global` | `info` |
| `dangling-message-ref` | `dangling-reference` | `warning` |
| `dangling-error-ref` | `dangling-reference` | `warning` |
| `dangling-signal-ref` | `dangling-reference` | `warning` |
| `dangling-escalation-ref` | `dangling-reference` | `warning` |
| `empty-extension-elements` | `empty-container` | `warning` |
| `empty-evil-properties` | `empty-container` | `warning` |

The compiler enforces that a `'shapeless-flow-node'` is always `severity: 'error'` and `category: 'ghost-element'` — no runtime mapping needed.

### Descriptions (`sanitizerIssueDescriptions.ts`)

Three-tier descriptions per issue kind: `message` (one-liner with element name), `why` (detailed explanation using "Poltergeist" analogy for ghost elements), `suggestion` (fix recommendation). Used by the inspector and badge tooltip.

Category-level labels and descriptions are also defined here, sorted by severity order (`ghost-element` → `dangling-reference` → `empty-container` → `unreferenced-global`).

### Analyzer (`BpmnSanitizerAnalyzer.ts`)

```typescript
analyzeSanitizableIssues(definitions, elementRegistry?, parseWarnings?): SanitizableIssue[]
```

Pure function on the `bpmn:Definitions` moddle tree. Detection algorithms:

1. **Shapeless elements (Poltergeists)** — Compare semantic elements against DI shapes/edges in `definitions.diagrams[0].plane.planeElement`. Live modeler path checks `elementRegistry.get(id)` instead. Covers flow nodes, participants, sequence flows, message flows. Recurses into subprocesses at arbitrary nesting depth.

2. **Zombie elements** — The inverse of shapeless detection. Walks all DI plane elements and checks whether each one has a resolved `bpmnElement` reference. When bpmn-moddle encounters a `bpmnElement` attribute pointing to a non-existent semantic element, it drops the reference to `undefined` and emits a parse warning. The detector flags any shape/edge where `bpmnElement` is falsy. The issue's `elementId` is the DI element's own `id` (since the semantic reference is unresolved). Also catches any DI element whose resolved `bpmnElement.id` is not in the `collectSemanticElementIds` set (belt-and-suspenders check).

3. **Unreferenced globals** — DFS-walk the full tree collecting all `*Ref` targets (messageRef, errorRef, signalRef, escalationRef). Report any global `bpmn:Message/Error/Signal/Escalation` from `rootElements` with zero consumers.

3. **Dangling references** — Extracted from `bpmn-moddle` parse warnings (`unresolved reference <...>`). When moddle encounters a `messageRef="Message_DELETED"` targeting a non-existent element, it drops the reference and emits a warning. The analyzer walks up the `$parent` chain from the event definition to find the owning BPMN element.

4. **Empty containers** — Flag `extensionElements` where `values` is undefined or empty. Also detect `evil:Properties` with no `linterRulesetScores`.

### Fixer (`BpmnSanitizerFixer.ts`)

```typescript
buildSanitizerFixCommands(issues, definitions, elementRegistry): CmdHelperDescriptor
```

Builds `CmdHelper` commands wrapped in `executeMultipleCommands` for a single undo step:

| Issue Category | Fix Strategy |
|----------------|-------------|
| Unreferenced global | `removeElementsFromList` from `definitions.rootElements` |
| Shapeless flow node | `removeElementsFromList` from the immediate parent container's `flowElements` — `findDirectContainer` recurses into nested subprocesses to locate the actual parent |
| Shapeless participant | `removeElementsFromList` from collaboration `participants` |
| Shapeless sequence flow | Clean up `sourceRef.outgoing` / `targetRef.incoming`, then remove from parent container's `flowElements` (also subprocess-aware) |
| Shapeless message flow | `removeElementsFromList` from collaboration `messageFlows` |
| Zombie shape / edge | `removeElementsFromList` from `diagram.plane.planeElement` — finds the DI element by its own `id` (the semantic `bpmnElement` is unresolved) |
| Dangling reference | Dismissed via `SanitizerBridge.dismissDanglingRefWarnings()` — the ref is already `undefined` in the moddle tree (bpmn-moddle drops unresolved refs on parse); clearing the stale parse warning is sufficient |
| Empty extension elements | `updateBusinessObject` to remove `extensionElements` |
| Empty evil:Properties | `removeElementsFromList` from `extensionElements.values`, chain-remove parent if empty |

---

## SanitizerBridge

**Path:** `studio/src/modules/bpmn-core/sanitizer/SanitizerBridge.ts`

A diagram-js module added directly to `BpmnModelerComponentAdapter`'s `additionalModules` array (not via `bpmn.modeler.registerModule` — that mechanism is for external modules that don't own the adapter). Receives the `Studio` instance as a single DI value injection:

```typescript
SanitizerBridge.$inject = ['eventBus', 'canvas', 'elementRegistry', 'sanitizerBridgeStudio'];
```

### Lifecycle

1. Subscribe to model change events: `commandStack.changed`, `import.done`, `elements.changed`, `element.changed`, `shape.added/removed`, `connection.added/removed`
2. Debounce 300ms
3. Resolve `definitions` via `getRoot(canvas.getRootElement().businessObject)`
4. Call `analyzeSanitizableIssues(definitions, elementRegistry, parseWarnings)`
5. Store findings, emit `'sanitizer.findingsChanged'` on `eventBus`
6. Re-render badge
7. Push to `bifrost.diagnostics.setDiagnostics(uri, 'bpmn-sanitizer', ...)`

Parse warnings are captured from the `import.done` event payload and stored for subsequent analysis runs.

### Public API (`SanitizerBridgeApi`)

| Method | Return |
|--------|--------|
| `getFindings()` | `SanitizableIssue[]` |
| `getFindingsCount()` | `number` |
| `dismissDanglingRefWarnings(elementIds)` | `void` — Removes stale parse warnings for the given owner element IDs and re-runs analysis. Required because `bpmn-moddle` already drops dangling references during parsing; the only trace is the stored parse warnings. |

Consumed by the inspector component and commands via `model.modelerAdapter.getModelerComponentByName('sanitizerBridge')`.

---

## Canvas Badge

**Path:** `studio/src/modules/bpmn-core/sanitizer/SanitizerBadge.tsx`

Mounted by `SanitizerBridge` on `canvas.init` as a DOM sibling of the BPMN canvas container (same pattern as the linter's `ErrorSummaryBadge`). Positioned bottom-left (`left: 12px; bottom: 12px`), separate from the linter badge (bottom-center).

- **Visible** when findings > 0
- **Hidden** when zero findings (no visual noise in clean diagrams)
- **Severity coloring** by worst finding (error → red, warning → orange, info → blue)
- **Click** executes `bpmn.sanitizer.showInInspector` → opens bottom inspector, navigates to sanitizer section

---

## Inspector Section

**Path:** `studio/src/modules/bpmn-editor/panes/inspector/panes/SanitizerInspector.tsx`

Integrated into the existing `BpmnEditorDocumentInspector` as a tree entry:

```
inspector/editor/sanitizer → metadata.action: 'show-sanitizer' → view: 'sanitizer'
```

### Layout

- **Header:** "Structural Issues" + Help icon (`ph ph-question`, opens `bpmn/sanitizer` help text) + "Fix All" button
- **Grouped by category**, sorted by severity (error first)
- **Per-issue rows:** severity icon + message text + wrench quick-fix button
- **Expandable detail:** `why` + `suggestion` text on click
- **Empty state:** Green check icon + "No issues found. The BPMN is clean." (replaces entire content area when zero findings)

Subscribes to findings via polling `SanitizerBridge.getFindings()` every 500ms (same pattern as `ProblemsPane`).

---

## Commands

Registered in `studio/src/modules/bpmn-core/sanitizer/initializeSanitizerCommands.ts`:

| Command ID | In search? | Description |
|------------|------------|-------------|
| `bpmn.sanitizer.showInInspector` | Yes: `['BPMN: Show sanitizer report', 'BPMN: Show structural issues']` | Opens bottom inspector, navigates to Sanitizer section |
| `bpmn.sanitizer.fixAll` | Yes: `['BPMN: Fix all structural issues', 'BPMN: Sanitize diagram']` | Confirmation dialog → batch fix |
| `bpmn.sanitizer.fixIssue` | No (internal) | Fix single issue, arg: `SanitizableIssue` |

---

## Testing

### Fixture: `haunted-house.bpmn`

**Path:** `studio/test/fixtures/test-solution-sanitizer/haunted-house.bpmn`

A hand-crafted BPMN containing one instance of every detectable issue type, plus clean elements to verify no false positives. Includes a visible subprocess (`SubProcess_haunt`) with ghost children (a boundary event and an end event with no DI shapes) to exercise the nested-ghost detection and fix paths.

### Unit Test: `sanitizerAnalyzer.test.ts`

**Path:** `studio/test/unit/bpmn-sanitizer/sanitizerAnalyzer.test.ts`

Loads the fixture via `bpmn-moddle` (with evil platform descriptor), runs `analyzeSanitizableIssues`, and asserts:
- Exact issue count (18 — includes 2 subprocess-nested ghosts + 2 zombies)
- Each expected issue found with correct `type`, `elementId`, `elementName`, `elementType`, `category`, `severity`
- No false positives on clean elements

### Unit Test: `sanitizerFixer.test.ts`

**Path:** `studio/test/unit/bpmn-sanitizer/sanitizerFixer.test.ts`

Loads the same fixture, detects issues, then runs `buildSanitizerFixCommands` and asserts:
- Top-level ghost flow nodes produce non-empty fix commands
- Subprocess-nested ghost elements produce non-empty fix commands (the fix that was missing before `findDirectContainer` recursion was added)
- Nested ghost fixes target the subprocess (not the root process) as `currentObject`
- Batch "Fix All" produces commands for all ghost issues
- Zombie shapes produce non-empty fix commands targeting `planeElement`
- Zombie edges produce non-empty fix commands targeting `planeElement`
- Zombie fixes remove DI elements from the diagram plane (not from the semantic model)

---

## Files

| File | Purpose |
|------|---------|
| `bpmn-core/sanitizer/sanitizerTypes.ts` | Discriminated union types for all issue kinds |
| `bpmn-core/sanitizer/sanitizerIssueDescriptions.ts` | Three-tier descriptions + category labels |
| `bpmn-core/sanitizer/BpmnSanitizerAnalyzer.ts` | Pure detection function |
| `bpmn-core/sanitizer/BpmnSanitizerFixer.ts` | Fix command builder |
| `bpmn-core/sanitizer/SanitizerBridge.ts` | Always-on diagram-js module |
| `bpmn-core/sanitizer/SanitizerBadge.tsx` | Bottom-left canvas badge |
| `bpmn-core/sanitizer/initializeSanitizerCommands.ts` | Command + command search registration |
| `bpmn-core/sanitizer/sanitizer.scss` | Badge + inspector styles |
| `bpmn-core/sanitizer/index.ts` | Barrel export |
| `bpmn-editor/panes/inspector/panes/SanitizerInspector.tsx` | Inspector section component |
| `bpmn-editor/texts/bpmn-sanitizer.md` | Help text explaining the sanitizer and listing all issue types |
| `bpmn-editor/initializers/initializeSanitizerCommands.ts` | Command + command search registration (moved from bpmn-core) |

---

## DMN Sanitizer

A DMN equivalent of the BPMN Sanitizer exists at `dmn-core/sanitizer/` with the same architectural pattern. See [DMN Editor — Sanitizer](dmn-editor.md#sanitizer) for details.
