# BPMN Linter

---

## Overview

The `bpmn-linter` module provides diagram-level linting for BPMN documents using [bpmnlint](https://github.com/bpmn-io/bpmnlint) as the rule engine. It integrates natively with the Studio's overlay, diagnostics, settings, and pane systems — the official `bpmn-js-bpmnlint` integration module is deliberately skipped to avoid theming and CSS conflicts (same rationale as the token simulator).

Key characteristics:

- **Automatic** lint triggering — debounced after every model change while the linter is active
- **Three-tier findings**: each violation carries `message`, `why`, and `suggestion` text
- **Canvas markers** for visual severity feedback on elements
- **Error Summary Badge** at the bottom of the editor
- **Findings Pane** (formerly "Problems Pane") with hover-highlighting, click-to-zoom, and bidirectional selection
- **Palette integration** — linter toggle is a palette entry, not a floating button
- **Pane group label**: "Linter" (pane group icon: `ph-fill ph-highlighter`)

> **Note:** Structural integrity checks (ghost artifacts, dangling references, empty containers) are handled by the separate [BPMN Sanitizer](bpmn-sanitizer.md), not by the linter. The two systems are architecturally independent.

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                  Module: bpmn-linter                    │
├───────────────┬───────────────┬───────────────────────────┤
│  LintBridge   │  LintEngine   │ LintOverlayMgr            │
│  (diagram-js) │  (bpmnlint)   │ (canvas markers)          │
├───────────────┴───────────────┴───────────────────────────┤
│  ErrorSummaryBadge │ ProblemsPane │ PaletteProvider        │
│                    │ (linter grp) │ MenuBar RulesetSelect  │
└───────────────────────────────────────────────────────────┘
         │                │               │
    ┌────▼────┐     ┌─────▼─────┐   ┌─────▼──────┐
    │ canvas  │     │ bifrost.   │   │ bifrost.    │
    │ markers │     │ panes /   │   │ settings   │
    │         │     │ diagnostics│   │            │
    └─────────┘     └───────────┘   └────────────┘
```

### LintBridge

**Path:** `studio/src/modules/bpmn-linter/LintBridge.ts`

A diagram-js module registered via `bpmn.modeler.registerModule`. Injected services: `eventBus`, `canvas`, `elementRegistry`, `overlays`, `selection`. Additionally receives four `value` injections from the module entry:

| DI Token | Source | Purpose |
|----------|--------|---------|
| `lintBridgeSettings` | Bifrost settings accessor | Read/write/observe settings |
| `lintBridgeDiagnostics` | Bifrost diagnostics accessor | Push findings to diagnostics store |
| `lintBridgeEditors` | Bifrost editors accessor | Retrieve the active document URI |
| `lintBridgePaneLayout` | Bifrost pane/command accessor | Update finding counts for the dynamic group icon, trigger pane re-renders, and show the Problems pane group |

The settings accessor includes `onSettingsUpdate()` which forwards `bifrost.events.on('settingsUpdate', ...)` for profile and rule override changes.

The pane layout accessor bridges from the diagram-js world into the Bifrost pane system:

| Method | Purpose |
|--------|---------|
| `requestUpdate()` | Calls `bifrost.panes.requestPaneLayoutUpdate()` to force re-render of the pane group tab bar (e.g. to reflect updated icon color) |
| `updateCounts(counts)` | Writes error/warning/info counts to the shared `linterCounts` object used by the group icon factory |
| `showProblemsPane()` | Executes `bpmn.linter.showProblemsPane` command to activate the linter pane group and show the right area |

Event subscriptions:

| Event | Behavior |
|-------|----------|
| `commandStack.changed` | Schedules a debounced lint run (when active; skipped while `_lintScheduleSuppressionCount` > 0) |
| `elements.changed`, `element.changed`, `shape.added` / `removed`, `connection.added` / `removed` | Same debounced schedule (covers paths where the stack signal alone is insufficient) |
| `import.done` | Schedules a debounced lint run |
| `canvas.init` / `attach` | Mounts the Error Summary Badge |
| `diagram.destroy` | Clears findings, unmounts badge, clears diagnostics, disposes settings subscription |
| `selection.changed` | Tracks currently selected element IDs for bidirectional highlighting |
| `settingsUpdate` (via accessor) | Re-reads profile, custom rulesets, or enabled state; applies changes and re-lints |
| `lintBridge.toggled` | Fired when toggle state changes (consumed by `LinterPaletteProvider`) |

The bridge's `_active` state is synchronized with the `bpmnLinter.enabled` setting. `toggle()` writes to this setting, and the settings listener reacts to external changes.

After each lint run (and when findings are cleared), the bridge updates the shared `linterCounts` object via `paneLayout.updateCounts()` and calls `paneLayout.requestUpdate()` to force the pane group tab bar to re-evaluate the dynamic icon factory. This is how the linter group icon changes color to reflect the current finding severity.

The bridge exposes:

| Method | Purpose |
|--------|---------|
| `toggle()` | Activate/deactivate linting, syncs `bpmnLinter.enabled`, fires `lintBridge.toggled` |
| `isActive()` | Current linter state |
| `clearFindings()` | Clear all findings and markers |
| `getFindings()` | Current lint findings array |
| `getCounts()` | Error/warning/info counts |
| `getActiveProfile()` | Currently active profile/ruleset name |
| `getAvailableProfiles()` | List of all profiles (built-in + custom) with `{ id, label, isCustom }` |
| `selectElement(id, addToSelection?)` | Zoom to element and select it; with `addToSelection` true, adds to current selection without zooming (shift-click) |
| `highlightElement(id)` | Add blue selection outline via `lint-highlight` marker |
| `unhighlightElement(id)` | Remove `lint-highlight` marker |
| `getSelectedElementIds()` | Currently selected element IDs on canvas |

### LinterPaletteProvider

**Path:** `studio/src/modules/bpmn-linter/LinterPaletteProvider.ts`

A diagram-js palette provider registered in the same module as `LintBridge` at priority **600**. Adds two entries to the `z-extensions` group (bottom of palette): an explicit `separator: true` entry that renders an `<hr>` dividing the standard palette from module entries, and a "Toggle Linter" toggle. Listens to the `lintBridge.toggled` event and rebuilds the palette to reflect active/inactive state.

> **Important:** Diagram-js does **not** auto-insert separators between groups. The `separator: true` entry is required for a visible `<hr>`. See `common-pitfalls.md`.

### LintEngine

**Path:** `studio/src/modules/bpmn-linter/LintEngine.ts`

Orchestrator that runs bpmnlint and maps raw results to `LintFinding[]`.

- Constructs a bpmnlint `Linter` with a manually built config (no filesystem resolver)
- Provides a custom resolver that returns pre-imported rule factories
- After the bpmnlint pass, runs a **post-processing pass** for analyzer-based rules (Logic Patterns, PDA Compliance) using `ProcessModelAnalyzer`
- Enriches raw bpmnlint output with three-tier metadata from `builtinRuleMetadata`
- Merges findings from both passes and sorts by severity (errors first)

### ProcessModelAnalyzer

**Path:** `studio/src/modules/bpmn-linter/rules/ProcessModelAnalyzer.ts`

Shared graph analysis utility instantiated once per lint run by `LintEngine`. Operates on bpmn-moddle `definitions` and provides pre-computed data structures consumed by Logic Pattern and PDA Compliance rules.

| Method | Returns | Used by |
|--------|---------|---------|
| `getFlowElements()` | Flat list of all flow elements (recursive into subprocesses) | Most rules |
| `getSequenceFlows()` | All sequence flows with resolved source/target | Most rules |
| `getOutgoingFlows(id)` | Sequence flows where source matches | AST-203, 205, 206, 208, 215, 216 |
| `getIncomingFlows(id)` | Sequence flows where target matches | AST-216 |
| `getSuccessors(id)` | Resolved target elements from outgoing flows | AST-202, 203, 205, 215 |
| `getBoundaryEvents(id)` | Boundary events attached to the given activity | AST-202, 203, 207, 212, 213, 214 |
| `hasTimerBoundary(id)` | Boolean: timer boundary attached | AST-208, 212, 213 |
| `hasCompensationBoundary(id)` | Boolean: compensation boundary attached | AST-202, 214 |
| `hasErrorBoundary(id)` | Boolean: error boundary attached | AST-207 |
| `findSequentialChains()` | Array of task-ID chains (length > 1) | AST-201, 204 |
| `findCycles()` | Array of element-ID cycles (DFS back-edge detection) | AST-208 |
| `getControlFlowComplexity()` | Number (CFC metric) | AST-209 |
| `getElementCount()` | Total flow element count | AST-210 |
| `getNestingDepth()` | True recursive subprocess nesting depth | AST-211 |
| `getTasksByType(type)` | Filtered tasks | AST-202, 204, 207, 214 |
| `getGatewaysByType(type)` | Filtered gateways | AST-206, 216 |
| `getDataAssociations()` | All data associations | AST-204, 106 |

Expensive operations (cycles, chains, CFC, nesting depth) are lazily computed on first access and cached for the lint run.

### LintOverlayManager

**Path:** `studio/src/modules/bpmn-linter/LintOverlayManager.ts`

Manages canvas markers for lint findings. Each element gets the marker CSS class for its worst severity (`lint-error`, `lint-warning`, `lint-info`). Does NOT use `BpmnElementOverlayManager` — operates directly on the diagram-js `canvas` service for fine-grained control.

---

## Finding Model

```typescript
type LintFinding = {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  elementId: string | null;
  elementName: string | null;
  message: string;       // What is wrong
  why: string;           // Why it matters
  suggestion: string;    // How to fix it
  category: LintCategory;
};
```

bpmnlint's `reporter.report(id, message)` only supports a string message. The three-tier metadata is added post-lint by `LintEngine`, which looks up `why` and `suggestion` from:

- `builtinRuleMetadata` (for built-in bpmnlint rules)
- Co-exported metadata maps (for custom rules, future phases)

---

## Rule System

### Browser Bundling

bpmnlint normally resolves rules via Node's `require()`. In the Rspack/browser context, rules are pre-imported and bundled in a manual config object. The `LintEngine.createResolver()` method returns a custom resolver that maps rule names to their factories.

**Path:** `studio/src/modules/bpmn-linter/rules/config.ts`

### Custom rule modules (TypeScript)

Additional rule factories live under `studio/src/modules/bpmn-linter/rules/`, grouped by category:

| Subfolder | Type | Purpose |
|-----------|------|---------|
| `bpmn-spec/` | bpmnlint | BPMN 2.0 spec constraints (BSC-*) |
| `structure/` | bpmnlint | Graph and structural checks (AST-0xx) |
| `execution-readiness/` | bpmnlint | Engine-oriented completeness (EXR-*) |
| `naming-quality/` | bpmnlint | Labels and naming heuristics (NMQ-*) |
| `logic-patterns/` | post-processing | Process-wide logic analysis (AST-2xx) |
| `pda-compliance/` | post-processing | PDA layer separation (AST-1xx) |

**bpmnlint rules** default-export a zero-arg factory returning `{ check(node, reporter) }` and are resolved via the custom bpmnlint resolver.

**Post-processing rules** default-export a function `(analyzer: ProcessModelAnalyzer, severity: RuleSeverityConfig) => LintFinding[]`. They are registered in `postProcessingRuleFactories` in `rules/config.ts` and run after the bpmnlint pass.

### Post-processing rule architecture

Logic Pattern and PDA Compliance rules require process-wide graph analysis (cycles, chains, CFC, nesting depth) that bpmnlint's per-node visitor pattern cannot provide. These rules run in a separate pass:

1. `LintEngine.lint()` completes the bpmnlint pass
2. If any post-processing rules are active, `LintEngine` instantiates a `ProcessModelAnalyzer` from the BPMN definitions
3. Each active post-processing rule receives the analyzer and its configured severity
4. Rules return `LintFinding[]` directly (with three-tier metadata pre-filled)
5. Findings are merged with bpmnlint results and sorted by severity

### Event Subprocess exclusions

Event Subprocesses (`bpmn:SubProcess` with `triggeredByEvent === true`) are triggered by their typed start event, not by incoming sequence flows. Several rules must therefore exclude or special-case them to avoid false positives:

| Rule | How it handles Event Subprocesses |
|------|-----------------------------------|
| `no-disconnected` (bpmnlint) | Skips nodes with `triggeredByEvent` — no false "disconnected" report. |
| `sub-process-blank-start-event` (bpmnlint) | Skips `triggeredByEvent` subprocesses (only checks normal subprocesses). |
| `unreachable-elements` | Skips `bpmn:SubProcess` with `triggeredByEvent` in the reachability check (they can never be reached via sequence flows by design). Also skips recursive descent into them (their internal scope is already linted separately by `start-event-required` / `end-event-required`). Additionally, when the BFS visits a Link Intermediate Throw Event, it enqueues the matching Link Intermediate Catch Event(s) (same `LinkEventDefinition.name` within the scope), mirroring runtime link-pair resolution. |
| `process-error-events`, `service-task-error-boundary`, `gateway-type-mismatch` | Their `collectFlowElements` helpers skip `triggeredByEvent` subprocesses when recursing, so elements inside event subprocesses do not bleed into the parent scope's analysis. |

When adding new rules that walk `flowElements` of a `bpmn:Process` or `bpmn:SubProcess`, always check `!el.triggeredByEvent` before treating event subprocesses as regular flow nodes or recursing into them.

### Event Subprocess validation rules

The engine executes Event Subprocesses (ESPs) and validates them at deploy time. The linter mirrors those deploy-time checks so authors see violations before deployment. Severities are `warn` in `bpmn-development` and `error` in `bpmn-production-ready`.

| Rule | Path | Mirrors engine rule | Reports |
|------|------|---------------------|---------|
| `event-subprocess-no-flows` | `bpmn-spec/event-subprocess-no-flows.ts` | `event_subprocess_has_sequence_flow` | An ESP shell with any incoming/outgoing sequence flow (BSC-005). Previously `off`; now enabled in both profiles. |
| `event-subprocess-single-start-event` | `bpmn-spec/event-subprocess-single-start-event.ts` | `event_subprocess_no_start_event` + `event_subprocess_multiple_start_events` | An ESP with zero or more than one Start Event (BSC-013). |
| `event-subprocess-start-event-type` | `bpmn-spec/event-subprocess-start-event-type.ts` | `event_subprocess_untyped_start` + `event_subprocess_error_start_must_interrupt` | An ESP Start Event whose trigger type is not in the allow-list (Message, Timer, Signal, Conditional, Error, Escalation) — e.g. Compensation (BSC-014); and a non-interrupting Error start (BSC-015). |

The allowed trigger set matches the modeler replace-menu whitelist in `bpmn-core/bpmn-js/Provider/CustomPopupProvider.ts` (interrupting: Message/Timer/Signal/Conditional/Error/Escalation; non-interrupting: the same minus Error). The blank/untyped start case is left to the built-in `event-sub-process-typed-start-event` rule so it is not double-reported by `event-subprocess-start-event-type`; the cross-boundary case remains covered by `no-cross-boundary-flows`.

### Profiles and Custom Rulesets

Two built-in profiles are immutable and defined in `rules/config.ts`:

| Profile | Purpose | Characteristics |
|---------|---------|-----------------|
| `bpmn-development` | Standard BPMN 2.0 validation for active development | Execution-readiness rules off, gateway restriction rules off |
| `bpmn-production-ready` | Stricter rules for deployment-ready processes | Execution-readiness rules active, stricter severities across all categories |

Users can create **custom rulesets** in addition to the built-in profiles. Each custom ruleset has a structured JSON shape:

```json
{
  "bpmnLinter.customRulesets": {
    "My Strict Rules": {
      "base": "bpmn-development",
      "rules": {
        "label-required": "error",
        "no-complex-gateway": "off"
      }
    }
  }
}
```

| Key | Purpose |
|-----|---------|
| `base` | Name of the built-in profile used as baseline (defaults to `bpmn-development` if missing) |
| `rules` | Rule severity overrides applied on top of the base profile |

When the `rules` object is empty or absent, the custom ruleset inherits the base profile's rules verbatim. When rules are present, they override the base profile's values for those specific rules.

The `bpmn.linter.createCustomRuleset` command opens a dialog with three inputs: a name, a template selector, and a "Copy rules from template" checkbox. When the checkbox is ticked, all rules from the selected template are copied into `rules`, giving the user full explicit control. When unticked, `rules` is left empty and the ruleset inherits implicitly. After creation, the JSON Settings Editor is opened so the user can start editing immediately.

### Built-in Rules

The full rule configuration includes 14 rules from the `bpmnlint` package plus many custom rules across all categories (BPMN Spec, Structure, Execution Readiness, Naming Quality, Logic Patterns, PDA Compliance). Severity levels differ between profiles — `bpmn-development` disables execution-readiness and some gateway rules, while `bpmn-production-ready` activates all categories at stricter severities. See `rules/config.ts` for the complete per-profile rule configuration.

The 14 **bpmnlint-provided** rules (resolved via the custom bpmnlint resolver):

| Rule | `bpmn-development` | `bpmn-production-ready` | Category |
|------|---------------------|-------------------------|----------|
| `start-event-required` | error | error | bpmn-spec |
| `end-event-required` | error | error | bpmn-spec |
| `fake-join` | warn | error | structure |
| `no-implicit-split` | error | error | structure |
| `no-disconnected` | off | off | structure |
| `no-gateway-join-fork` | off | off | structure |
| `single-blank-start-event` | warn | error | structure |
| `superfluous-gateway` | warn | warn | structure |
| `conditional-flows` | off | off | structure |
| `label-required` | warn | warn | naming-quality |
| `sub-process-blank-start-event` | warn | error | structure |
| `event-sub-process-typed-start-event` | warn | error | structure |
| `no-complex-gateway` | error | error | structure |
| `no-inclusive-gateway` | off | off | structure |

---

## Icons

Icons are registered in `index.ts` via `bifrost.icons.registerIcons()`:

| Icon ID | Class | Purpose |
|---------|-------|---------|
| `bpmn-linter/severity/error` | `ph-fill ph-x-circle` | Error severity badge in ProblemsPane group headers |
| `bpmn-linter/severity/warning` | `ph-fill ph-warning` | Warning severity badge |
| `bpmn-linter/severity/info` | `ph-fill ph-info` | Info severity badge |
| `bpmn-linter/badge/check` | `ph ph-check-circle` | "No issues" badge and empty pane state |
| `bpmn-linter/badge/error` | `ph ph-x-circle` | Error count in summary badge |
| `bpmn-linter/badge/warning` | `ph ph-warning` | Warning count in summary badge |
| `bpmn-linter/badge/info` | `ph ph-info` | Info count in summary badge |

All UI components use `<Icon id="..." />` from the SDK instead of raw `<i className="...">` elements, so plugin developers can override them.

---

## Error Summary Badge

**Path:** `studio/src/modules/bpmn-linter/overlays/ErrorSummaryBadge.tsx`

A floating React component mounted inside `.editor__content` via DOM injection. Positioned `absolute; bottom: 12px; left: 50%` with `z-index: 10`.

- Shows "X Errors Y Warnings" with severity icons when findings exist
- Shows green "No issues" badge when lint passes with zero findings
- Hidden only when linting is deactivated
- Background color reflects worst severity (red/yellow/blue/green)
- Click activates the `linter` pane group in the right pane area (via `bpmn.linter.showProblemsPane` command)
- Uses registered `<Icon>` components for all icons

---

## Ruleset Selector (Menu Bar)

**Path:** `studio/src/modules/bpmn-linter/initializers/initializeMenuBarItems.ts`

A `<select>` dropdown registered in the right menu bar via `bifrost.menuBar.registerMenuBarItemModifier`. Positioned before the layout menu item. Replaces the former `RulesetSelectorPane` that lived inside the right pane area.

- **Visibility**: shown when a BPMN editor is focused AND `bpmnLinter.enabled` is `true`
- **Data source**: reads from bridge's `getActiveProfile()` and `getAvailableProfiles()` via the modeler adapter
- **On change**: executes `bpmn.linter.setProfile` command, which writes to `bpmnLinter.profile` setting, triggering profile reapplication and re-lint

---

## Findings Pane

**Path:** `studio/src/modules/bpmn-linter/panes/ProblemsPane.tsx`

Registered in its own `linter` pane group in the right pane area (separate from the `property` group). Shown by clicking the Error Summary Badge or via the `bpmn.linter.showProblemsPane` command.

### Visibility

The pane's `shouldBeDisplayed` returns `true` when `bpmnLinter.enabled` is `true`. The pane group is activated/deactivated via the pane group tab bar in the right pane area. The `bpmn.linter.showProblemsPane` command calls `bifrost.panes.setActiveGroupInArea('right', 'linter')` and `bifrost.panes.showPaneArea('right')`.

### Dynamic Group Icon

The `linter` pane group uses a dynamic icon factory (`getLinterIconClass` in `initializePanes.ts`) that returns a CSS class reflecting the current worst finding severity. The base icon is `ph-fill ph-highlighter` (changed from `ph-warning` to differentiate the linter from the sanitizer):

| Condition | CSS Class |
|-----------|-----------|
| Errors present | `ph-fill ph-highlighter lint-severity--error` (red) |
| No errors, warnings present | `ph-fill ph-highlighter lint-severity--warning` (orange) |
| No errors/warnings, infos present | `ph-fill ph-highlighter lint-severity--info` (blue) |
| No findings | `ph-fill ph-highlighter` (default) |

The icon factory reads from a shared `linterCounts` object that `LintBridge` updates after each lint run via the `paneLayoutAccessor.updateCounts()` bridge.

### Pane Interactivity

- **Findings grouped by severity** (errors, warnings, info), each group with a header using registered severity icons
- **Hover highlighting**: hovering over a finding row applies a blue `lint-highlight` marker to the corresponding element on canvas (uses `.djs-outline` with `--theme-diagram-selected-outline`)
- **Click-to-zoom**: clicking a finding zooms the viewport to center on the element and selects it (replaces current selection)
- **Shift+Click**: adds the finding's element to the current selection without zooming — mirrors the shift-click multi-select behavior of the BPMN canvas
- **Bidirectional selection**: selecting elements on the BPMN canvas highlights the corresponding findings in the pane with a blue background (`--lint-selection-highlight-bg`)
- **Expanded state**: shows `why` and `suggestion` detail
- **Data source**: reads from bridge's `getFindings()` and `getSelectedElementIds()` via polling

---

## Diagnostics Integration

After each lint run, `LintBridge._pushDiagnostics()` converts `LintFinding[]` to `Diagnostic[]` and calls `bifrost.diagnostics.setDiagnostics(uri, 'bpmn-linter', diagnostics)`. This feeds:

- **Status bar problems count** (`std/problems`) — already wired to `EVENT_DIAGNOSTICS_CHANGED`
- **Future consumers** that subscribe to the diagnostics API

On diagram destroy, diagnostics are cleared via `setDiagnostics(uri, 'bpmn-linter', [])`.

---

## Settings

### Settings

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `bpmnLinter.enabled` | boolean | `false` | Master toggle — synced with `LintBridge._active`, controls menu bar selector visibility |
| `bpmnLinter.autoLintDelay` | number | `300` | Debounce delay in ms |
| `bpmnLinter.profile` | string | `bpmn-development` | Active ruleset name (built-in or custom) |
| `bpmnLinter.customRulesets` | object | `{}` | Dictionary of custom rulesets (see Profiles and Custom Rulesets) |

The two built-in profiles are immutable — they cannot be modified through settings. Per-rule severity customization is only available via custom rulesets.

### Custom Ruleset Resolution

When `bpmnLinter.profile` points to a custom ruleset name:

1. `LintBridge.applyProfile()` reads `bpmnLinter.customRulesets[name]`
2. Reads `base` to determine the built-in profile baseline
3. Reads `rules` and passes entries as overrides to `LintEngine.setRuleOverrides()`
4. `LintEngine.lint()` merges base profile rules with overrides before running bpmnlint

When the profile is a built-in name, no overrides are applied.

---

## Commands

| Command | Title | Context |
|---------|-------|---------|
| `bpmn.linter.toggle` | (internal) | Palette entry |
| `bpmn.linter.showProblemsPane` | (internal) | Badge click — activates the `linter` group in the right pane area |
| `bpmn.linter.setProfile` | (internal) | Menu bar selector — writes to `bpmnLinter.profile` setting |
| `bpmn.linter.createCustomRuleset` | BPMN: Create Custom Lint Ruleset | Command search |

---

## Theming

Severity colors are defined as CSS custom properties in `bpmn-linter.scss`, scoped to `.bifrost.bifrost-theme--dark` / `--light`:

| Variable | Dark | Light |
|----------|------|-------|
| `--lint-error-border` | `#dc2626` | `#dc2626` |
| `--lint-error-bg` | `rgba(220,38,38,0.15)` | `rgba(220,38,38,0.08)` |
| `--lint-warning-border` | `#d97706` | `#d97706` |
| `--lint-warning-bg` | `rgba(217,119,6,0.15)` | `rgba(217,119,6,0.08)` |
| `--lint-info-border` | `#3975f7` | `rgb(61,190,230)` |
| `--lint-info-bg` | `rgba(37,99,235,0.15)` | `rgba(37,99,235,0.08)` |
| `--lint-clean-border` | `#16a34a` | `#16a34a` |
| `--lint-clean-bg` | `rgba(22,163,74,0.15)` | `rgba(22,163,74,0.08)` |
| `--lint-selection-highlight-bg` | `rgba(37,99,235,0.18)` | `rgba(33,150,243,0.12)` |

Canvas markers override the SVG stroke of `.djs-element .djs-visual > :first-child`.

Hover highlighting uses `.djs-element.lint-highlight .djs-outline` with `--theme-diagram-selected-outline` (the same blue as element selection).

Palette entry active state uses `--theme-focus` for the highlight color.

---

## Linter score and persistence

### Scoring

- **Module:** `studio/src/modules/bpmn-linter/scoring/computeLintScore.ts` (pure function) and `scoring/isScorableElement.ts` (denominator + `__diagram__` bucket).
- **Types:** `LintScoreSnapshot`, `ScorePolicy`, `LintScoreComplianceStatus` in `studio/src/modules/bpmn-linter/types.ts`.
- **Policy resolution:** `studio/src/modules/bpmn-linter/resolveScorePolicy.ts` merges built-in `scorePolicy` from `rules/config.ts` with optional `scorePolicy` on custom rulesets (`bpmnLinter.customRulesets`).
- **Per ruleset:** Only the **active** profile is recomputed on each lint; other ruleset rows in XML are left as last written.

### UI

- **Badge:** `ErrorSummaryBadge` shows `Score: xx.x%` with color by `complianceStatus` (`valid` / `risky` / `failed`).
- **Pane:** `LinterScorePane` is registered **before** `ProblemsPane` in `initializePanes.ts`. Help id: `bpmn-linter/linter-score`.

### BPMN XML (`evil:` platform extension)

Scores are stored on **`bpmn:Definitions`** so deployable BPMN remains the source of truth for engines.

| Item | Value |
|------|--------|
| Moddle descriptor | `studio/src/modules/bpmn-core/moddle/evil-platform.json` |
| Namespace URI | `https://evil.studio/schema/bpmn/platform/1.0` |
| Moddle prefix | `evil` (registered in `BpmnModelerComponentAdapter`, `BpmnViewerComponentAdapter`, `BpmnViewerWithSync`) |
| Container element | `evil:properties` under `bpmn:extensionElements` |
| Per-ruleset rows | `evil:linterRulesetScore` (many), attributes: `rulesetId`, `scorePercent`, `complianceStatus`, `computedAtIso`, `schemaVersion`, `maxPoints`, `penaltyPoints`, `rawErrorFindings`, `rawWarningFindings` |

`evil:Properties` must be a normal **`Element`** with `meta.allowedIn` (e.g. `["*"]`) for placement inside `bpmn:ExtensionElements.values`. Do **not** set `"extends": ["bpmn:ExtensionElements"]` on that type: moddle rejects `create('evil:Properties', …)` with *cannot create \<evil:Properties\> extending \<bpmn:ExtensionElements\>*, so scores never persist and XML can show an empty `<bpmn:extensionElements />` if another path created the container.

### Command stack

- **Command id:** `evil.platform.updateLinterRulesetScore`
- **Handler:** `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateEvilLinterRulesetScoreHandler.ts` (registered via `CommandHandler` map in `CommandHandler/index.ts`).
- **Lint loop guard:** `LintBridge` increments `_lintScheduleSuppressionCount` around `commandStack.execute` for the score command and ignores `commandStack.changed` while the counter is greater than zero, then decrements on a microtask to avoid infinite relint.
- **Studio XML cache / inspector:** The score command only mutates definitions moddle; diagram-js may not surface a change the way the Studio expects. After a successful persist, `LintBridge` fires `eventBus.fire('elements.changed', { elements: [rootShape] })` so `BpmnModelerComponentAdapter` runs `saveXML` and `BpmnDocumentModel` receives `EVENT_BPMN_MODELER_ADAPTER_XML_CHANGED`. On that event, `BpmnDocumentModel` must assign **`this.xml = xml`** before `updateCurrentData(xml)` — the `currentXml` getter reads `this.xml`, while dirty/save uses base `currentData`; updating only `currentData` leaves the XML inspector and open-in-tab stale. `definitions` is resolved by walking `$parent` from the canvas root business object until `bpmn:Definitions` (correct when the canvas root is not an immediate child of definitions, e.g. subprocess drill-down).

---

## Type System

**Path:** `studio/src/modules/bpmn-linter/types.ts`

All linter-specific types live in `types.ts`. The module does not use `any` outside two diagram-js `$inject` casts (a framework limitation).

### BPMN moddle types

Lightweight structural interfaces for moddle element shapes the linter accesses. They are NOT the full bpmn-moddle schema — only properties actually read by linter code are modelled.

| Type | Purpose |
|------|---------|
| `ModdleNode` | Base moddle element with universally accessed properties (`$type`, `id`, `name`, `$parent`, `$attrs`, `eventDefinitions`, `incoming`, `outgoing`, `flowElements`, `triggeredByEvent`, `sourceRef`, `targetRef`, `conditionExpression`, `attachedToRef`, `default`) plus `[property: string]: unknown` index signature for less common properties |
| `ModdleDefinitions` | Root definitions element with `rootElements: ModdleNode[]` |
| `ModdleEventDefinition` | Event definition subtype (`$type`, `id`, plus index signature) |
| `ModdleFormalExpression` | Expression subtype with `body?: string` |

Properties not explicitly declared on `ModdleNode` go through the index signature and return `unknown`. Rules access them via inline casts (e.g. `node.loopCharacteristics as ModdleNode | undefined`), which is explicit and self-documenting.

### bpmnlint library types

The `bpmnlint` and `bpmnlint-utils` packages ship no `.d.ts` files. Module declarations live in `studio/src/packages.d.ts`; contract types live in `types.ts`:

| Type | Purpose |
|------|---------|
| `BpmnlintReporter` | `{ report(id, message): void }` — used by all bpmnlint-style rules |
| `BpmnlintCheckFn` | `(node: ModdleNode, reporter: BpmnlintReporter) => void` |
| `BpmnlintRuleFactory` | `() => BpmnlintRuleDefinition` — factory maps in `config.ts` |
| `BpmnlintConfig` | `{ rules: Record<string, string | number> }` — passed to `new Linter()` |
| `BpmnlintResolver` | Resolver contract with `resolveRule()` and `resolveConfig()` |
| `BpmnlintReport` | Single report entry `{ id, message }` from a bpmnlint lint run |

### Diagram-js service types

`LintBridge`, `LintOverlayManager`, and `LinterPaletteProvider` import typed services from `diagram-js`:

| Service | Import path |
|---------|-------------|
| `Canvas` | `diagram-js/lib/core/Canvas` |
| `ElementRegistry` | `diagram-js/lib/core/ElementRegistry` |
| `EventBus` | `diagram-js/lib/core/EventBus` |
| `CommandStack` | `diagram-js/lib/command/CommandStack` |
| `Overlays` | `diagram-js/lib/features/overlays/Overlays` |
| `Selection` | `diagram-js/lib/features/selection/Selection` |
| `Palette` | `diagram-js/lib/features/palette/Palette` |

### LintBridgeApi

An interface describing the public surface of the `LintBridge` diagram-js service. Used as the generic parameter for `getModelerComponentByName<LintBridgeApi>('lintBridge')` in panes, initializers, and palette providers. This avoids `any` at every call site while keeping the actual `LintBridge` implementation internal.

### Severity mapping

`RuleSeverityConfig` (`'error' | 'warn' | 'info' | 'off'`) uses `'warn'` while `LintSeverity` (`'error' | 'warning' | 'info'`) uses `'warning'`. The `mapToLintSeverity()` helper bridges this gap. All post-processing rules use it instead of inline `severity as any` casts.

---

## File Path Reference

| Component | Path |
|-----------|------|
| Module entry | `studio/src/modules/bpmn-linter/index.ts` |
| LintBridge | `studio/src/modules/bpmn-linter/LintBridge.ts` |
| LinterPaletteProvider | `studio/src/modules/bpmn-linter/LinterPaletteProvider.ts` |
| LintEngine | `studio/src/modules/bpmn-linter/LintEngine.ts` |
| LintOverlayManager | `studio/src/modules/bpmn-linter/LintOverlayManager.ts` |
| Types | `studio/src/modules/bpmn-linter/types.ts` |
| ProcessModelAnalyzer | `studio/src/modules/bpmn-linter/rules/ProcessModelAnalyzer.ts` |
| Rule config & profiles | `studio/src/modules/bpmn-linter/rules/config.ts` |
| Logic Pattern rules | `studio/src/modules/bpmn-linter/rules/logic-patterns/` |
| PDA Compliance rules | `studio/src/modules/bpmn-linter/rules/pda-compliance/` |
| ErrorSummaryBadge | `studio/src/modules/bpmn-linter/overlays/ErrorSummaryBadge.tsx` |
| ProblemsPane | `studio/src/modules/bpmn-linter/panes/ProblemsPane.tsx` |
| LinterScorePane | `studio/src/modules/bpmn-linter/panes/LinterScorePane.tsx` |
| Score engine | `studio/src/modules/bpmn-linter/scoring/computeLintScore.ts` |
| Evil platform moddle | `studio/src/modules/bpmn-core/moddle/evil-platform.json` |
| Score persist handler | `studio/src/modules/bpmn-core/bpmn-js/CommandHandler/UpdateEvilLinterRulesetScoreHandler.ts` |
| Linter score help | `studio/src/modules/bpmn-linter/texts/linter-score.md` |
| Settings initializer | `studio/src/modules/bpmn-linter/initializers/initializeSettings.ts` |
| Commands initializer | `studio/src/modules/bpmn-linter/initializers/initializeCommands.ts` |
| Panes initializer | `studio/src/modules/bpmn-linter/initializers/initializePanes.ts` |
| Menu bar items | `studio/src/modules/bpmn-linter/initializers/initializeMenuBarItems.ts` |
| SCSS | `studio/src/modules/bpmn-linter/styles/bpmn-linter.scss` |
| Module registration | `studio/src/createAndInitializeBifrost.ts` |
