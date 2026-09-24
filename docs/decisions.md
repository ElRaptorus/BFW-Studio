# Decisions

## Scoped settings through one mediator

**Context:** BPMN Editor, BPMN Linter, and DMN Editor settings need to differ per solution and per project. A first cut exposed a second settings object (`forResource` / `forFocusedDocument`), so callers had to choose which API to use.

**Options:** Keep the per-resource view, or fold resolution into `bifrost.settings` with an optional resource.

**Decision:** One mediator. `get`, `inspect`, `set`, and `onDidChange` take an optional resource. Omitted means the focused editor document. The per-resource view object is superseded. Solution values live in the `.bfwsln` `settings` object. Project values live in `<project>/.bifrostfw/settings.json`. Precedence is Default, User, Solution, Project. Descriptors declare `scope`.

**Rationale:** Callers must not choose between two APIs. That split is how a color picker kept reading the User layer after the setting became project-scoped.

See [settings.md](architecture/settings.md).

## Per-resource `ScopedSettings` view — superseded by "Scoped settings through one mediator"
