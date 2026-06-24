# Technical Decision Log

This file records significant technical decisions made during the development of Bifrost Forge World. Each entry captures the context, the options considered, the choice made, and the rationale. This helps future contributors (and AI agents) understand *why* things are the way they are, preventing well-intentioned "improvements" that revisit already-rejected alternatives.

Agents should add entries here when a meaningful design choice is made during their session.

---

## Format

```
### YYYY-MM-DD — Short title

**Context**: What situation or problem prompted this decision.

**Options considered**:
- A) ...
- B) ...

**Decision**: Which option was chosen.

**Rationale**: Why this option was chosen over the alternatives.
```

---

## Decisions

### D1 — Merged command registration API (2026-06-14)

Merged the four command registration methods (`register`, `registerInCommandSearch`, `registerWithContext`, `registerInCommandSearchWithContext`) into a single `register(name, callback, options?)` method with a `CommandRegistrationOptions` object. The plugin API was similarly merged from `registerCommand` + `registerInCommandSearch` into `register(id, callback, options?)` with `PluginCommandOptions`. The old methods were removed without deprecation — no external consumers exist. This eliminates fragile variadic argument parsing and provides a cleaner, extensible API surface.

### 2026-04-16 — BPMN linter scores persisted as XML (`evil:`), not JSON

**Context**: Linter scores must be readable by external engines from the deployed BPMN. A single JSON string on definitions would force engines to parse XML and then parse nested JSON.

**Options considered**:
- A) String attribute / JSON blob on `bpmn:Definitions`
- B) Typed extension elements under a dedicated `evil:` moddle package (`evil:properties` → `evil:linterRulesetScore` children with attributes)

**Decision**: Option B.

**Rationale**: One DOM tree, XPath-friendly structure, better human readability in raw XML, and room for future Bifrost Forge World platform fields without overloading `camunda:properties`. Studio still uses bpmn-js `commandStack` + a custom handler for undo-safe updates; `LintBridge` suppresses one lint scheduling round-trip while that command runs to avoid an infinite `commandStack.changed` loop.

### 2026-03-30 — Cursor rules: reduce alwaysApply token overhead

**Context**: An audit of the Cursor setup revealed that 8 out of 13 rules were `alwaysApply: true`, causing all of them to be loaded into every conversation regardless of relevance. Several rules (code quality, dialog vs notification, test maintenance, dependency placement) are only useful when working with specific file types.

**Options considered**:
- A) Keep all rules as alwaysApply for maximum safety
- B) Convert domain-specific rules to glob-scoped activation

**Decision**: Option B. Converted `code-quality.mdc`, `dialog-vs-notification.mdc`, `maintain-tests.mdc`, and `dependency-placement.mdc` to glob-scoped rules.

**Rationale**: Glob-scoped rules still activate when the agent is working with relevant files, but they no longer consume context window tokens during documentation-only, question-answering, or unrelated coding sessions. The build verification rule (`build.mdc`) remains alwaysApply as a universal quality gate.

---

### 2026-03-30 — Project context rule: inline summary instead of mandatory doc reading

**Context**: The `project-context.mdc` rule instructed agents to read 5 documentation files before making any change. For small fixes, this added hundreds of lines of unnecessary context reading.

**Options considered**:
- A) Keep the mandatory upfront reading
- B) Put a self-contained project summary in the rule and point to docs as on-demand references

**Decision**: Option B. The rule now contains the essential architecture summary inline and lists docs as "read on demand, not upfront."

**Rationale**: Agents get the critical context (folder structure, command pattern, module isolation) immediately from the rule itself. They only read deeper docs when actually working on a relevant subsystem.

---

### 2026-03-30 — Git commits: always created manually by the developer

**Context**: AI agents can offer to create commits automatically after completing work.

**Decision**: Commits are always created manually by the developer. Agents must never create, offer, or ask about creating commits.

**Rationale**: The manual commit step serves as a final review gate. The developer inspects all changes before committing, which catches subtle issues the agent may have introduced.

---

### 2026-03-30 — Common pitfalls file for agent learning

**Context**: Architectural gotchas (dialog startup timing, pane group registration safety, theme token ownership) were scattered across individual rules. Agents could encounter the same mistakes across sessions without a centralized reference.

**Decision**: Created `docs/architecture/common-pitfalls.md` as a living document where agents record non-obvious constraints and recurring mistakes as they encounter them.

**Rationale**: A centralized pitfalls reference reduces repeated mistakes across sessions and serves as a lightweight "learning" mechanism for stateless AI agents.

---

### 2026-03-31 — Success notifications: only when no immediate visual feedback

**Context**: Git commands like `stash` and `stash apply` were showing success notifications after completion. These were reported as unnecessary visual noise because the action's effect is immediately visible in the UI (file explorer decorations change, Git Pane updates).

**Decision**: Success notifications are reserved for actions that produce **no immediate visual effect** — typically remote operations (`push`, `pull`, `sync`). Actions with instant UI feedback (stash, unstage, revert, etc.) must not show success toasts. Errors and warnings are always shown.

**Rationale**: Non-technical users are the primary audience. Every notification demands attention; redundant success messages train users to ignore notifications, reducing the effectiveness of the ones that matter (errors, warnings).

---

### 2026-03-31 — Status bar priority-based ordering

**Context**: Status bar items appeared in registration order (first-registered = first-displayed). Extensions could not control relative positioning within an area.

**Decision**: Added a `priority: number` parameter to `registerStatusBarItem()`. Items are sorted descending by priority within each area. Default priority is `0`.

**Rationale**: Allows predictable item placement as more modules register status bar items, without depending on module load order.

---

### 2026-03-31 — Solution name badge instead of full-bar color modes

**Context**: VS Code changes the entire status bar background color based on state (no folder = orange, remote = purple). The original plan proposed the same for Bifrost Forge World.

**Decision**: Adopted a badge-style approach (like Cursor's workspace badge) instead of full-bar color modes. A `std/solution-name` item shows the solution name with a semi-transparent accent background, or "No Solution" when inactive.

**Rationale**: The badge is less visually disruptive, matches the Cursor reference the team prefers, and requires no framework-level mode system — it's just a regular status bar item.

---

### 2026-03-31 — DiagnosticsService as foundation for BPMN linter

**Context**: A BPMN linter is planned as one of the next features. It will need a way to report validation errors and show an aggregate count in the status bar.

**Decision**: Built `bifrost.diagnostics` (a URI-keyed diagnostic store with `setDiagnostics`/`clearDiagnostics`/`getCount`) as part of the status bar overhaul. No producers exist yet; the problems count item shows `0 / 0`.

**Rationale**: Laying the infrastructure now avoids revisiting the status bar when the linter lands. The API is simple and open-ended — any module can contribute diagnostics.

---

### 2026-03-31 — Move change summary ownership from git-cruiser to bpmn-diff

**Context**: The "Show Changes" summary dialog was implemented in git-cruiser, but its logic (running `bpmn-js-differ`, formatting results) is pure BPMN diff presentation with no Git dependency. The bpmn-diff module already owns the side-by-side diff view and element-level ContentDiff pane.

**Decision**: Moved the summary builder, ChangeOverview pane, and the "Show Summary" toolbar button to the bpmn-diff module. The summary dialog (`bpmn.diff.showChangeSummaryDialog`) lives in the diff view toolbar and reads directly from the already-computed `BpmnDiffDocumentModel` — no git-cruiser dependency. git-cruiser's commit preview calls `bpmn.diff.getChangeSummaryMarkdown` (receiving raw XMLs) as the only remaining cross-module touchpoint.

**Rationale**: Aligns ownership with the subsystem boundary (BPMN diffing belongs in bpmn-diff). The diff view already has the full diff at hand, so the summary dialog needs no redundant re-computation or cross-module calls. Keeps the cross-module coupling minimal (one command, commit-preview only).

---

### 2026-03-31 — Move diff infrastructure to bpmn-core/diff/ as shared foundation

**Context**: The BPMN File History & Restore feature in git-cruiser needed to reuse `BpmnDiff`, `BpmnViewerWithSync`, the diff web worker, and constants that previously lived in `bpmn-diff`. Cross-module imports are not allowed.

**Options considered**:
- A) Duplicate all diff classes in git-cruiser (~400 lines)
- B) Move shared classes to `bpmn-core` as a foundation module and import from there in both `bpmn-diff` and `git-cruiser`
- C) Create a new shared package

**Decision**: Option B. Moved `BpmnDiff.ts`, `BpmnDiffingWorkerClient.ts`, `BpmnDiffingWorker.ts`, `BpmnViewerWithSync.tsx`, and `bpmnDiffConstants.ts` to `bpmn-core/diff/`. Also extracted shared SCSS styles to `bpmn-core/diff/styles/`. A barrel export (`bpmn-core/diff/index.ts`) provides clean imports.

**Rationale**: `bpmn-core` is already a foundation module (`engine-bpmn-viewer`, `engine-debugger`, and `bpmn-editor` import from it). Moving diff infrastructure there avoids duplication, keeps the no-cross-module-import rule intact, and co-locates the shared code with its styles.

---

### 2026-03-31 — Duplicate minimal changeSummaryBuilder in git-cruiser for history pane

**Context**: The history preview's "Restore Overview" pane needs `buildChangeSummary()` to show what restoring would change. The full `changeSummaryBuilder` (~190 lines) includes markdown formatting not needed here. It lives in `bpmn-diff`.

**Options considered**:
- A) Move the full builder to `bpmn-core` (adds unnecessary dependency)
- B) Duplicate only the ~90 lines of types + `buildChangeSummary()` in git-cruiser, importing constants from `bpmn-core/diff/`

**Decision**: Option B. The duplicated code is pure, stateless, and unlikely to diverge. Constants (`ATTRIBUTE_LABELS`, `LAYOUT_CHANGE_REJECTED_TYPES`) are imported from the shared `bpmn-core/diff/` barrel.

**Rationale**: Keeps the Restore Overview pane lightweight and self-contained. The duplication is small, the function is stable, and moving the full builder to `bpmn-core` would pull markdown formatting utilities there unnecessarily.

---

### 2026-03-31 — Combined fragment renderer for BPMN history preview

**Context**: The BPMN File History feature needs to show both a preview of the historical version and a visual diff. The initial design would have opened a 3-tab chain (BPMN editor → preview fragment → diff fragment).

**Options considered**:
- A) Three separate tabs
- B) Single combined fragment with Preview/Diff mode toggle

**Decision**: Option B. A single `bpmn.history-preview` document type renders both modes with toolbar toggles.

**Rationale**: Eliminates tab clutter, keeps the user in one context, and avoids duplicating model setup across multiple fragments. The diff is computed eagerly in the background, so switching to Diff mode is instant once ready.

---

### 2026-04-01 — Remove dynamic toolbar button registry in favor of static placement

**Context**: The Git toolbar buttons ("Show Diff", "History") in the BPMN editor were registered dynamically at runtime via a `bpmn.editor.registerToolbarButton` command and a `toolbarButtonRegistry.ts` module in `bpmn-editor`. The git-cruiser module called this command during `onLoad` to inject its buttons.

**Options considered**:
- A) Keep the dynamic registry and add a priority/ordering mechanism (similar to the status bar) so buttons can be positioned reliably
- B) Remove the registry and place the Git buttons statically in `BpmnDocumentRenderer.tsx`, guarded by `commands.isRegistered()` checks

**Decision**: Option B. The registry, the `bpmn.editor.registerToolbarButton` command, and the `registerBpmnToolbarButtons` function in git-cruiser were all removed.

**Rationale**: The registry added a cross-module roundtrip with no real benefit — there was no control over button ordering (left/right only, no priority), and making it work properly would have required a priority system plus converting all existing static buttons to use the registry. That effort was disproportionate to the gain. The `isRegistered` guard handles the case where git-cruiser is disabled, and the commands' `enabledPredicateFn` handles per-document enabled/disabled state. As a side benefit, the command handlers were simplified to accept plain `uri: string` arguments, removing the `uriOrDoc` union type and redundant null checks that were already covered by the enabled predicate. Since the git-cruiser module is an internal module, directly bundled into the Studio, this approach is perfectly legal.

---

### 2026-03-31 — Fix PaneProperty onChange/onCommit API Semantics

**Context**: `PaneProperty` with `type="text"` and `type="text-with-suggestions"` used `onChange` as the only callback, but `FormInput` (the underlying component) actually fires this handler on blur/Enter — i.e. it is a "commit" semantic, not a real-time "on every keystroke" semantic. This made it impossible for modules like `GitPane` to use `PaneProperty` for free-form text inputs (commit title, commit body) where the value needs to update on every keystroke.

**Decision**: Rename the existing `onChange` prop to `onCommit` (preserving the blur/Enter/validate behavior) and add a new optional `onChange` prop that fires on every keystroke. Both props are optional — callers can use either or both. All existing callers (~218 replacements across ~80 files) were mechanically renamed from `onChange=` to `onCommit=` to preserve behavior.

**Rationale**: This is a backwards-compatible API clarification. Existing callers continue to work identically after the rename. New callers (like `GitPane`) can now use `onChange` for real-time input and `onCommit` for validated final values. The `type="select"` variant keeps `onChange` since react-select fires it on selection, which is already a commit action.

---

### 2026-03-31 — New SDK Pane Components: PaneActionBar, PaneInfoBar, PaneProperty type="textarea"

**Context**: The `GitPane` used raw HTML elements for action buttons, branch info bars, and the commit body textarea. These patterns are useful for other panes too but had no reusable SDK counterpart.

**Decision**: Added three new component families to the SDK:
- `PaneProperty type="textarea"` — multi-line text input with the same `onChange`/`onCommit` semantics as `type="text"`.
- `PaneActionBar` + `PaneActionButton` — a horizontal row of action buttons with `primary`, `secondary`, and `ghost` variants.
- `PaneInfoBar` + `PaneInfoBarItem` + `PaneInfoBarAction` — a compact status/info row. `PaneInfoBarAction` is command-driven (accepts `studio`, `command`, `commandArgs`) rather than callback-driven, consistent with the Studio's command-first interaction model.

**Rationale**: Extracting these patterns to the SDK allows all modules — internal and third-party — to build panes with consistent structure and theming. The command-driven `PaneInfoBarAction` ensures actions route through the standard command system, keeping behavior discoverable and composable.

---

### 2026-04-02 — BPMN Linter: native integration over bpmn-js-bpmnlint

**Context**: bpmn.io provides `bpmn-js-bpmnlint` as the official diagram-js integration for bpmnlint, handling overlay rendering and lint result display. However, it injects its own CSS, manages its own DOM overlays, and uses pointer-events patterns that conflict with the Studio's theming system and `BpmnElementOverlayManager`.

**Decision**: Skip `bpmn-js-bpmnlint` entirely. Use `bpmnlint` only as the rule engine (in-browser, with manual config bundling). All visualization — canvas markers, the Error Summary Badge, the Problems Pane — is implemented natively using Studio infrastructure (`canvas.addMarker()`, DOM injection into `.editor__content`, SDK pane components).

**Rationale**: Same rationale as the token simulator decision: full theming control, no CSS conflicts, consistent overlay rendering with `BpmnElementOverlayManager`, and the ability to implement three-tier findings (message/why/suggestion) that `bpmn-js-bpmnlint` does not support.

### 2026-04-02 — ~~BPMN Linter: Problems Pane replaces property panes via settings coupling~~ (SUPERSEDED)

> **Superseded by**: 2026-04-07 — Pane group tab system. The `bpmnLinter.problemsPaneVisible` setting, `isBpmnLinterPaneSuppressed()` guard, and property-pane suppression have been removed. The Problems Pane now lives in its own `linter` pane group on the right area, switchable via the pane group tab bar. The Ruleset Selector was moved from a pane to the right menu bar.

---

### 2026-04-07 — BPMN 2.0 spec compliance: remove all engine.* custom properties

**Context**: The Studio originally modelled several BPMN element properties as Camunda custom extension properties (`engine.isSingleton`, `engine.assignUserIds`, `engine.setLoopBreakCondition`, `engine.iterationTimeout`, `engine.isSingleTry`, `engine.setServiceTaskType`). These were created for a legacy engine that has been decommissioned.

**Decision**: Remove all `engine.*` custom properties entirely. Replace them with standard BPMN 2.0 constructs where applicable:
- Loop condition / max iterations → `bpmn:StandardLoopCharacteristics` with `loopCondition` (FormalExpression) and `loopMaximum`
- Multi-instance configuration → `bpmn:MultiInstanceLoopCharacteristics` with `loopCardinality`, `completionCondition`, `inputDataItem`, `outputDataItem`
- User task assignees → `bpmn:HumanPerformer` and `bpmn:PotentialOwner` resource roles
- Process singleton → removed entirely (no spec equivalent, engine-specific concept)
- External task single try → removed entirely (engine retry semantics)

**Rationale**: Full BPMN 2.0 spec compliance, cleaner XML output, and no legacy baggage from the decommissioned engine. Since no engine is currently connected, there is no backward-compatibility concern.

---

### 2026-04-07 — Service task implementation attribute replaces BpmnServiceTaskType enum

**Context**: Service task type detection previously relied on a combination of `BpmnServiceTaskType` enum, `camunda:type` / `camunda:module` attributes, and a `engine.setServiceTaskType` custom property. This was fragile and engine-specific.

**Decision**: Replace the entire mechanism with the BPMN 2.0 `implementation` attribute:
- `##external` for External Service Tasks
- `##WebService` for HTTP Service Tasks
- `##unspecified` (or absent) for generic service tasks

The `BpmnServiceTaskType` enum was deleted. The `CustomServiceTaskType` type now uses `implementation: string` instead of `type: BpmnServiceTaskType; subType: string`. All utility functions (`isExternalServiceTask`, `isHttpServiceTask`) now check `businessObject.get('implementation')`. HTTP Service Tasks are un-deprecated and serve as the recommended default.

**Rationale**: Standard BPMN 2.0 attribute, simpler detection logic, no dependency on Camunda namespace for type discrimination. All existing BPMN test fixtures were updated for a clean break.

---

### 2026-04-07 — BPMN editor pane regrouping into property / scripting / documentation

**Context**: The BPMN editor registered all ~60 panes into a single `property` group on the right pane area. Help-only panes (~30) existed as separate components with no editable fields. Scripting fields (payloads, data sources, custom tokens) were interleaved with static property fields.

**Decision**: Restructure panes into three groups:
- **property**: Basic element properties, event references, loop/MI configuration, assignees, form fields. Contains the new `PropertiesElementInfo` pane which consolidates ~30 help-only panes into one component with a dynamic title.
- **scripting**: Runtime-evaluated content — external task config, HTTP task config, business rule task config, payloads, data sources, custom tokens, example results, custom attributes.
- **documentation**: Element documentation editor using MarkdownEditor.

**Rationale**: Clearer separation of concerns. Users see property fields by default; scripting fields are one tab click away. The consolidated `PropertiesElementInfo` reduced ~30 single-purpose components to one with a lookup table.

---

### 2026-04-07 — Move all BPMN-specific functionality out of git-cruiser into bpmn-diff

**Context**: The git-cruiser module contained BPMN-specific code for history preview (document model, renderer, pane), diff orchestration, commit preview, file history, and branch-per-process. This coupled a generic Git module to BPMN rendering knowledge, making it harder to add support for other file types.

**Decision**: Move all BPMN-aware code out of git-cruiser:
- History preview document type (`bpmn.history-preview`) → `bpmn-diff/history/`
- History change overview pane → `bpmn-diff/panes/HistoryChangeOverview.tsx`
- Process name extraction utilities → `bpmn-core/bpmnProcessUtils.ts`
- BPMN-specific orchestrators (diffFromGit, commitPreview, fileHistory) moved out of the `bpmn/` subfolder to top-level in git-cruiser with updated imports
- git-cruiser exposes new generic Git primitives as commands: `getLog`, `createBranchInRepoOf`, `restoreFileContent`
- bpmn-diff registers wrapper commands (`bpmn.diff.history.restoreFile`, `bpmn.diff.suggestBranchNameForProcess`) that call the generic primitives

**Rationale**: Clean separation of concerns. git-cruiser is now a pure Git module with no BPMN rendering, parsing, or document model knowledge. The `bpmn/` folder in git-cruiser has been completely deleted. Future file type support (e.g., MDX) can follow the same pattern: register a type-specific resolver/preview in the appropriate module, backed by git-cruiser's generic primitives.

---

### 2026-04-07 — Consolidate bpmn-diff views: history preview inherits from diff model

**Context**: The `bpmn-diff` extension maintained two near-identical diff views (`bpmn.diff` and `bpmn.history-preview`) with separate models, panes, and renderers. The history model duplicated ~80% of the diff model's code (dual viewers, diff computation, overlays, sync, selection) and lacked features the diff model had (change navigation, reload tracking, ContentDiff pane, session restore, cross-viewer deselect).

**Decision**:
- Make `BpmnDiffDocumentModel` the base class with all diff infrastructure (`protected` members, extracted `initializeDiffViewers()` helper)
- Rewrite `BpmnHistoryPreviewDocumentModel` as a thin subclass that overrides `initialize()` (fetches XML from git) and adds preview mode, commit metadata, and `getHistoricalXml()`
- Refactor `BpmnDiffDocumentRenderer` from class component to functional component (hooks) for consistency with the history renderer
- Merge `HistoryChangeOverview` into `ChangeOverview` by widening the model-key gate
- Enable `ContentDiff` pane for history preview documents (same gate widening)
- Delete dead code: `ElementDiffAsJson.tsx`, `HistoryChangeOverview.tsx`, history pane styles

**Rationale**: Inheritance eliminates ~200 lines of duplication. The history preview gains change navigation, reload tracking, ContentDiff support, and session restore for free. Both renderers are now functional components with consistent patterns. A single `ChangeOverview` pane serves both document types. The "baggage" in the diff model turned out to be useful features the history model was missing.

---

### 2026-04-07 — Move BPMN Merge Change Overview pane to bpmn-editor

**Context**: The Merge Change Overview pane was registered by the `git-cruiser` extension, but its content was entirely BPMN-specific: classified elements, per-attribute conflict resolution, auto-applied change tracking, definitions metadata. This contradicted the established principle that git-cruiser should be a generic Git module with no BPMN knowledge — the same rationale that drove the earlier extraction of the BPMN merge resolver, history preview rendering, and diff views.

**Decision**:
- Move the BPMN-specific pane to `bpmn-editor/merge/panes/BpmnMergeChangeOverview.tsx`, registered via `initializeBpmnPanes`
- Move the associated styles to `bpmn-editor/merge/styles/component.bpmn-merge.scss`
- The git-cruiser retains a generic fallback pane (`MergeChangeOverview.tsx`) for non-BPMN files, which shows a simple message directing users to the diff editor

**Rationale**: Consistent separation of concerns. All BPMN-specific merge UI (resolver, result modeler, change overview pane, styles) now lives in `bpmn-editor`. The git-cruiser merge subsystem only contains the generic framework (model, renderer, file resolution utilities). Future file-type-specific merge panes (e.g., MDX) can follow the same pattern: register in the appropriate editor module.

---

### 2026-04-02 — Two-pass linting: bpmnlint rules + post-processing analyzer rules

**Context**: The BPMN linter needed two families of rules: (1) element-scoped rules that inspect individual nodes (natural fit for bpmnlint's `check(node, reporter)` API), and (2) process-wide rules that require graph analysis — cycles, sequential chains, nesting depth, control flow complexity — which cannot be expressed as single-node visitors.

**Options considered**:
- A) Implement all rules as bpmnlint rules, performing graph analysis inside each rule independently
- B) Run bpmnlint for element-scoped rules, then a separate post-processing pass using a shared `ProcessModelAnalyzer` for graph-based rules

**Decision**: Option B. `LintEngine.lint()` first runs bpmnlint for standard rules, then calls `runPostProcessingRules()` which instantiates a single `ProcessModelAnalyzer` from the BPMN definitions and passes it to each post-processing rule factory. Findings from both passes are merged and sorted by severity. Post-processing rule IDs are excluded from `buildLinterConfig()` to prevent bpmnlint's resolver from attempting to load them.

**Rationale**: Graph analysis is expensive; sharing a single analyzer with lazy caching avoids redundant traversals. Bpmnlint's resolver mechanism is not designed for rules that need the full definitions object, so a clean separation avoids fighting the library. The `postProcessingRuleFactories` map in `config.ts` mirrors `builtinRuleFactories` / `customRuleFactories`, keeping the registry pattern consistent.

---

### 2026-04-02 — ProcessModelAnalyzer placed at rules/ level, not inside a category folder

**Context**: The `ProcessModelAnalyzer` is used by both Logic Pattern rules (`rules/logic-patterns/`) and PDA Compliance rules (`rules/pda-compliance/`). The original plan placed it in `rules/logic-patterns/`.

**Decision**: Place `ProcessModelAnalyzer.ts` at `rules/ProcessModelAnalyzer.ts` (one level up from both consumer directories).

**Rationale**: The analyzer is a shared utility, not a logic-pattern-specific module. Placing it at the `rules/` level avoids a misleading import path (`../logic-patterns/ProcessModelAnalyzer`) from PDA compliance rules and signals that it serves the entire rule system.

---

### 2026-04-02 — Linter type safety: custom moddle interfaces with index signature

**Context**: The bpmn-linter extension used `any` in ~120 places across 40+ files (moddle elements, bpmnlint contracts, diagram-js services, severity coercion, dialog casts, settings). This was a regression from the recent BPMN type safety overhaul in other extensions.

**Options considered**:
- A) Import full bpmn-moddle types — not available (library ships no `.d.ts`)
- B) Define a "fat" `ModdleNode` interface with every BPMN property as optional — semantically incorrect (a StartEvent shouldn't declare `sourceRef`)
- C) Define a `ModdleNode` base with commonly accessed properties plus `[property: string]: unknown` index signature, with specific subtypes for event definitions and formal expressions

**Decision**: Option C. `ModdleNode` in `types.ts` declares ~15 properties accessed by 3+ rules (e.g. `flowElements`, `incoming`, `outgoing`, `eventDefinitions`, `sourceRef`, `targetRef`) and uses an index signature for the rest. Less common properties are accessed via explicit casts like `node.loopCharacteristics as ModdleNode | undefined`, which is self-documenting about what the rule expects.

**Rationale**: The index signature returns `unknown` (not `any`), forcing explicit narrowing at access sites. Commonly accessed properties are pre-declared to avoid excessive casting. The two remaining `as any` are diagram-js `$inject` metadata assignments — a framework limitation with no typed alternative.

---

### 2026-04-07 — Connect to Remote: `git init` inside existing folder *(superseded by 2026-04-21 entry)*

**Context**: The "Connect Folder to Remote" feature needs to link a local non-git folder to a remote repository.

**Options considered**:
- A) Clone the remote repo to a temp directory, then move files — complex, requires renaming/moving the original folder
- B) `git init` inside the existing folder, `git remote add`, `git fetch`, `git checkout` — minimal file system changes

**Decision**: Option B. The init-in-place approach avoids temporary directories and file moves. File conflicts between local and remote are resolved with a simple "Cancel / Keep / Replace" dialog. On failure, cleanup removes only the `.git/` directory.

**Rationale**: Simpler implementation, no temp directory management, and the folder stays at its original path throughout. The tradeoff is that `git init` + `fetch` is slightly less atomic than clone, but the cleanup logic handles failure cases.

**Superseded**: This approach failed when the target folder contained files also present in the remote branch — `git checkout` refused to overwrite untracked files. See the 2026-04-21 entry for the replacement.

---

### 2026-04-20 — OIDC: Migrate from oidc-client to oidc-client-ts, drop jose

**Context**: The Studio's OIDC authentication relied on the deprecated, unmaintained `oidc-client` (v1.11.5, plain JS) and `jose` (for JWT signature verification before signout). The migration targets `oidc-client-ts` (v3.x, actively maintained TypeScript rewrite by the same community).

**Key decisions**:

1. **Drop implicit flow support** — `oidc-client-ts` only supports `response_type: 'code'` (PKCE). The old code had a fallback to `response_type: 'id_token token'` for legacy authority versions (pre-3.2.0). Since all supported authorities now use the code flow, the `response_type` field was removed from `UserLoginProviderOidcConfig`, the Configure OAuth dialog, and all plumbing. The `authoritySupportsClientWithRefreshToken` version check was removed entirely.

2. **Drop jose** — The `validateToken` method used `jose.jwtVerify` with JWKS to check whether the ID token was still valid before initiating signout. This was a resilience heuristic (not a security measure), since `oidc-client-ts` does not perform JWT signature verification by design (tokens arrive over HTTPS in the code flow). Replaced with a simple `isTokenExpired` check using the `expiresAt` field already stored on `UserLogin`.

3. **Navigators as constructor args** — `oidc-client-ts` moved `popupNavigator` and `iframeNavigator` from `UserManagerSettings` to separate `UserManager` constructor parameters. A `createUserManager` method was introduced on `OidcStrategyBrowser` to centralize this, overridden in `OidcStrategyElectron`.

**Rationale**: Removes two dependencies (`oidc-client`, `jose`), gains TypeScript types, active maintenance, and PKCE enforcement. The implicit flow removal simplifies the authentication code significantly.

---

### 2026-04-20 — Clone/Connect dialogs: multi-step chain replaces single dialog

**Context**: The single-dialog clone flow bundled URL, destination folder, and branch picker into one form. The `select_dynamic` content type loaded branches asynchronously on URL blur. This caused HTTPS repos to freeze (git credential prompt hang), and the UX was cluttered.

**Options considered**:
- A) Add credential fields to the existing single dialog (username + token inline) — keeps the clutter
- B) Split into 3 sequential dialogs with protocol auto-detection — cleaner UX, separate concerns
- C) Enforce SSH-only — limits user flexibility

**Decision**: Option B. Three-step sequential dialog chain:
1. Repository URL with auto-detected protocol
2. HTTPS credentials (skipped for SSH)
3. Branch picker + destination folder

This replaced the `select_dynamic` content type (reverted entirely) and the `maxItems` extension on `path_list` (reverted). A new `path_picker` content type was introduced for single-path selection with clean UX. `GIT_TERMINAL_PROMPT=0` was added to prevent git from hanging on credential prompts.

**Rationale**: The multi-dialog approach cleanly separates concerns, shows only relevant fields per protocol, handles HTTPS credentials gracefully, and eliminates the complex dynamic select state management from the dialog renderer.

---

### 2026-04-21 — Connect to Remote: clone-to-temp replaces init+fetch+checkout

**Context**: The "Connect Folder to Remote" command used `git init` + `git remote add` + `git fetch` + `git checkout <branch>`. This failed when the target folder contained files that also existed in the remote branch — git refused the checkout because untracked files would be overwritten. The workaround (a "Keep/Replace" conflict dialog) could not work correctly: "Replace" would delete the user's local files before checkout, and "Keep" still left originals in the way.

**Options considered**:
- A) Delete overlapping files before checkout — simple but destroys local work, even for "Replace" which semantically means "replace remote with mine"
- B) Clone to temp directory, move `.git` into target folder — local files appear as natural uncommitted changes
- C) Use `git checkout -f` to force — unclear whether it handles untracked files, still loses data

**Decision**: Option B. A single composite IPC handler (`IPC_INVOKE_GIT_CONNECT_TO_REMOTE`) clones the repo to a temp directory, moves `.git` into the target folder, resets the index, and restores only branch files that are missing locally. The conflict dialog was removed entirely.

**Rationale**: The clone-to-temp approach preserves all local files as uncommitted changes, which is the correct Git-native behavior. The user reviews and resolves differences through the Git pane instead of a lossy dialog. This also simplified the command handler significantly — the `listLocalFiles`, `ls-tree` comparison, and conflict dialog logic were all removed.

---

### 2026-05-12 — Remove legacy external extension mechanism

**Context**: The Studio's external extension mechanism loaded user-developed extensions from `~/.evil/studio/extensions/` into the renderer process. Extensions ran in the same JavaScript context as the Studio, with access to the DOM and the full `Bifrost` instance. A "window bridge" (`BootstrapInitializer`) attached React hooks, react-select, react-dnd, and MDX Editor to `window` globals so that the SDK's `getModuleFromStudio()` could relay them to external extension code — avoiding duplicate React instances but creating a fragile, undocumented coupling.

**Options considered**:
- A) Keep the mechanism and incrementally improve it (add isolation, stabilize the bridge)
- B) Remove it entirely and design a proper mechanism from scratch (Extension Host in isolated child process, webview-based UI, declarative manifests)

**Decision**: Option B. The entire external extension loading pipeline was removed:
- `CodeLoaderElectron` (vm.runInNewContext) — deleted
- `CodeLoader.loadUri()` (eval-based loader) — deleted
- `ModuleManager.loadExtensionFromUri()` / `loadExtensionFromObject()` — removed
- `ModuleMediator.requireAllExtensionsInDirectory()` / `requireExtensionInDirectory()` / `loadExtensionFromObject()` — removed
- `BootstrapInitializer` window bridge globals (`__react__`, `__react_dnd__`, `__react_select__`, `__internal_markdownEditor__`) — removed
- `getModuleFromStudio()` SDK helper — deleted; all SDK components now use direct imports
- `codeLoaderConstructor` in `BifrostOptions` — removed
- `getBifrostExtensionsDir()` / `BIFROST_EXTENSIONS_SUBDIRNAME` — removed

Internal (packaged) modules are unaffected — they continue to load via `require()` in the bundle graph.

**Rationale**: No production-ready external extensions exist. The old mechanism was fundamentally broken: extensions shared the renderer's React instance (singleton conflicts), had unrestricted DOM access (crash propagation), and could only use framework features explicitly bridged to `window` (severe capability ceiling). A clean removal establishes a stable baseline for the Extension v2 roadmap, which introduces process isolation via a Node.js Extension Host, framework-agnostic webview UI, declarative contribution manifests, and lazy activation.

---

### 2026-05-13 — Plugin Host: process-isolated plugin infrastructure

**Context**: Phase 1 of the Extension v2 roadmap. External plugins need a way to run in the Studio without direct DOM/Electron access. The legacy mechanism was removed; this is its replacement.

**Decision**: Implement a Plugin Host as a Node.js child process (`child_process.fork()`) with `ELECTRON_RUN_AS_NODE=1` and `target: 'node'` in Rspack. Communication flows through a typed message protocol (PH) relayed by the main process between the host and the renderer.

**Key design choices**:
- **Single host process**: All plugins share one child process for Phase 1. Per-plugin isolation (sandbox + quarantine) is deferred to Phase 4.5.
- **Callback registry**: O(1) global lookup instead of O(n) per-plugin iteration for callback dispatch.
- **Shared types**: Protocol payload interfaces extracted to `contracts/PluginHostTypes.ts` to avoid cross-tsconfig imports.
- **Focused-or-first routing**: API requests route to the focused window or first available. Multi-window routing deferred to Phase 5.
- **OS-specific cache storage**: Plugin data stored in `~/.cache/evil-studio-<channel>/` (Linux), decoupled from plugin installation directory.

**Files**: See `docs/architecture/plugin-host.md` for the complete file map.

**Superseded (routing)**: The focused-or-first routing and main-process relay were replaced by the per-window renderer model. See 2026-05-13 — Plugin Host migration entry below.

---

### 2026-05-13 — Plugin Host: migrate from main process to renderer

**Context**: The Plugin Host was initially managed by the Electron main process, with a `PluginHostRelay` forwarding messages between the child process and the renderer via Electron IPC. This caused three problems: (1) multi-window routing bugs — only the focused or first window received plugin messages, (2) a 3-hop relay for every API call (child → main → renderer → main → child), and (3) startup race conditions where plugins loaded before the renderer was ready.

**Options considered**:
- A) Keep the main-process host and fix multi-window routing with a per-window subscription registry
- B) Move the Plugin Host to the renderer, giving each window its own host instance

**Decision**: Option B. The `PluginHost` class now lives in `electron-renderer/plugin-host/` and is instantiated per-window after `Bifrost` initialization. It forks the child process directly from the renderer (possible because `nodeIntegration: true` / `contextIsolation: false` is already set). The `PluginHostBridge` communicates directly with the child process via `PluginHostConnection` — no Electron IPC involved.

**Key changes**:
- `PluginHostRelay` deleted entirely
- All PH-related IPC constants removed from `IpcEvents.ts`
- Main process `entrypoint-electron-main.ts` no longer references Plugin Host
- Shared protocol files (`PluginHostConnection`, `PluginHostProtocol`) moved to `contracts/`
- Child process files (`plugin-host-main.ts`, `PluginLoader`, `api/*`, `callbackRegistry`) moved to neutral `plugin-host/` directory
- Renderer rspack config gains `node: { __dirname: false }` for correct `fork()` path resolution
- Crash notifications use `bifrost.commands.executeCommand('std.notifications.showError')` instead of `sendToAllWindows()`

**Rationale**: Aligns with VSCode/Cursor's per-window Extension Host model. Eliminates the relay layer and its associated latency, multi-window routing bugs, and main-process complexity. Each window's plugins interact only with that window's `Bifrost` instance. The `nodeIntegration: true` prerequisite was already in place.

---

### 2026-05-13 — Replace Mocha + ts-node with Vitest as the test runner

**Context**: The existing test stack (Mocha 11 + ts-node + choma) broke on Node.js v24 because Mocha's `esm-utils.js` uses `import()` to load `.ts` files, triggering Node's strict ESM resolver. Extension-less TypeScript imports (`../../OsSpecificKeystroke`) failed with `ERR_MODULE_NOT_FOUND`. Attempts to configure `ts-node` ESM mode did not resolve the issue.

**Options considered**:
- A) Fix ESM resolution in Mocha/ts-node (add explicit `.js` extensions to all imports, enable `ts-node` ESM mode)
- B) Switch to Vitest

**Decision**: Option B — replace Mocha with Vitest.

**What changed**:
- `vitest` installed as devDependency; `mocha`, `@types/mocha`, `choma`, `electron-mocha`, `ts-node` removed
- `studio/vitest.config.ts` created with path aliases, `pool: 'forks'`, `sequence: { shuffle: true }`
- `StudioAgent.ts`: `Mocha.Context` replaced with a `TestContext` interface (`testName`, `testFile`, `state`, `error`); `updateMochaContext()` renamed to `updateTestContext()`; `getCurrentTest()` renamed to `getTestContext()`
- All 12 test files migrated: `import 'mocha'` replaced with explicit Vitest imports; `function()` hooks converted to arrow functions; `before`/`after` renamed to `beforeAll`/`afterAll`; `this.timeout()`/`this.slow()` replaced with describe-level `{ timeout }` options; `createAndStartStudioAgent(this)` replaced with `createAndStartStudioAgent({ testName, testFile })`
- `tsconfig.components.json`: `"mocha"` removed from `types`
- `tsconfig.base.json`: `ts-node` block removed
- `package.json` scripts updated to use `vitest run` instead of `mocha -r ts-node/register`; `tsx` added for `test-prod:electron` script

**Rationale**: Vitest uses Vite's bundler-style resolver (esbuild), which resolves TypeScript imports without requiring explicit file extensions or ESM loader configuration. It also provides built-in test shuffling (replacing `choma`), built-in TypeScript transformation (replacing `ts-node`), and a simpler configuration surface. The `pool: 'forks'` setting ensures integration tests that spawn Electron processes run in isolated child processes.

---

### 2026-05-17 — FEEL editor: CodeMirror 6 via `@bpmn-io/feel-editor` instead of Monaco

**Context**: The Studio needs native FEEL (Friendly Enough Expression Language) expression editing for the ThomasTheDaemonEngine integration. FEEL requires syntax highlighting, autocomplete with variable injection, and linting. Monaco Editor has no FEEL grammar, no language worker, and its JS-based IntelliSense mechanism (`addExtraLib` with `.d.ts` declarations) is fundamentally incompatible with FEEL's syntax and type system.

**Options considered**:
- A) Build FEEL support in Monaco (Monarch tokenizer + custom CompletionItemProvider + custom linting)
- B) Use `@kie-tools/feel-input-component` (Monaco-based, from KIE/Drools ecosystem)
- C) Use `@bpmn-io/feel-editor` (CodeMirror 6-based, from bpmn.io ecosystem)

**Decision**: Option C — wrap `@bpmn-io/feel-editor` in new SDK components (`FeelEditor`, `OneLineFeelEditor`) that coexist with the existing Monaco editors.

**What changed**:
- `@bpmn-io/feel-editor` added as SDK peer dependency and studio devDependency
- `@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@lezer/highlight` added as studio devDependencies
- Ambient module declaration in `studio/src/packages.d.ts` and `studio-sdk/packages.d.ts`
- `FeelEditor.tsx` (multi-line) and `OneLineFeelEditor.tsx` (single-line) in `studio-sdk/src/components/`
- `FeelEditorTheme.ts` — CodeMirror theme extension referencing `--theme-feel-*` CSS custom properties
- `component.feel-editor.scss` — light/dark theme tokens in `studio/src/components/feel-editor/`
- `initializeFeelContextCommands.ts` — Bifrost command `bpmn.feel.getExpressionContext` for engine FEEL context variables
- Machine Sanctum playground page (`FeelEditorExamples.tsx`) for testing

**Rationale**: Option A would require building a Monarch grammar, custom CompletionItemProvider, and FEEL-specific linter from scratch — significant effort with inferior results since Monaco has no Lezer-based incremental parser for FEEL. Option B is tightly coupled to the KIE/Drools ecosystem and less actively maintained. Option C provides syntax highlighting, autocomplete, linting, and FEEL built-in function definitions out of the box, is actively maintained (70K+ weekly downloads), and is from the same ecosystem as `bpmn-js`. CodeMirror 6 is tree-shakeable (~150–250 KB gzipped vs Monaco's ~2 MB) and its scoped `.cm-*` class names avoid any CSS conflicts with existing Monaco styles.

---

### 2026-05-19 — FEEL evaluation: `@bpmn-io/feelin` in a Web Worker for Machine Sanctum

**Context**: The Machine Sanctum FEEL playground needed live expression evaluation. FEEL expressions can be pathological (e.g., deeply nested `for` comprehensions), and `@bpmn-io/feelin`'s `evaluate()` is synchronous — running it on the main thread risks freezing the Studio.

**Options considered**:
- A) Run `evaluate()` on the main thread (simple, but UI-blocking on bad input)
- B) Run `evaluate()` in a Web Worker with a hard timeout (isolated, non-blocking)
- C) Use `requestIdleCallback` chunking (complex, incomplete protection against truly pathological expressions)

**Decision**: Option B. `@bpmn-io/feelin` was added as a devDependency. Evaluation is delegated to a dedicated Web Worker (`feel-eval-worker.ts`) managed by a `FeelEvaluator` class. The worker is persistent (reused across evaluations), has a 5 s timeout enforced via `worker.terminate()`, and is lazily recreated after termination. A `serializeValue` function in the worker converts non-cloneable return types (Luxon DateTime/Duration, feelin Range, FunctionWrapper) to JSON-safe primitives before `postMessage`.

**Rationale**: The Web Worker fully isolates the main thread. The 5 s timeout matches the engine's default FEEL evaluation timeout, keeping the playground experience realistic. `worker.terminate()` is safe for feelin since it has no external side effects. The `FeelEvaluator` pattern (persistent instance + lazy recreation) avoids per-evaluation spawn overhead while recovering cleanly from timeouts.

---

### 2026-05-18 — Plugin architecture: PluginService as sole public API, PluginHost hidden

**Context**: After implementing selective plugin reload (Batch 3.7) and fixing a rendering bug where disabling a plugin did not visually update the Plugins Pane, the plugin subsystem's internal wiring had accumulated cross-references and unclear ownership boundaries. `PluginHost` (the Electron renderer-side class managing the child process) was partially exposed through `bifrost.plugins`, while `PluginService` (originally in `extensions/plugins/`) contained business logic that mixed UI concerns with plugin lifecycle management.

**Decision**: Streamline the architecture:
1. `PluginService` is moved from `extensions/plugins/PluginService.ts` to `bifrost/common/plugin-host/PluginService.ts` and becomes the sole public API at `bifrost.plugins` (type `PluginService`).
2. `PluginHost` is hidden behind `PluginService` — no extension or UI component interacts with it directly.
3. Both classes extend `AbstractEmitter` using a two-tier event pattern: `PluginHost` emits `EVENT_PLUGIN_LIST_CHANGED` on list mutations → `PluginService` subscribes, syncs its cached list, and re-emits → UI consumers re-render.
4. All public methods (`togglePlugin`, `uninstallPlugin`, `refreshFromHost`, `getPluginList`) live on `PluginService`, which delegates to `PluginHost` internally.

**What changed**:
- `PluginService.ts` moved to `studio/src/bifrost/common/plugin-host/`
- `PluginHost` and `NullPluginHost` both extend `AbstractEmitter`
- `Bifrost.ts`: `plugins` property type changed from `IPluginHost` to `PluginService`
- `PluginCard.tsx`: Visual disabled state now checks `!plugin.enabled` instead of `plugin.status === 'disabled'` (bug fix — at runtime, disabled plugins have `status: 'not-loaded'`, not `'disabled'`)
- All subscribers migrated from `bifrost.plugins.onChange(...)` to `bifrost.plugins.on(EVENT_PLUGIN_LIST_CHANGED, ...)`

**Rationale**: The `SettingsMediator` pattern (internal implementation hidden behind a public `AbstractEmitter` facade) is well-established in the codebase and proven stable. Applying it to the plugin subsystem eliminates cross-references between `extensions/plugins/` and `bifrost/`, gives the service a clear home in the framework layer, and provides a clean event subscription mechanism for any future consumer without flooding the global event channel.

---

### 2026-05-19 — Phase 3 webview: `<iframe>` + custom protocol instead of Electron `<webview>`

**Context**: The Extension v2 roadmap originally planned to use Electron's `<webview>` tag with a preload script for plugin UI sandboxing. During implementation, this approach was revisited.

**Decision**: Use standard `<iframe>` elements served by a custom `evil-webview://` Electron protocol instead of Electron's `<webview>` tag.

**What changed**:
- A custom protocol `evil-webview://` (channel-aware: `evil-webview-<channel>`) registered in `entrypoint-electron-main.ts` serves plugin files from disk with per-plugin origin isolation
- `PluginIframe.tsx` renders sandboxed `<iframe sandbox="allow-scripts allow-same-origin">`
- `bridge-script.ts` runs in the iframe's main world (standard JS, not an Electron preload script) and exposes `acquireStudioApi()`
- Communication uses standard `postMessage` (not Electron IPC channels)
- The bridge script is compiled with `target: 'web'` as a separate Rspack entry

**Rationale**: Electron's `<webview>` tag is deprecated in favor of `BrowserView` / `WebContentsView`, and Electron documentation explicitly recommends against it. VS Code migrated from `<webview>` to iframes during 2020–2023 for the same reason. Standard `<iframe>` + custom protocol provides: (a) per-plugin origin isolation via URL hostnames, (b) CSP enforcement through response headers, (c) no dependency on deprecated Electron APIs, (d) simpler build (no Electron-specific preload target), (e) alignment with web platform standards.

---

### 2026-05-19 — Phase 3 webview: `X-Frame-Options` intentionally omitted

**Context**: During security review of Batch 3.1, the initial implementation included an `X-Frame-Options: SAMEORIGIN` response header on webview protocol responses. This blocked iframe loading because the parent (Studio renderer at `evil-studio://`) and child (plugin content at `evil-webview://<plugin>`) are different origins by design.

**Decision**: Remove `X-Frame-Options` from webview security headers entirely. Rely on CSP and the Electron desktop context for frame embedding security.

**Rationale**: `X-Frame-Options` protects against clickjacking — an attack where an external website embeds *your* page in a transparent iframe. This threat does not apply to Bifrost Forge World: the host page is a desktop application (not a web page that can be embedded by an attacker), and the iframes contain plugin content (not sensitive Studio content). The cross-origin boundary between host and iframe already prevents the iframe from accessing the parent DOM. Adding `X-Frame-Options` would only break legitimate embedding.

---

### 2026-05-20 — Phase 3 webview: per-plugin origin via protocol hostname

**Context**: Plugin iframes need isolation from each other and from the Studio renderer. The security model must prevent one plugin from reading another plugin's DOM, storage, or intercepting its messages.

**Decision**: Each plugin gets a unique origin by encoding the plugin name as the URL hostname: `evil-webview://<pluginName>/`. Same-origin policy enforces isolation automatically.

**What this prevents**: cross-plugin localStorage/IndexedDB access, cross-plugin `document.cookie` sharing, `window.parent.document` access (cross-origin), cross-plugin message spoofing (host validates `event.origin`).

**Known limitation**: Scoped npm package names (e.g., `@scope/name`) cannot be used as hostnames because URL hostname cannot contain `/`. Plugins must use un-scoped directory names. This is acceptable because the protocol resolves against the plugin's install directory name, not the npm package scope.

> **Superseded (Phase 7):** The `pluginNameToHostname` / `hostnameToPluginName` mapping in `entrypoint-electron-main.ts` now handles scoped npm names by mapping `@scope/name` to `scope--name`, making them valid hostnames.

---

### 2026-05-25 — Linter must not auto-run on foreign BPMN diagrams

**Context**: The Studio's BPMN linter is built around the DaemonEngine's `evil:` extension vocabulary. When a diagram from another platform (Camunda, Zeebe, Flowable, plain BPMN 2.0, etc.) is opened, the linter produces false positives against engine-specific rules and — critically — **mutates the foreign diagram** by injecting `evil:Properties` (linter score) elements into the XML. For DaemonEngine diagrams specifically, a namespace URI collision on the `evil:` prefix causes a hard serialization error (`ns0` prefix failure in moddle-xml), but even for other platforms where the prefix doesn't collide, the XML mutation is semantically wrong.

**Options considered**:
- A) Detect diagram origin via namespace declarations; skip auto-linting on foreign diagrams; offer an explicit opt-in with a confirmation dialog and a "remember my choice" setting
- B) A + C: Same as A, but also run a reduced "generic BPMN" ruleset on foreign diagrams (display-only, no XML mutation)
- C) Always lint, suppress score persistence on foreign diagrams

**Decision**: Option A — origin detection + opt-in gate. No "generic BPMN" ruleset.

**Rationale**: Drawing the line between "generic" and "engine-specific" rules requires too many assumptions about what the end user actually needs. A "generic" subset would inevitably be either too noisy (flagging things valid on the source platform) or too lenient (missing things the user cares about). The better long-term path is plugin-registered linter rulesets, where a plugin developer can tailor rules exactly to their platform. The opt-in gate with a confirmation dialog respects the user's agency — they can consciously choose to lint a foreign diagram if they want to — while the "remember my choice" setting avoids repeated friction for users who always want linting. See Phase H in the engine-compatibility plan.

---

### 2026-05-31 — Phase 4: Manifest section key `bifrostStudio`

**Context**: Phase 4 introduces a declarative manifest section in `package.json` for plugins. The key needs to be distinctive and unlikely to collide with other tools.

**Options considered**:
- A) `"bifrostStudio"` — explicit, matches project naming, unlikely to collide
- B) `"studio"` — shorter but generic, potential collisions
- C) `"bifrost"` — could collide with other Bifrost-branded tools

**Decision**: Option A — `"bifrostStudio"`.

**Rationale**: Explicit affiliation with the project. Already documented in the roadmap. No collision risk.

---

### 2026-05-31 — Phase 4: Activation event naming — `onDocumentType` instead of `onLanguage`

**Context**: The roadmap originally listed `onLanguage:<languageId>` as an activation event. The Studio has no Monaco-style language server architecture — it has editor document types (bpmn, dmn, json, markdown).

**Decision**: `onDocumentType:<typeId>` — truthful to the architecture, avoids confusing plugin developers about capabilities that don't exist.

---

### 2026-05-31 — Phase 4: Manifest errors block plugin loading

**Context**: The original design treated manifest errors as non-fatal warnings where the manifest could be "partially valid." This risked loading plugins in a broken state.

**Decision**: Manifest errors prevent plugin loading entirely. The plugin is shown in the Plugins pane as failed with error details, but its code is never executed. Warnings are non-fatal — cosmetic issues, deprecated fields, and recommendations that allow normal loading.

**Rationale**: A partially loaded plugin with structural manifest errors would deliver a broken experience. Failing fast with clear error messages is more developer-friendly than silently broken features.

---

### 2026-05-31 — Phase 4: Pane contribution — hybrid approach

**Context**: Pane contributions need both declarative metadata (title, icon, area, visibility) and runtime initialization (webview iframe setup, message handlers).

**Decision**: Manifest declares lightweight pane metadata; the actual webview is initialized imperatively in `activate()`. A placeholder pane shows until activation. This avoids race conditions between iframe mounting and `onMessage` handler registration.

---

### 2026-05-31 — Phase 4: Keybinding `when` condition vocabulary

**Context**: Keybindings need context conditions (global, editor-focused, specific editor type). The internal mechanism uses CSS focus selectors, but exposing those to plugin authors couples the API to DOM structure.

**Decision**: High-level `when` vocabulary (`*`, `editorFocused`, `editorFocused:<documentType>`) that the `ContributionRegistrar` maps to internal CSS selectors. Typed as `KeybindingWhenCondition` union type for developer tooling. Unknown values produce validation errors.

---

### 2026-06-01 — Phase 5: Dropping `--plugin-development-dir`

**Context**: The original Phase 5 plan included a `--plugin-development-dir` CLI flag for loading a single development plugin, auto-reload via chokidar file watching, and marking dev plugins with `isDev: true`. This was modeled on the old ProcessCube Studio's `extension-development-dir` flag.

**Decision**: Drop the flag entirely. The existing `BFR_PLUGINS_DIR` environment variable override and per-plugin enable/disable (`plugins.disabledPlugins` setting) provide equivalent flexibility. The old flag was never used in practice and only existed to work around limitations of the legacy extension system that the new Plugin Host doesn't share. Auto-reload and the `DevPluginWatcher` can be revisited in a later phase if demand warrants it. Manual reload via `reloadPlugin()` is sufficient for v1.

---

### 2026-06-01 — Phase 5: SDK type-only interfaces (not shared source)

**Context**: Plugin developers need TypeScript autocompletion for the `StudioPluginApi` surface, manifest fields, and webview bridge. Two approaches: (A) share the actual runtime classes from `studio/src/`, or (B) create type-only interfaces in the SDK that mirror the runtime signatures.

**Decision**: Option B — type-only interfaces in `studio-sdk/src/plugin-api/`. The runtime classes import internal infrastructure (`PluginHostConnection`, `callbackRegistry`, protocol constants) that must not leak into the SDK. The SDK interfaces are hand-maintained snapshots of the public API surface. They are the developer-facing contract; the runtime classes remain the source of truth.

**Trade-off**: Manual synchronization is required when the runtime API changes. This is acceptable because the API surface is small and changes infrequently. The full SDK audit (Phase 10) may introduce automated drift detection.

---

### 2026-06-01 — Phase 5: Plugin Host Console pane

**Context**: Plugin Host `stdout`/`stderr` is captured by `PluginHostLogger` (10k-line ring buffer) but not surfaced in any UI. Plugin developers have no way to see `console.log()` output from their plugin code without opening external terminals.

**Decision**: Add a dedicated "Plugin Host Console" pane in the bottom area (`console` group). Expose logger access through new `PluginService` methods (`getPluginHostLog()`, `onPluginHostLog()`, `clearPluginHostLog()`). The pane auto-scrolls, supports text filtering, and highlights stderr lines. Toggled via the `plugins.showConsole` command.

---

### 2026-06-01 — Remove native modules (Batch 6.10) from v1 roadmap

**Context**: Batch 6.10 proposed `contributes.nativeModules` — plugins could declare main-process JavaScript modules with full Node.js and system-level access. Use cases included file watchers, native integrations, system tray items, and custom protocol handlers.

**Options considered**:
- A) Ship native modules with a permission prompt and marketplace flagging
- B) Remove from v1 entirely, revisit when comprehensive sandboxing is available

**Decision**: Option B — removed from the v1 roadmap entirely.

**Rationale**: Native modules running in the Electron main process have unrestricted access to the filesystem, network, child processes, and Electron APIs. A malicious or buggy native module could crash the entire application, corrupt user data, or exfiltrate sensitive information. The permission prompt ("approve native access") provides only a rubber-stamp barrier — most users would approve without understanding the implications. Proper mitigation requires a sandbox (WASM, VM2, or dedicated child process with capability restrictions) that does not exist yet. The feature can be revisited in a future version once the sandboxing infrastructure (Phase 7) is mature.

---

### 2026-06-01 — Phase 6 Round 1: "Mirror the Mediator" principle for plugin APIs

**Context**: Phase 6 introduces plugin-facing APIs for Status Bar, MenuBar, and Menus. The API design needed a principle to guide naming, parameter shapes, and scope.

**Decision**: All plugin APIs mirror the corresponding internal Mediator class (e.g., `StatusBarMediator`, `MenuBarMediator`, `MenuMediator`). Same method names, same concepts, same data structures — but closures/factory functions are replaced with serializable POJOs/declarative configs for IPC transport. Methods that control visibility (`show`, `hide`, `toggleVisibility`, `updateMenuBarItems`) are not exposed to plugins, as these are Studio-internal layout concerns.

**Rationale**: Developers who understand the internal API can immediately use the plugin API. Diagnosing issues is easier when the plugin and internal surfaces use identical terminology. The POJO-over-closures pattern is mandated by the child-process IPC boundary.

---

### 2026-06-01 — Phase 6 Round 1: save delegate approach for dirty state in model-less editors

**Context**: Plugin webview editors register document types with `modelKey: null` (no `EditorDocumentModel`). The existing save flow (`doSaveEditorDocument`) requires a model to invoke `saveEditorDocument()` and lifecycle hooks. Without a model, Ctrl+S and the close-save dialog do nothing for dirty plugin documents.

**Options considered**:
- A) Require plugins to provide a minimal `EditorDocumentModel` subclass
- B) Add a parallel "save delegate" registry on `EditorMediator` keyed by URI

**Decision**: Option B. `EditorMediator.registerSaveDelegate(uri, callback)` stores an async callback. `doSaveEditorDocument` checks for a delegate when no model exists. The close-save dialog path (`closeEditorDocument`) also checks delegates for model-less documents with `hasUnsavedChanges`. The delegate is unregistered when the plugin is disabled (via the bridge's disposer tracking).

**Rationale**: Option A would force plugin developers to implement a framework-internal class with lifecycle hooks they don't need, just to get save support. The delegate approach is simpler, aligns with the IPC callback pattern already used for `onDidOpen`, and keeps plugin code lightweight.

---

### 2026-06-01 — Phase 6 Round 1: cross-window plugin state sync via IPC relay

**Context**: Each Studio window forks its own Plugin Host child process. When a plugin is installed, uninstalled, enabled, or disabled in one window, other windows do not reflect the change until manually refreshed.

**Decision**: Add `IPC_MESSAGE_PLUGIN_STATE_CHANGED` channel. After every plugin state mutation, `PluginService` sends the event to the main process. The main process relays it to all other windows (excluding the sender). Receiving windows debounce (500ms) and trigger `PluginHost.refresh()` to re-discover plugins from disk.

**Rationale**: The existing `IPC_MESSAGE_RELOAD_SETTINGS` already syncs the `plugins.disabledPlugins` setting value across windows, but the Plugin Host in other windows doesn't react to that setting change. The explicit state change channel triggers a full resync, which picks up both setting changes and filesystem changes (install/uninstall). The 500ms debounce prevents rapid-fire reloads during batch operations.

---

### 2026-06-01 — Phase 6 Round 2: Drop Monaco decoration API (Batch 6.3 pivot)

**Context**: Batch 6.3 originally proposed a Monaco-only editor decoration API (`api.editors.setDecorations`). This would require new infrastructure: Monaco instance tracking, decoration registry, CSS class management.

**Decision**: Drop the Monaco decoration API. Replace Batch 6.3 with Plugin Theme Contributions — plugins can declare CSS custom property overrides and theme names in their manifest.

**Rationale**: Monaco editors are being phased out in favor of CodeMirror. Building decoration infrastructure tied to Monaco is wasteful. Theme contributions are broadly useful, apply to all UI surfaces (not just editors), and align with the existing theme token system.

---

### 2026-06-01 — Phase 6 Round 2: Drop standalone webview panels (Batch 6.9)

**Context**: Batch 6.9 proposed completing the `api.webviews.createPanel()` stub to allow plugins to create on-demand webview panels outside the editor document and pane systems.

**Decision**: Drop standalone panels from v1. The `createPanel` stub remains for forward compatibility.

**Rationale**: Plugins can already register panes (left/right/bottom areas, with `shouldBeDisplayed` control) and webview-backed editor document types (tabs in the editor area). These two surfaces cover all practical use cases. Adding a third surface type requires workbench layout changes and adds conceptual complexity without clear value beyond what panes and editor documents already provide.

---

### 2026-06-01 — Phase 6 Round 2: Plugin theme contributions — CSS token restriction

**Context**: Plugin theme contributions need a security model that prevents CSS injection while giving plugins visual control.

**Decision**: Themes are declared in the manifest as key-value maps of CSS custom properties (`--theme-*` tokens). Only CSS custom property overrides are allowed — no selectors, no `@import`, no `url()`, no arbitrary CSS. The `ContributionRegistrar` validates token keys and values at registration time.

**Rationale**: CSS custom properties are inherently sandboxed — they can only affect elements that reference them via `var()`. The existing theme system already uses this token pattern. Restricting to tokens eliminates CSS injection risks while giving plugins full visual control over the Studio's appearance.

---

### 2026-06-01 — Phase 6 Round 2: Scoped file system API despite existing Node.js `fs` access

**Context**: The Plugin Host child process runs with `ELECTRON_RUN_AS_NODE=1`, giving plugins unrestricted Node.js `require('fs')` access to the entire filesystem. The `api.workspace` API scopes file access to solution project folders and the plugin's storage directory, but cannot enforce this boundary since plugins can bypass it with raw `fs`.

**Options considered**:
- A) Drop the file system API entirely — plugins use `require('fs')` directly
- B) Minimal helpers only — just `getProjectFolders()` and `onDidChangeSolution()`
- C) Full scoped API — establish the "official way" to do file I/O despite the lack of enforcement

**Decision**: Option C. Ship the full scoped `api.workspace` API.

**Rationale**: The API establishes the documented, supported contract for file access. When Phase 7 (per-plugin sandboxing) restricts raw `fs` access in the child process, plugins that already use `api.workspace` will continue working without modification. Plugins that bypassed the API with raw `fs` will break. The API is also a convenience layer that handles URI-to-path conversion, file watching coalescing, and integration with the solution system. The scoping checks serve as runtime validation (error early if the plugin tries to access the wrong directory) even without hard enforcement.

---

### 2026-06-02 — Phase 6 Round 2: Tree view API — push-only data model

**Context**: Plugins need to register custom tree views. The data provider runs in the child process, but the SDK `Tree` component runs in the renderer.

**Options considered**:
- A) Pull-based: renderer calls plugin for data on expand (requires async IPC per expand)
- B) Push-only: plugin pushes full `PluginTreeItem[]` hierarchy, bridge stores and renders

**Decision**: Option B. Push-only for v1.

**Rationale**: Push-only avoids the sync/async impedance mismatch of pull-based expansion. Most plugin tree views (dependency lists, analysis results, small file trees) have manageable sizes. On-demand expansion can be added as a follow-up batch if a plugin needs to render very large trees.

---

### 2026-06-02 — Phase 6 Round 2: Theme runtime API alongside manifest themes

**Context**: Plugin themes can be declared in the manifest (`contributes.themes`) or registered at runtime via `api.themes.register()`.

**Decision**: Support both paths. Manifest themes are processed by `ContributionRegistrar` at discovery time. Runtime API themes are registered in `activate()`.

**Rationale**: Manifest themes are ideal for small themes with few token overrides — they don't clutter the manifest. Runtime registration is better for themes with many tokens (50+) that would drown out other manifest contributions. Dynamic themes that compute tokens based on settings or platform also require the runtime path. Both paths funnel into the same internal `ThemeManager.registerTheme()` + CSS injection mechanism.

---

### 2026-06-02 — Phase 6 Round 2: Theme CSS injection via `<style>` elements

**Context**: The existing theme system uses SCSS rules scoped to `.bifrost.bifrost-theme--<id>` CSS classes. Plugin themes cannot use SCSS (they're runtime contributions).

**Decision**: Inject a `<style>` element into `document.head` with CSS custom property overrides scoped to `.bifrost.bifrost-theme--<themeId>`. The existing class-swap mechanism (`ThemeMediator.applyTheme`) works seamlessly.

**Rationale**: This approach requires zero changes to the existing theme infrastructure. When the theme is deactivated, the CSS rules simply don't match (the class is removed). On cleanup, the `<style>` element is removed from the DOM. Type-aware fallback ensures smooth UX when plugin themes are removed while active.

---

### 2026-06-03 — DMN Phase 6: SDK type declarations mirror BPMN pattern

**Context**: Plugin authors need typed access to `DmnDocumentModel` and DMN element types, just as they have for `BpmnDocumentModel`. Without SDK types, external code working with DMN documents has no type safety.

**Options considered**:
- A) Export implementation types directly from `studio/src/modules/dmn-editor/`
- B) Create `declare class` type declarations in `studio-sdk/types/dmn/`, mirroring the BPMN pattern

**Decision**: Option B.

**Rationale**: The BPMN SDK pattern (`studio-sdk/types/bpmn/`) is well-established and keeps the public API surface separate from implementation details. `declare class` declarations expose only the public methods without leaking internal wiring (adapter constructors, event subscriptions, command handler internals). Plugin authors import from `@evil/bifrost_fw_sdk` with full type checking.

---

### 2026-06-03 — DMN Phase 6: Search indexer uses DmnModdle in web worker

**Context**: Global search needs to index `.dmn` files. The BPMN pattern runs a web worker with `BpmnModdle` to parse XML off the main thread.

**Options considered**:
- A) Parse DMN XML on the main thread during indexing
- B) Use a web worker with `DmnModdle`, matching the BPMN pattern

**Decision**: Option B.

**Rationale**: DMN files with large decision tables or many rules can be substantial. Parsing on the main thread would block the UI. The web worker pattern keeps indexing non-blocking while reusing the same `AbstractWorkerClient` RPC infrastructure.

---

## 2026-06-04: Worker Threads + SES Compartments for Plugin Sandboxing (Phase 7)

**Context**: Plugins run as external code in the Studio. Without sandboxing, a malicious or buggy plugin can access the filesystem, network, environment variables, and all Bifrost commands without restriction.

**Options considered**:
- A) Separate OS process per plugin (like VS Code's remote SSH model)
- B) Worker Threads + SES Compartments (JavaScript-level isolation)
- C) WebAssembly sandboxing

**Decision**: Option B — Worker Threads + SES Compartments.

**Rationale**:
- Worker Threads provide memory isolation at ~2-5 MB per plugin (vs ~30+ MB per full Node.js process)
- SES `lockdown()` freezes intrinsics, preventing prototype pollution across plugins
- SES `Compartment` provides controlled `globalThis` (no `eval`, no `Function()`, no `SharedArrayBuffer`)
- `ModuleGate` replaces `require()` with permission-aware loading
- The `SandboxManager` stamps `pluginName` on every IPC message for caller attestation
- Native addon access is permission-gated with a "Critical" warning

**Trade-offs**:
- `eval()` and `new Function()` are blocked (intentional)
- Dynamic `import()` is not supported (no `importHook`)
- Packages that mutate intrinsics are incompatible
- Native addons with `native` permission bypass SES entirely

---

## 2026-06-04: Total Network Blackout for Plugins in v1

**Context**: Plugin code should not be able to make arbitrary network requests.

**Options considered**:
- A) Allow network with URL allowlisting
- B) Proxy all network through a Studio-controlled API
- C) Block all network access

**Decision**: Option C — total network blackout.

**Rationale**: Maximum security posture for v1. Supply chain attacks frequently involve data exfiltration via network. By blocking all network access (no `fetch`, `http`, `https`, `net`, `WebSocket`, `XMLHttpRequest`), we eliminate an entire class of attacks. Plugins that need external data must coordinate with the user through existing APIs (e.g., opening a browser URL). A controlled proxy API can be introduced as a feature request in a future phase.

---

## 2026-06-04: Transparent Command ID Prefixing for Plugins (Phase 7)

**Context**: The `CommandDenylist` denies unknown command groups by default. Plugin commands need to be in the `plugin.<name>.*` namespace to be allowed.

**Options considered**:
- A) Transparent prefixing — bridge auto-prepends `plugin.<name>.` to all plugin-registered command IDs
- B) Registry-based exemption — allow any command registered by any plugin
- C) Hybrid — enforce convention for new plugins, exempt legacy fixtures

**Decision**: Option A — transparent prefixing.

**Rationale**: Cleanest long-term design. Aligns with VS Code's extension command namespacing. Plugins use short IDs internally (`greet`); the public ID is `plugin.happy-plugin.greet`. The bridge automatically resolves both registration and execution. The one-time cost of updating fixture plugins is acceptable.

## 2026-06-04: Permission trust records in local storage, dialog on all activation paths

**Context**: The permission review dialog (`PluginPermissionDialog`) only fired during eager startup activation. Lazy-activated plugins, re-enabled plugins, and reloaded plugins all bypassed the dialog entirely. There was no "Trust permanently" mechanism, and no detection of permission changes between plugin versions.

**Options considered**:
- A) Expand the existing `plugins.permissions.trustedPlugins` setting with a richer schema storing approved permissions per plugin
- B) Move trust records to `window.localStorage` via `bifrost.getLocalStorage()` to separate security-relevant state from user-editable settings

**Decision**: Option B — `PluginPermissionStore` backed by `bifrost.getLocalStorage('PluginPermissions')` (app scope). The `plugins.permissions.trustedPlugins` setting is removed.

**Rationale**: Settings are designed to be user-editable in the Settings UI. Storing security-relevant trust records there means a user (or a plugin with `commands.std` access) could silently approve elevated permissions for any plugin. Local storage is not bulletproof, but it is not exposed through any plugin API or settings UI, providing a meaningful barrier for v1. The dialog now fires on all four activation paths (eager, lazy, reload, quarantine recovery). Zero-permission plugins skip silently. The "Trust permanently" checkbox persists a `{ permissions, trusted }` record; on re-enable the stored permissions are compared against the manifest — any change triggers a re-prompt showing added/removed permissions.

## 2026-06-04: Early normalization of scoped npm plugin names

**Context**: Scoped npm names (`@scope/name`) contain `@` and `/`, which are rejected by `CommandManager`'s validation regex and are illegal in URL hostnames. Every identifier construction site (`plugin.${pluginName}.${id}`) for commands, panes, themes, settings namespaces, icons, etc. would fail for scoped plugins. The existing `pluginNameToHostname()` helper in `ScopedPluginName.ts` was only used for webview iframe origins.

**Options considered**:
- A) Centralized sanitization — apply `pluginNameToHostname()` at each of the ~30 identifier construction call sites
- B) Early normalization — flatten the scoped name once during plugin discovery so that `plugin.name` is always identifier-safe; preserve the original in a new `packageName` field

**Decision**: Option B — normalize in `discoverSinglePlugin()`, store the original in `PluginInfo.packageName`.

**Rationale**: Normalizing at discovery means every downstream consumer automatically receives a safe name with zero code changes. The `packageName` field preserves the original npm identity for display in the UI (plugin info pane, readme view). Option A would require touching ~30 sites with high risk of missing one. The `displayName` field (set from `pkg.displayName ?? rawName`) already shows the human-readable name in the plugin card.

## 2026-06-05: Sequential `onStartup` activation with shared promise

**Context**: `onStartup` plugin activations in `discoverAndLoadPlugins` were fire-and-forget (not awaited). This caused three interrelated bugs: (1) multiple permission dialogs competing simultaneously, (2) plugin status permanently stuck at "Pending activation" because `updatePluginStatus('loaded')` never ran before the method returned, and (3) `ContributionRegistrar` stub callbacks returning early with "command was not registered" warnings because `activatePlugin()` returned immediately when state was `'activating'`.

**Options considered**:
- A) Parallel activation with a dialog queue — all activations start simultaneously, but a queue serializes permission dialogs
- B) Sequential activation — await each `onStartup` plugin one at a time

**Decision**: Option B — sequential activation deferred until the Bifrost `ready` event (guaranteeing the UI is rendered and the DOM is available for dialogs). `activatePluginsSequentially()` awaits each plugin one at a time. `ActivationManager` stores the activation promise in a `pendingActivations` map so concurrent callers (e.g. stub callbacks) join the existing promise instead of returning early.

**Rationale**: Option A adds complexity (dialog queue) without meaningful startup time improvement — each activation involves a permission dialog that requires user interaction anyway. Deferring to `ready` + sequential activation is simpler, avoids init-chain deadlocks, ensures permission dialogs are shown one at a time, and guarantees that each plugin's sandbox is fully loaded (commands registered, stubs replaced) before the next starts. The shared `pendingActivations` promise lets stub callbacks wait for an in-flight activation to complete.

## 2026-06-05: Sandbox–Bridge API alignment — callerName from payload, not args

**Context**: The `PluginHostBridge` handler methods (`handleStatusBarApi`, `handlePanesApi`, `handleMenuBarApi`, `handleMenusApi`, `handleEditorsApi`, `handleDialogsApi`, `handleDiagnosticsApi`, `handleViewsApi`) destructured `pluginName` from `args[0]`, a pattern inherited from the old in-process plugin API which explicitly prepended it. The sandbox worker sends only the plugin's actual arguments — it never prepends `pluginName` because the SandboxManager stamps a trusted `pluginName` onto the IPC payload separately. This args-offset mismatch corrupted every argument in every affected handler, causing silent failures across the entire plugin API surface. The same mismatch existed in `registerCallback` handlers for `editors.onDidOpen`, `workspace.onDidChangeFile`, `events.on`, etc.

Additionally, `{ ...createNamespaceProxy('editors') }` produced `{}` because JavaScript's spread operator iterates `ownKeys` of the Proxy target (empty `{}`), so all Proxy-based methods vanished and only the explicitly defined callback methods survived. This meant `api.editors.registerWebviewDocumentType` was `undefined`.

**Decision**: (1) All bridge handler methods now receive `callerName` as a separate parameter from `executeApiRequest()` and use it directly instead of extracting from args. (2) Namespaces that need both explicit callback methods and arbitrary Proxy-based API methods (`editors`, `workspace`, `diagnostics`, `statusBar`) are constructed as `new Proxy(explicitMethods, { get: fallthrough })` instead of spreading a Proxy. (3) The notifications namespace gains `open`/`close`/`update`/`onResponse` methods matching the real API. (4) `PH_REGISTER_CALLBACK` in `PluginHost.handleHostMessage` is wrapped in try/catch to always send an ack. (5) `ActivationManager` calls `PluginHost.cleanupPluginResources()` on activation failure to tear down partially registered commands.

**Rationale**: The sandbox model fundamentally changes who is responsible for identifying the caller: in the sandbox architecture, the SandboxManager provides trusted attestation via `payload.pluginName`. Relying on plugins to self-identify through args was both unnecessary and insecure. Aligning all 10+ handler methods to use the attested identity eliminates an entire class of argument-shifting bugs.

## 2026-06-05: Sandbox API completeness — Proxy-wrap `settings`, canonical disposer type, callback fallback

**Context**: An architectural review of the full Plugin Bridge revealed several gaps that would cause runtime errors for real plugins:
1. The `settings` namespace in `sandbox-worker.ts` was a plain object with only 5 methods, while the bridge handles 11 methods (`has`, `getSchema`, `getSchemas`, `getDefault`, `getDefaults`, `add`, `removeValue` were missing).
2. `createCallbackApi.register()` returned a plain function `() => void`, but plugins and the codebase's `AbstractSubscription` convention expect `{ dispose: () => void }`. Calling `.dispose()` on a function threw `TypeError`.
3. `notifications.show` was exposed in the sandbox API but had no bridge handler (dead code that threw on use).
4. `notifications.showWithActions` callback registrations were silently dropped by the bridge — no matching handler branch.
5. `registerCallback` in the bridge used a chain of `if` statements with no fallback; unrecognised registrations silently succeeded.

**Decision**: (1) Wrap `settings` in a Proxy (same pattern as `editors`, `workspace`, etc.). (2) Change `createCallbackApi.register()` return type to `{ dispose() {...} }`. (3) Remove dead `notifications.show` method. (4) Add `notifications.showWithActions` handler in bridge's `registerCallback`. (5) Convert `registerCallback`'s `if` chain to early-return branches with a `console.warn` fallback.

**Rationale**: These fixes close the remaining API surface gaps between what plugins can call in the sandbox and what the bridge actually handles. The Proxy pattern is now consistently applied to all namespaces that need a fallthrough to `sendApiRequest`, and the disposer return type matches the canonical codebase convention.

## 2026-06-05: Sandbox robustness — timeout increase, function guards, Proxy hardening

**Context**: Despite the bridge API being functionally complete (all 14 namespaces and 80+ methods covered), two fixture plugins still failed to load:
1. `webview-showcase` crashed with `DataCloneError: <function> could not be cloned` — the TypeScript source had been updated to use separate `onDidOpen` callback registration, but the compiled `dist/index.js` still contained the old code passing the callback inline in the options object.
2. `kitchen-sink` timed out — its `activate()` makes 83 sequential `await` IPC calls, each a full round-trip through Worker → SandboxManager → Renderer → SandboxManager → Worker. With SES `lockdown()` overhead, this exceeded the 10-second default timeout.

**Decision**: (1) Increase `DEFAULT_STARTUP_TIMEOUT_MS` from 10s to 30s. (2) Add `assertNoFunctions()` guard in `sendApiRequest` and `sendRegisterCallback` that throws a clear error if function-typed values are found in the args array (defense-in-depth against structured clone failures). (3) Replace all `if (method in target)` checks in Proxy `get` traps with `typeof target[method] === 'function'` — more robust against potential SES membrane interference with the `in` operator. (4) Recompile `webview-showcase` TypeScript fixture from updated source.

**Rationale**: The 10s timeout was insufficient for plugins with large API surfaces. The function guard catches serialization errors early with actionable messages instead of cryptic `DataCloneError`. The Proxy hardening is a defense-in-depth measure given that all sandbox API access crosses an SES `Compartment` boundary.

## 2026-06-05: Plugin IPC — critical wiring fixes and robustness hardening

**Context**: A full architectural audit of the Plugin Host IPC mechanism identified two critical bugs that rendered the plugin system fundamentally non-functional, plus multiple medium/low severity issues affecting robustness and security.

**Decision**:
1. **[CRITICAL] Callback results never reached renderer**: `SandboxManager` used `connection.send()` (fire-and-forget, no top-level `requestId`) to forward `PH_CALLBACK_RESULT` messages. The renderer's `handleResponse()` requires top-level `requestId` to match pending requests. Added `connection.respond()` method to `PluginHostConnection` that places `requestId` at the message top level. Also send error responses when callback routing fails, instead of silently returning.
2. **[CRITICAL] Event broadcasts dead in worker**: The worker's `host.event` handler was a no-op comment. Added `eventCallbackMap` (event name → callback IDs) and proper dispatch in the handler. The `events.on()` method now maintains this mapping alongside `localCallbacks`.
3. **[HIGH] Quarantined plugin load reported success**: `loadPlugin()` returned normally when a plugin was quarantined, causing the child process to report `success: true`. Changed to throw an error.
4. **[MEDIUM] `node:` prefix bypassed ModuleGate**: `require('node:child_process')` was not matched by the string-based block sets. Added specifier normalization to strip `node:` prefix in both `gatedRequire()` and `gatedRequire.resolve()`.
5. **[MEDIUM] Activation error → retry loop**: Subscriptions not disposed on error, causing repeated activation attempts. Added `disposeSubscriptions()` call in the catch block.
6. **[MEDIUM] No worker-side request timeouts**: Worker pending requests could hang indefinitely. Added 30-second timeouts matching the renderer-side timeout.
7. **[MEDIUM] Ready timeout didn't kill orphaned child**: Added `childProcess.kill()` in the timeout handler.
8. **[LOW] Duplicate ready listeners on crash recovery**: Track and dispose the `'ready'` listener before re-registering.
9. **[LOW] `initialize()` failure never sent ready**: Added `.catch()` with `.finally()` to always send `PH_HOST_READY`.
10. **[LOW] Shallow function assertion**: Made `assertNoFunctions` recursive to catch deeply nested function values.
11. **[LOW] `require.resolve` leaked paths**: Applied same permission and block checks as `gatedRequire()`.
12. **Startup timeout increased**: 30s → 60s to handle plugins with many sequential registrations.

**Rationale**: Findings 1 and 2 were the root cause of all plugin loading failures — every callback invocation (command execution, settings changes, etc.) would hang for 30 seconds, and event subscriptions never fired. The medium-severity fixes close security gaps (ModuleGate bypass) and prevent resource leaks (retry loops, orphaned processes, unguarded pending requests). The low-severity fixes improve operational robustness.

## 2026-06-06: Form Builder Reinvention (clean cut)

**Context**: The old inline form field property panes (`PropertiesUserTaskFormFields`, `PropertiesUserTaskFormDisplay`) and the engine-debugger Dynamic UI system were limited, hard to extend, and did not support action buttons natively (the old "confirm" field type was a workaround).

**Decision**: Replace with:
- A dedicated Form Builder fragment editor with drag-and-drop canvas (`react-dnd`)
- A shared `FormRenderer` component in `bpmn-core` (used by both Form Builder preview and engine-debugger)
- A separate `evil:formActions` extension element for action buttons (replacing the old "confirm" field type)
- 10 minimal field types, basic validation only (required + regex), no FEEL expressions in v1
- Engine-opaque action semantics (renderer decides finish vs cancel based on `submitsForm` flag)
- Old types dropped entirely (pre-alpha, no backward compat)

**Rationale**: The Studio and Engine are both pre-alpha. A clean cut avoids migration complexity and establishes the correct architecture from the start. The Form Builder as a fragment editor allows editing without leaving the BPMN modeler context. Separating form actions from form fields reflects their distinct semantics (fields capture data, actions trigger outcomes).

---

### 2026-06-08 — Renderer+Model for all engine views

**Context**: The Wave 1 engine workspace (Dashboard, Process Explorer) initially used a Renderer+Hooks pattern with custom React hooks (`useDashboardData`, `useProcessExplorerData`, `useAutoRefresh`). Every other editor document in the Studio uses the Renderer+Model pattern with an `EditorDocumentModel` subclass.

**Options**:
- A) Keep Renderer+Hooks — less boilerplate, but no lifecycle hooks, no metadata persistence, no native pane reactivity, inconsistent with the rest of the codebase
- B) Adopt Renderer+Model — standard pattern, enables `updateMetadata()` for pane reactivity, lifecycle hooks for timer management and cleanup, metadata persistence across tab restore

**Decision**: Option B. All engine views use `EditorDocumentModel` subclasses. `DashboardDocumentModel` owns auto-refresh and health/info/stats fetching. `ProcessExplorerDocumentModel` owns process list and selection state. Renderers are thin view layers. A `useEditorModel<T>()` hook bridges functional components to model instances.

**Rationale**: The short-term overhead (~100 LOC per model) pays for itself immediately by fixing pane selection reactivity natively, enabling metadata persistence, and establishing the correct pattern before Wave 2 makes refactoring expensive. Wave 2 adds Debugger, Process Instance Detail, and Decision views — all of which need lifecycle management (WebSocket subscriptions, canvas state, breakpoints) that only models provide.

---

### 2026-06-10 — Server-side filtering, sorting, and pagination for engine workspace views

**Context**: All engine workspace tabular views (Instance Search, Process Explorer, Task Inbox, Decision Catalog) originally used REST APIs with client-side filtering, sorting, and pagination. This doesn't scale beyond small datasets.

**Decision**: Migrate all tabular views to GraphQL with server-side filtering, sorting, and offset pagination (`limit`/`offset`). Timer Schedules remains client-side (no GraphQL endpoint for timer schedules). String filters use `ilike` for case-insensitive substring matching. Enum fields use multi-select dropdowns, booleans use yes/no dropdowns, dates use range filters.

**Key technical details**:
- AshGraphql offset pages expose `results`, `count`, `hasNextPage`, `hasPreviousPage`, `pageNumber`, `lastPage`, `limit` — all server-provided.
- GraphQL response keys are always camelCase (Absinthe `LanguageConventions` adapter). Query field names accept both camelCase and snake_case.
- Two-step filter resolution for nested fields: process version and decision version filters first query the parent resource, then filter results by matching IDs.
- `TablePagination` component provides full page navigation: First/Last buttons, page size selector, and direct page jumps.

**Rationale**: Server-side operations are essential for production workloads with thousands of process instances. GraphQL provides rich filtering, sorting, and pagination in a single query. Offset pagination was chosen over keyset/cursor pagination because the table-based UI requires page jumping, page size changes, and First/Last navigation — capabilities that keyset pagination cannot support. The `ilike` operator enables intuitive free-text search. Timer Schedules stays client-side because the REST endpoint returns small, bounded datasets.

---

### 2026-06-12 — Engine DMN Viewer: migrate from custom SVG to dmn-js NavigatedViewer

**Context**: The Engine DMN Viewer (`engine-decision-viewer`) used a custom React + SVG renderer (`DrgCanvas.tsx`, ~700 lines) to render DRD diagrams based on parsed DMNDI data. This produced visually inconsistent results compared to the DMN Editor which uses `dmn-js/lib/Modeler`. The BPMN side already followed a consistent pattern: `BpmnModelerComponentAdapter` (editor) / `BpmnViewerComponentAdapter` (viewer).

**Decision**: Replace the custom SVG renderer with `DmnViewerComponentAdapter`, a new read-only adapter wrapping `dmn-js/lib/NavigatedViewer`. This establishes the same modeler/viewer symmetry for DMN that BPMN already has. The viewer supports full multi-view drill-down (DRD → Decision Table → Literal Expression → Boxed Expression), uses the shared `dmn.scss` theming overrides, and delegates SVG/PNG export to dmn-js's native `saveSVG()` API.

**Rationale**: Using the same rendering library as the DMN Editor guarantees visual parity, eliminates ~900 lines of custom SVG rendering code, and gives the viewer free multi-view capabilities that the custom renderer could never match. The dual-parse path (dmn-js for canvas, SDK `parseDmn()` for panes) avoids a rewrite of the 7 property panes.

---

### 2026-06-13 — Multi-engine isolation: data placement rules and shared resource elimination

**Context**: Engine views (Process Explorer, Decision Catalog, Dashboard, Task Inbox, Instance Search, Timer Schedules, Model Viewer, Decision Viewer, DMN Trace Fragment) used `registerSharedRessource` — a global singleton store — for per-document state like selections and parsed models. Two tabs of the same view type overwrote each other's selection, and inspector panes showed data from whichever tab updated last. WebSocket events and `engine:auth-token-changed` handlers also lacked engine-scoped filtering, causing cross-engine refresh cascades.

**Decision**: (1) Eliminate all per-document `registerSharedRessource` calls. Selections, parsed models, and working data live on private model fields exposed via public getters. Panes cast `props.editorDocumentModel` to the concrete model type and call the getter (the "Debugger pattern", which already followed this correctly). (2) A `selectionRevision` counter in metadata serves as a lightweight re-render trigger without persisting the actual selection object to localStorage. (3) `EventDrivenRefresh` accepts an optional `engineId` and filters events at the handler level. Direct WebSocket subscriptions and `engine:auth-token-changed` handlers include `engineId` guards. (4) A formal data placement principle governs what belongs in `currentData` (dirty-state tracking), `metadata` (view restoration), and private model fields (working data).

**Rationale**: `registerSharedRessource` is architecturally unsound for per-document state because it is a global singleton keyed by string — incompatible with multi-tab and multi-engine workflows. The Debugger had always used the correct pattern; this decision aligns all engine views with it. Engine-scoped event filtering prevents unnecessary API calls and UI refreshes when multiple engines are connected simultaneously. The data placement principle prevents localStorage bloat and stale-state leaks across sessions.

---

### 2026-06-14 — Debugger real-time refresh overhaul: full-data-on-load + batched WS-driven updates

**Context**: The debugger's `SubscribeThenSnapshot` ran a lightweight GraphQL query after the WS subscription was established, silently overwriting the full data already loaded by `loadProcessWithXml()`. This caused: (1) stale PI state — fast-failing processes appeared stuck in "RUNNING" because the `ProcessInstanceStateChanged` event was missed before subscription; (2) missing FNI detail data — `typeProperties` (child PI links, DMN traces) and `errorInfo` were discarded by `handleFniFinished`; (3) invisible tokens for long-running FNIs — input/output tokens were only available via on-demand `fetchFullFlowNodeInstance` on user click.

**Decision**: (1) Remove the lightweight snapshot query from `SubscribeThenSnapshot`. It uses a two-phase subscribe-before-load API (`subscribe()` then `setInitialSnapshot()`) and only handles WS events. Events arriving before the snapshot is set are buffered and replayed. (2) When FNI WS events arrive (Started/Finished/CallActivityChildStarted), collect affected FNI IDs in a pending set. After a 500ms coalescing debounce, fire a single batched `queryFlowNodeInstances` GraphQL query for all collected IDs, merge results, then trigger one atomic render cycle. (3) On PI state change, cancel pending FNI debounce and perform an immediate full re-query via `loadProcessWithXml`. (4) `DataObjectWritten` events update in-memory data object values and fold into the same debounced render cycle. (5) Remove `fullFniCache`, `fetchFullFlowNodeInstance`, `refetchTerminalData`, and the on-demand loading pattern from the debugger model.

**Rationale**: The dual-query architecture was the root cause of all refresh bugs. By ensuring only one authoritative data source (the initial full load, kept current by batched GraphQL fetches triggered by WS events), the debugger always has complete data. The batched fetch mechanism keeps WS events lightweight (no token payloads) while ensuring tokens and timestamps are available within ~500ms + query time. PI state changes are rare (2–4 per lifecycle) and justify a full re-query for correctness.

### 2026-06-14 — Subscribe-before-load pattern for zero missed WS events

**Context**: The original debugger refresh sequence was load-then-subscribe: `loadProcessWithXml()` fetched all data first, then `SubscribeThenSnapshot.start()` established the WS subscription and received the initial snapshot. This created a window between the load completing and the subscription becoming active where WS events could be missed — e.g. a fast-failing Call Activity child could transition to fatal during this gap, leaving the debugger stuck on stale state until a manual refresh.

**Decision**: Split `SubscribeThenSnapshot` into a two-phase API: `subscribe(onUpdate)` establishes the WS subscription and starts buffering incoming events; `setInitialSnapshot(snapshot)` sets the authoritative snapshot and drains buffered events through the normal processing pipeline. `EngineAdapter.loadInitialData()` now calls `subscribe()` first, then `loadProcessWithXml()`, then `setInitialSnapshot()`. Events arriving during the load window are buffered and replayed after the snapshot is set, guaranteeing zero missed events.

**Rationale**: The subscribe-before-load pattern eliminates the event-missing window without reintroducing the original problem of a lightweight query overwriting full data. Buffered events are replayed against the complete snapshot, so the in-memory model converges to the correct state. The implementation is minimal (a nullable array that accumulates events while the snapshot is null) and adds no measurable overhead.

---

### 2026-06-15 — Deploy-time version injection via dialogs instead of upfront enforcement

**Context**: The engine requires every deployed BPMN process to have an `evil:version` extension element. Without Studio support, users had to manually find and edit the version field in the XML whenever a deployment failed due to a missing or conflicting version, disrupting the deployment flow significantly.

**Decision**: Inject missing versions at deploy time rather than requiring them upfront at creation time. The approach consists of five layers: (1) the empty BPMN template includes `evil:version 1.0.0` by default; (2) `AutoVersionOnPoolBehavior` auto-assigns `1.0.0` when a pool is created; (3) a "Missing Versions" dialog intercepts deployment when any process lacks a version, pre-filling suggestions via engine discovery (`client.processes.get`); (4) a "Version Conflict" dialog intercepts 409 errors on explicit deploy commands, using engine discovery to suggest an accurate next version; (5) a "Bump Version" command palette entry applies `suggestNextVersion` to all processes. Both dialogs always show (no auto-skip setting) because their suggestions involve assumptions about version bumping that the user must review before deployment.

**Rationale**: Deploy-time injection catches version issues at the latest safe point — when the user intends to deploy — rather than cluttering the modeling experience with mandatory version management. Engine discovery ensures suggestions are based on the actual latest deployed version, not just the local XML, avoiding cascading 409 conflicts. The "always show" policy for both dialogs was chosen deliberately: auto-bumped versions may not match the user's intent (e.g., they may want a major version bump), and reviewing a pre-filled dialog takes only one click while a wrong auto-bumped version deployed to a production engine is significantly harder to clean up.

---

### 2026-06-15 — Configured Start dialog: key-value builder and context/payload separation

**Context**: The Configured Start dialog used a JSON5 code editor for the payload field, which was error-prone for simple key-value payloads and inaccessible to users unfamiliar with JSON syntax. The engine's `started_with_context` was always set from `payload`, with no way to provide independent context variables.

**Decision**: (1) Replace the JSON5 editor with a new `key_value_builder` dialog content type — a dynamic list of key-value text input pairs with add/remove controls. Values are smart-parsed: `true`/`false` → boolean, numbers → number, `null` → null, everything else → string. No nested objects or arrays in v1. (2) Add a separate `context` field to the engine's `POST /processes/:id/start` endpoint and SDK `StartRequest` type. The engine's `ProcessInstance` uses `opts[:context] || opts[:payload]` for `started_with_context`, preserving backward compatibility. (3) The Configured Start dialog now shows two builders: Payload and Context Variables. (4) The `studio.defaultCustomStartToken` BPMN extension property pre-fill is removed — it was fragile (depended on runtime BPMN XML parsing from the engine) and rarely used.

**Rationale**: A key-value builder is more intuitive than a code editor for the common case of flat configuration maps. Full-stack context/payload separation gives process modelers access to immutable context variables (`context.*` in FEEL) that are independent from the mutable token payload — a distinction requested by users who need stable reference data throughout the process lifecycle. The smart-parsing approach for v1 avoids the complexity of type dropdowns while still supporting the most common primitive types.

---

### 2026-06-15 — Debugger pane improvements: Context Variables, Token panes, FEEL Expression Runner

**Context**: The debugger's information architecture had three usability gaps: (1) process instance context variables (`startedWithContext`) were only visible in the raw Process Instance JSON dump, (2) Start/End Token inspection required navigating to the bottom inspector panel's "Process Tokens" tree entry, and (3) the Expression Runner used a legacy JavaScript `new Function()` evaluator with outdated variable names (`token.history`, `currentDataObject`, `currentFlowNode`, `businessKey`) that did not match the engine's actual FEEL bindings.

**Decision**: (1) Add a **Context Variables** property pane (right panel, process-level visibility — same as Process Model) that renders `startedWithContext` as formatted JSON. (2) **Move** Start/End Tokens from the bottom inspector into two collapsible right-panel property panes (Input Token / Output Token) placed after the Flow Node pane, using the existing `shouldDisplayStartTokenPane` / `shouldDisplayEndTokenPane` conditions. The old Token Inspector tree entry, command, and context pad action are removed. (3) **Rewrite** the Expression Runner to use the shared `FeelSimulatorEditor` component with a new `initialContext` prop, mapping runtime FNI data to canonical FEEL bindings (`token`, `this`, `context`, `process`, `processInstance`, `identity`, `dataObjects`, `loop`). The `initialContext` prop was added to `FeelSimulatorEditor` to allow any consumer to override the default sample data.

**Rationale**: Tokens are the most frequently inspected debugger data — placing them in the always-visible property panel eliminates a navigation step. Context variables deserve first-class visibility now that the engine supports independent `context` in start requests. Replacing the JS evaluator with FEEL ensures the Expression Runner matches the engine's actual expression language, and pre-filling with runtime data makes the sandbox immediately useful without manual context setup.

---

### 2026-06-15 — BPMN property pane editor upgrades (contracts + key-value builders)

**Context**: Six BPMN editor property panes required users to enter raw JSON or JSON Schema through suboptimal input widgets: three JSON-data panes (Default Configured Start Payload, Example Payload, Example Result) used `MultiLineCodeEditor language="json"`, and three JSON Schema panes (Payload Contract, Result Contract, Data Object Value Contract) used `PaneProperty type="textarea"` — a plain HTML textarea with no syntax highlighting, bracket matching, or validation.

**Decision**: (1) **Upgrade contract panes** (Payload Contract, Result Contract, Data Object Value Contract) from `PaneProperty type="textarea"` to `MultiLineCodeEditor language="json"` for proper syntax highlighting and editor affordances. (2) **Create a shared `KeyValueJsonEditor` component** (`studio/src/components/key-value-builder/`) — a dual-mode editor that shows a row-based key-value builder for flat JSON objects and a raw JSON Monaco editor for complex/nested structures. The user can toggle between modes. Values are smart-parsed (`"true"` → boolean, numeric strings → number, `"null"` → null). (3) **Migrate JSON-data panes** (Default Configured Start Payload, Example Payload, Example Result) to use `KeyValueJsonEditor`, providing the same builder UX as the Configured Start dialog while retaining raw JSON editing for power users.

**Rationale**: The key-value builder pattern was already proven by the Configured Start dialog (which uses the dialog-system-private `DialogContentKeyValueBuilder`). Extracting it into a standalone component makes the same UX available in property panes. The `smartParseValue` logic replicates the Configured Start's value typing. The raw JSON toggle ensures no capability regression for users with complex nested payloads. The contract pane upgrade is a minimal change with immediate usability improvement — JSON Schema in a plain textarea was the worst UX gap in the editor.

---

### 2026-06-15 — Debugger event trigger dialog refactoring + example payload wiring

**Context**: The debugger's event trigger dialogs shared a single `getMessageSignalEventDialogContent` function for both Messages and Signals, despite the two event types having fundamentally different API contracts. Messages take a payload and are scoped to a process instance; Signals are payload-less broadcasts. The shared dialog showed an "Event Scope" selector (Process Instance vs. Global) that was never a supported feature of the engine's message API. The payload field was not pre-filled with the `studio.examplePayload` custom property even when the user had configured one on the catch element. The sanitizer also incorrectly flagged `evil:Properties` containers as "empty" when they contained `evil:Property` entries but no linter scores.

**Decision**: (1) **Split** the shared dialog into three dedicated functions: `askMessageTriggerConfirmation` (payload dialog), `askSignalTriggerConfirmation` (simple confirmation), `askTimerTriggerConfirmation` (simple confirmation). (2) **Remove** the "Event Scope" selector — messages always target the current process instance. (3) **Wire** `studio.examplePayload` into the message dialog via a new `BpmnCustomPropertyAccessor` helper that reads `evil:Property` values from the raw moddle `businessObject`. (4) **Update** caution text: messages mention "same Correlation", signals mention "entire engine". (5) **Fix** the sanitizer to check both `linterRulesetScores` and `values` arrays before flagging `evil:Properties` as empty.

**Rationale**: The split makes each dialog self-contained with only the fields relevant to that event type. Pre-filling example payloads eliminates manual JSON entry for the most common debugger workflow (triggering message events). Removing the non-functional scope selector prevents user confusion. Accessing `evil:Property` through the raw moddle bypasses the SDK parser, which does not expose studio-internal custom properties. The sanitizer fix prevents data loss — the old logic would flag and then delete `evil:Properties` containers that held `studio.examplePayload` entries.

---

### 2026-06-15 — Direction-aware contracts on message events (D-MSG-3)

**Context**: Message event contracts were stored on `EventDefinition.Message` in the Engine and validated using the generic name `payloadContract` regardless of data direction. Catch-side events (which receive data) used `payloadContract` to validate incoming data, contradicting the naming convention established by tasks where `payloadContract` validates outgoing data and `resultContract` validates incoming data. The Studio's pane visibility did not show any contract pane for catch-side message events, despite the Engine enforcing contracts on them. Signal events incorrectly showed a Payload Contract pane despite the Engine having no signal contract support.

**Decision**: (1) **Engine hard cut**: Remove `payload_contract` from `EventDefinition.Message` entirely. Move contracts to flow-node position structs with direction-aware naming: throw-side events (`IntermediateThrowEvent`, `EndEvent`, `SendTask`) get `payload_contract`; catch-side events (`IntermediateCatchEvent`, `BoundaryEvent`, `StartEvent`, `ReceiveTask`) get `result_contract`. (2) **Studio pane visibility**: Add catch-side message events to `DATA_PIPELINE_RESULT_CONTRACT_TYPES`; split payload contract and input mapping visibility into separate type lists (`DATA_PIPELINE_PAYLOAD_CONTRACT_TYPES` and `DATA_PIPELINE_INPUT_MAPPING_TYPES`) so signal throw events retain input mappings without showing payload contract. (3) **Element access**: Expose `resultContract` on catch-side message events; add `outputMappings`/`inputMappings` to signal events. (4) **SDK types**: Add `resultContract` to catch-side message event types; add mapping arrays to signal event types.

**Rationale**: Aligns with D-MSG-1 (mappings at flow-node level) and existing task semantics. The hard cut eliminates backward-compatibility complexity — all BPMNs with event-level contracts must be updated to use flow-node-level `<evil:resultContract>` (catch) or `<evil:payloadContract>` (throw). Signal events carry no payload and no contracts per the Engine design, so showing a contract pane was misleading.

---

### 2026-06-24 — Phase 8: BPMN Editor Plugin Enrichment architecture decisions

**Context**: Phase 8 introduces a tiered plugin permission model for BPMN editor enrichment, allowing plugins to read diagram data, modify models, contribute palette/context pad entries, and inject renderer modules.

**Decisions**:

1. **Tiered permission model** (`bpmn` → `bpmn.modelling` → `bpmn.renderer`) instead of a single gate. Each tier unlocks progressively more powerful capabilities. Higher tiers implicitly grant lower-tier permissions via `PERMISSION_HIERARCHY` in `PermissionGate.ts`.

2. **No generic `EditorEnrichmentBridge`** — each diagram type gets its own explicit API (`BpmnApiBridge`). This avoids premature abstraction; DMN will get its own `DmnApiBridge` in Phase 9 following the same patterns.

3. **Layered approach**: declarative manifest contributions (palette, context pad) + runtime API methods (register/unregister) + privileged renderer module injection. This gives plugin developers a progressive complexity ramp.

4. **Event-driven overlays, command-based click interaction** — overlays are non-interactive by default (`pointer-events: none`). Interactive overlays require `onClickCommand` referencing the plugin's own command. This prevents plugins from silently intercepting user clicks.

5. **Pre-evaluated `elementIds` allowlist for context pad dynamic visibility** instead of synchronous `visibleWhen` callbacks. The async plugin sandbox bridge makes synchronous per-render callbacks architecturally impossible. Plugins subscribe to element events, compute qualifying IDs reactively, and push updates via `updateContextPadEntry`.

6. **DI-scoping only for renderer modules** — renderer modules receive diagram-js services + `pluginChannel` via DI. No `bifrost` reference is injected. The existing SES sandbox (Phase 7) provides baseline isolation for the host-side plugin code.

7. **Element coloring dropped from v1** — custom element coloring (background/border color) is deferred. Renderer module injection covers the use case for plugins that truly need it.

**Rationale**: The tiered model balances developer ergonomics (most plugins only need `bpmn` for read-only overlays) with security (renderer injection is rare and high-risk). Command-based overlay interaction leverages the existing command system for authorization. The allowlist pattern for context pad visibility is the only architecturally sound solution given the async boundary between plugin sandbox and renderer.
