---
name: architecture-docs
description: >-
  Write and extend architecture documentation in docs/architecture/.
  Use when creating a new architecture doc, restructuring an existing one,
  or adding a new subsystem section. Covers structure, formatting conventions,
  and style rules established across the existing documents.
---

# Architecture Documentation

Architecture docs live in `docs/architecture/`, one file per topic area, listed in `docs/architecture/index.md`. They are technical references for agents — not tutorials, not high-level overviews (those belong in `docs/systeme.md` and `docs/philosophie.md`).

For **when** to update docs, see the workspace rule `maintain-architecture-docs.mdc`.

## Document Structure

Every architecture doc follows this skeleton:

```markdown
# Topic Name

---

## Overview
(3-4 sentences: what the subsystem is, what problem it solves, key dependencies)

## Architecture
(Layer diagrams, class/module descriptions with #### sub-headings, tables for structured data)

## Public API / User-Facing Features
(How modules or users interact with the subsystem)

## File Path Reference
(Table mapping components to file paths)
```

Use `---` horizontal rules between major sections.

### Section Hierarchy

- `##` for top-level sections (Overview, Architecture, Settings, File Path Reference)
- `###` for subsections within (Engine Layer, Visual Layer, Control Layer)
- `####` for individual classes, components, or concepts within a subsection

Every `####` heading should start with a **Path:** line when documenting a specific file:

```markdown
#### SimulationEngine

**Path:** `studio/src/modules/bpmn-token-simulator/core/SimulationEngine.ts`

Central orchestrator. Key responsibilities:

- **Timer scheduling**: ...
- **Token lifecycle**: ...
```

## Formatting Rules

### Tables over bullet lists

When listing items with structured attributes (name + description, name + type + purpose), use a table:

```markdown
| Event | Purpose |
|-------|---------|
| `token:enter` | Token arrives at an element |
| `token:exit` | Token leaves an element |
```

Reserve bullet lists for unstructured enumerations or short lists (< 5 items).

### Prose length

- **Class descriptions**: 3-6 lines max. Use bullet points for key responsibilities.
- **Component descriptions in tables**: One sentence per row.
- **Section intros**: 1-2 sentences before diving into sub-headings.
- **No "wall of text"**: If a paragraph exceeds ~5 lines, break it into bullets, a table, or sub-headings.

### Code examples

Include 1-3 TypeScript snippets per document showing key API patterns (registration, subscription, type contracts). Keep snippets 5-15 lines. Example:

```markdown
#### Behavior Interface

Each behavior implements `{ enter, exit?, signal? }`:

\`\`\`typescript
interface ElementBehavior {
  enter(element: any, scope: Scope, viaFlow?: any): void;
  exit?(element: any, scope: Scope): void;
  signal?(element: any, scope: Scope, data?: any): void;
}
\`\`\`
```

### ASCII diagrams

Use ASCII box diagrams for layer/flow visualizations. Keep them concise:

```
┌─────────────────────────┐
│     Control Layer        │
├─────────────────────────┤
│     Visual Layer         │
├─────────────────────────┤
│     Engine Layer         │
└─────────────────────────┘
```

### File Path Reference

Every document ends with a table mapping components to their file paths:

```markdown
## File Path Reference

| Component | Path |
|-----------|------|
| SettingsManager | `studio/src/bifrost/common/SettingsManager.ts` |
| SettingsMediator | `studio/src/bifrost/common/SettingsMediator.ts` |
```

## Content Guidelines

### What belongs in architecture docs

- File paths, type signatures, method tables
- Event flows and data models
- Relationships between classes/modules
- DI wiring, registration patterns
- Key algorithms that affect the subsystem's design (e.g., join semantics, scope lifecycle)

### What does NOT belong

- Step-by-step tutorials (plugin how-to is `docs/plugin-development-guide.md`; other how-tos are skills)
- High-level philosophy (`docs/philosophie.md`) or subsystem overviews (`docs/systeme.md`)
- Session diaries, CI logs, named failing tests as headlines, “what we tried”, Phase / Extension-v2 banners
- Test postmortems — those go in `docs/testing.md` if they are harness rules, otherwise nowhere
- Copying another architecture file’s method tables; one sentence + link
- Every internal field name and CSS class — only what is architecturally significant

### Pitfalls vs decisions vs architecture

| File | Belongs | Does not belong |
|------|---------|-----------------|
| `architecture/*.md` | Current facts: paths, signatures, flows | History of a bugfix |
| `common-pitfalls.md` | A mistake someone can make again (3–8 lines) | One-off incidents, test names |
| `docs/decisions.md` | Dated A-vs-B that still explains the architecture | Diaries, Vitest upgrades, “we added a pane” |

### Depth calibration

Give proportional depth to each concept. A core algorithm (gateway join semantics) deserves a paragraph. A pass-through behavior (StartEvent) deserves one table row. Signs of miscalibration:

- A one-line concept gets a full paragraph → trim to a table row
- A complex algorithm is buried in a bullet list → promote to its own `####` section
- Multiple sections explain the same DI wiring → consolidate into one and cross-reference

## Documentation Mapping Table

Use this table to determine **which file to update** based on what you changed or learned:

| What changed | Update |
|-------------|--------|
| Solution/project handling, file explorer, session restore, window management | `workspace.md` |
| Command registration, execution, cross-module command calls | `commands.md` |
| Module load order, entry points, dependency graph, new module added | `modules.md` |
| Engine connectivity, debugger, document URIs, GraphQL Model graph | `engine.md` |
| Dialog queue, dialog content types, native file pickers | `dialogs.md` |
| Editor document types, model/renderer/inspector, data placement | `editor-documents.md` |
| Rspack config, build targets, loaders, conditional compilation | `build.md` |
| Icon registration, Phosphor icons, SVG composites | `icons.md` |
| CSS tokens, theme registration, theme inheritance | `theming.md` |
| Notification API, notification types | `notifications.md` |
| Status bar items, priority, problems count | `status-bar.md` |
| Tree component, TreeDataAdapter, HeadlessTreeItem, tree plugins | `tree.md` |
| Settings registration, persistence, Settings editor UI | `settings.md` |
| Host CodeMirror wrappers (`MultiLineCodeEditor`, `DiffEditor`), language map | `code-editors.md` |
| FEEL widgets, FeelSimulator, `bpmn.feel.getExpressionContext` | `feel-editor.md` |
| BPMN modeler modules, `registerModule`, diagram-js services | `bpmn-modeler-modules.md` |
| Token simulator, simulation behaviors, overlays | `bpmn-token-simulator.md` |
| Workbench layout, split bars, pane areas, menu bar | `workbench-layout.md` |
| PaneProvider contract, `shouldBeDisplayed` vs renderer, pane registration | `panes.md` |
| BPMN property pane inventory, element access, command handlers | `bpmn-editor-properties.md` |
| BPMN linter, scores, Findings pane | `bpmn-linter.md` |
| BPMN sanitizer (structural integrity) | `bpmn-sanitizer.md` |
| Subprocess drill-down | `bpmn-drilldown.md` |
| BPMN diff, history preview, three-panel merge visualization | `bpmn-diff.md` |
| Git primitives, IPC, Git pane, merge **framework** (not BPMN UI) | `git-cruiser.md` |
| DMN editor, DRD views, DMN panes, DMN merge resolver | `dmn-editor.md` |
| Plugin Host, SES, IPC, quarantine, PluginService | `plugin-host.md` |
| `bifrostStudio` manifest schema, permissions, activation events | `plugin-manifest.md` |
| Plugin iframe protocol, `evil-webview://`, `acquireStudioApi` | `webviews.md` |
| Plugin BPMN overlays / palette / modeling / renderer modules | `plugin-bpmn-enrichment.md` |
| Plugin DMN DRD enrichment | `plugin-dmn-enrichment.md` |
| How to author/install a plugin (not method tables) | `docs/plugin-development-guide.md` |
| Import aliases, tsconfig, module resolution | `imports-and-modules.md` |
| ESLint/Prettier config, React Compiler rules | `code-quality.md` |
| Recurring constraint (gate: would someone hit this again?) | `common-pitfalls.md` |
| Significant A-vs-B design choice | `docs/decisions.md` |
| Integration-test / StudioAgent harness gotcha | `docs/testing.md` — **not** pitfalls |

If the change does not fit any existing file, create a new one (see below). Do not paste a test postmortem into pitfalls.

## Adding a New Document

1. Create `docs/architecture/<topic>.md` following the skeleton above
2. Add a one-line entry to `docs/architecture/index.md` under **Topics**
3. Format the index entry as: `- **[topic.md](topic.md)** — Brief description of contents`

## Reference: Established Documents

Study these as style references before writing:

- `docs/architecture/settings.md` — Good example of tables, code examples, sub-headings, and `---` dividers
- `docs/architecture/commands.md` — Good example of method signature tables and execution flow descriptions
- `docs/architecture/bpmn-modeler-modules.md` — Good example of concise document with ASCII flow diagram and code snippets
- `docs/architecture/bpmn-token-simulator.md` — Good example of supported-elements table, behavior table, overlay component table, and layered architecture description
