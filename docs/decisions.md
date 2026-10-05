# Decisions

## Hybrid categorized workbench

**Context:** One flat workbench mixed modelling, debugging, and administration. Panes and editors were global, so every feature competed for the same sidebar and editor area.

**Options:** Keep one workbench and add filters; separate windows per task; categories containing pages with their own editor area and pane groups.

**Decision:** Header categories (Home, Design, Discover, Deploy, Debug, Control) contain pages. Each page has its own editor area; pane groups are assigned to pages (left groups mandatory, right and bottom default to all). Discover stays hidden while empty (`workbench.categories.showEmpty`). Plugin API 2.0.0 is one breaking change: `page` and `pages` are required, `paneToggles` is removed, the menu bar API offers the header and the page bar areas. No migration of old layout state.

**Rationale:** Tasks get focused surfaces without separate windows, and unversioned old state is cheaper to drop than to migrate this early.

See [workbench-categories.md](architecture/workbench-categories.md).

## Scoped settings through one mediator

**Context:** BPMN Editor, BPMN Linter, and DMN Editor settings need to differ per solution and per project. A first cut exposed a second settings object (`forResource` / `forFocusedDocument`), so callers had to choose which API to use.

**Options:** Keep the per-resource view, or fold resolution into `bifrost.settings` with an optional resource.

**Decision:** One mediator. `get`, `inspect`, `set`, and `onDidChange` take an optional resource. Omitted means the focused editor document. The per-resource view object is superseded. Solution values live in the `.bfwsln` `settings` object. Project values live in `<project>/.bifrostfw/settings.json`. Precedence is Default, User, Solution, Project. Descriptors declare `scope`.

**Rationale:** Callers must not choose between two APIs. That split is how a color picker kept reading the User layer after the setting became project-scoped.

See [settings.md](architecture/settings.md).

## One-way module dependency direction

**Context:** Imports crossed the module families in both directions: bpmn and dmn editors reached into engine and `git-cruiser` code, `components/` into `bpmn-core`, and the plugin host hard-wired the BPMN and DMN API bridges.

**Options:** Document the direction only; or document it, move the crossing code, and enforce it with ESLint. For the plugin bridges: keep them in the host, or let modules register them through a contract.

**Decision:** `bifrost/` and `components/` import no module. Engine modules may import everything; nothing imports them. bpmn and dmn modules may import only the other family's `-core` module, because the Business Rule Task couples the two. Editors never import `git-cruiser`. Shared pure functions go to `bifrost/common/`, and a one-liner is repeated instead of extracted. Modules register `api.bpmn` / `api.dmn` as `PluginApiNamespace`. ESLint zones enforce the direction.

**Rationale:** A rule that is not enforced erodes again, and inverting the plugin bridges is the only way to keep the host free of module code.

See [imports-and-modules.md](architecture/imports-and-modules.md) and [plugin-host.md](architecture/plugin-host.md).

## Per-resource `ScopedSettings` view — superseded by "Scoped settings through one mediator"
