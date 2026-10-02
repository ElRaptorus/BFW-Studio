# Decisions

## Hybrid categorized workbench

**Context:** One flat workbench mixed modelling, debugging, and administration. Panes and editors were global, so every feature competed for the same sidebar and editor area.

**Options:** Keep one workbench and add filters; separate windows per task; categories containing pages with their own editor area and pane groups.

**Decision:** Header categories (Home, Design, Measure, Deploy, Debug, Control) contain pages. Each page has its own editor area; pane groups are assigned to pages (left groups mandatory, right and bottom default to all). Measure stays hidden while empty (`workbench.categories.showEmpty`). Plugin API 2.0.0 is one breaking change: `page` and `pages` are required, `paneToggles` is removed, the menu bar API is header-only. No migration of old layout state.

**Rationale:** Tasks get focused surfaces without separate windows, and unversioned old state is cheaper to drop than to migrate this early.

See [workbench-categories.md](architecture/workbench-categories.md).

## Scoped settings through one mediator

**Context:** BPMN Editor, BPMN Linter, and DMN Editor settings need to differ per solution and per project. A first cut exposed a second settings object (`forResource` / `forFocusedDocument`), so callers had to choose which API to use.

**Options:** Keep the per-resource view, or fold resolution into `bifrost.settings` with an optional resource.

**Decision:** One mediator. `get`, `inspect`, `set`, and `onDidChange` take an optional resource. Omitted means the focused editor document. The per-resource view object is superseded. Solution values live in the `.bfwsln` `settings` object. Project values live in `<project>/.bifrostfw/settings.json`. Precedence is Default, User, Solution, Project. Descriptors declare `scope`.

**Rationale:** Callers must not choose between two APIs. That split is how a color picker kept reading the User layer after the setting became project-scoped.

See [settings.md](architecture/settings.md).

## Per-resource `ScopedSettings` view — superseded by "Scoped settings through one mediator"
