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

**Decision:** `bifrost/` and `components/` import no module. Engine modules may import everything; nothing imports them. bpmn and dmn modules may import only the other family's `-core` module, because the Business Rule Task couples the two. Editors never import `git-cruiser`. Pure functions shared by several families and owned by none go to `bifrost/common/`; code whose callers sit in one module or family stays there. A one-liner is repeated instead of extracted. Modules register `api.bpmn` / `api.dmn` as `PluginApiNamespace`. ESLint zones enforce the direction.

**Rationale:** A rule that is not enforced erodes again, and inverting the plugin bridges is the only way to keep the host free of module code.

See [imports-and-modules.md](architecture/imports-and-modules.md) and [plugin-host.md](architecture/plugin-host.md).

## Source control as a core service

**Context:** git lived in `git-cruiser`, but its IPC channels, history wire format, main-process handlers and digest helpers had leaked into `bifrost/contracts/`, `bifrost/common/` and `bifrost/electron-main/`. The core used git without offering it, and the module imported `electron` directly, which the web build cannot provide.

**Options:** Move everything back into `git-cruiser` and treat git as module-only; make it a core service; or split into a core service plus a module-owned provider registry.

**Decision:** Core service `bifrost.sourceControl` (`SourceControlService`), built like `bifrost.files`: abstract class in `bifrost/common/`, `SourceControlServiceElectron` in the renderer, handlers in `electron-main/git/`, `SourceControlServiceDefault` (unavailable) for the web build. The construct is named "source control", not "git", so a provider registry can replace the single implementation later without new terms. `git-cruiser` keeps state (`RepositoryStore`) and all UI. Change digest builders moved to `bpmn-core`, the formatter to `git-cruiser`.

**Rationale:** Platform capabilities already follow this pattern, and it keeps `electron` out of modules.

See [source-control.md](architecture/source-control.md).

## Source Overview as the default document of the Source page

**Context:** Design › Source showed only the Git pane; the centre area was blank. Users could not see what their branch changed, find a commit, or look at a diff without opening files first.

**Options:** Put the overview into page-level panes; make it an editor document that is the page's default; or show only the Git pane with richer rows.

**Decision:** A singleton editor document `git:overview` (`defaultDocumentUri` of `design/source`) with three tabs: uncommitted changes, current-branch history (searchable through `git log --grep`) and the comparison with a base branch. A click on a changed file opens a diff on the same page: BPMN and DMN files open the visual diff (with a Visual | XML switch), every other file a text diff. Git pane rows open the same diffs. Everything crosses module boundaries through commands (digest commands, `git.showChangeDiff`, `git.previewFileVersion`).

**Rationale:** A document keeps view state (tab, base branch) like any editor, reuses the existing diff documents and routing, and needs no new page mechanism.

See [git-cruiser.md](architecture/git-cruiser.md).

## Per-resource `ScopedSettings` view — superseded by "Scoped settings through one mediator"
