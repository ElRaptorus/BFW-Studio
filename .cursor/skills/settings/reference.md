# Settings System — Architectural Reference

For the full architectural documentation of the settings system (storage internals, class hierarchy, persistence layer, event wiring, value type catalog), see:

**[docs/architecture/settings.md](../../docs/architecture/settings.md)**

Key topics covered there:

- **SettingsManager** — in-memory model (`config` + `schemaRegistry`), shallow copy semantics, `serialize`/`deserialize`
- **SettingsMediator** — public API layer, auto-persistence on change, cross-window propagation
- **SettingsValidator** — runtime validation: type checks, enum membership, pattern matching, min/max range, array constraints, recursive object property validation
- **LocalStorageItem** — persistence abstraction, `comment-json` format, storage key (`${appKey}/Settings`)
- **Events** — `settingsUpdate` (module-facing, debounced), `EVENT_SETTINGS_CHANGED` / `EVENT_SETTINGS_MERGED` (internal)
- **Settings UI** — GUI editor (`about:settings`) with category sidebar and VS Code-style boolean layout; JSON editor (`about:settings-json`) with VS Code-like JSON highlighting (unknown keys, invalid values, deprecated strikethrough, hover descriptions, autocomplete)
- **Category navigation** — `settings.openUserSettingsAtCategory` command for programmatic navigation to a settings category (via `settingsNavigation.ts`)
- **Registration sites** — table of all `register()` call locations across the codebase
- **File path reference** — all relevant source files
