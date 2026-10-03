# Plugin Manifest — Declarative Contribution Model

## Overview

Plugins can declare static contributions in the `bifrostStudio` section of their `package.json`. These contributions (commands, settings, keybindings, icons, menus, panes, service task types) are registered at discovery time — before any plugin code runs. This enables lazy activation, contribution discovery, and pre-validation.

Plugins without a `bifrostStudio` section continue to work as before (eager activation, imperative contributions only).

## Manifest Location

The manifest lives in `package.json` under the `bifrostStudio` key:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "bifrostStudio": {
    "apiVersion": "2.0.0",
    "displayName": "My Plugin",
    "activationEvents": ["onCommand:myPlugin.doThing"],
    "contributes": { ... }
  }
}
```

## Schema Reference

### Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiVersion` | `string` | **Yes** | Semver version of the Studio Plugin API this plugin targets. Incompatible versions are rejected at discovery. |
| `displayName` | `string` | Recommended | Human-readable name shown in the Plugins pane. |
| `description` | `string` | No | Short description. |
| `icon` | `string` | No | Path to plugin icon (relative to plugin root). |
| `permissions` | `PluginPermission[]` | No | Capabilities the plugin requests. Defaults to `[]` (fully sandboxed). See "Permissions" below. |
| `activationEvents` | `string[]` | No | Events that trigger lazy loading. Without this, the plugin loads eagerly. |
| `contributes` | `object` | No | Declarative contribution entries (see below). |

### Permissions

The `permissions` array declares which sandbox capabilities the plugin needs. Plugins without `permissions` (or with `permissions: []`) run fully sandboxed with no special access.

| Permission | Grants | Warning Level |
|------------|--------|---------------|
| `filesystem` | `workspace.*` API, `require('fs')` | Medium |
| `commands.std` | Execute `std.*` commands | Medium |
| `commands.bpmn` | Execute `bpmn.*` commands | Medium |
| `commands.dmn` | Execute `dmn.*` commands | Medium |
| `bpmn` | Read BPMN elements, subscribe to events, place overlays | Low |
| `bpmn.modelling` | All of `bpmn` + modify BPMN model + palette/context pad contributions | Medium |
| `bpmn.renderer` | All of `bpmn.modelling` + inject diagram-js modules into renderer | High |
| `dmn` | Read DMN elements, subscribe to events, place overlays | Low |
| `dmn.modelling` | All of `dmn` + modify DMN model + palette/context pad contributions | Medium |
| `dmn.renderer` | All of `dmn.modelling` + inject diagram-js modules into renderer | High |
| `native` | Load `.node` native addons | Critical |
| `system-info` | `require('os')` (safe subset: `platform`, `arch`, `tmpdir`, `EOL`) | Low |

**BPMN permission hierarchy**: `bpmn.renderer` ⊃ `bpmn.modelling` ⊃ `bpmn`. Declaring a higher tier implicitly grants all lower tiers. Same shape for `dmn` / `dmn.modelling` / `dmn.renderer`. `renderer-modules` is a legacy alias of `bpmn.renderer` only.

**Reserved**: `network` is recognized but rejected — plugins have zero network access in v1.

**Example**:

```json
"bifrostStudio": {
  "apiVersion": "2.0.0",
  "permissions": ["filesystem", "commands.std"],
  "activationEvents": ["onStartup"]
}
```

### Activation Events

| Event | Trigger |
|-------|---------|
| `onStartup` | Immediately after all manifests are processed |
| `*` | Equivalent to `onStartup` |
| `onCommand:<id>` | When the specified command is executed |
| `onDocumentType:<typeId>` | When an editor document of that type is focused |
| `onUri:<scheme>` | When a URI matching the scheme prefix is opened |
| `onSetting:<key>` | When the specified setting changes |

A plugin that declares `contributes.editorDocumentTypes` is lazily activated even with an empty (or absent) `activationEvents` list: the placeholder document type registered for each entry doubles as the activation trigger. See §`contributes.editorDocumentTypes`.

### Contribution Types

#### `contributes.commands`

Array of command declarations. Each command is registered in the command palette with a stub callback that triggers lazy activation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Command identifier (namespaced as `plugin.<name>.<id>`) |
| `title` | `string` | Yes | Display title in the command palette |
| `icon` | `string` | No | Icon ID or Phosphor class |
| `category` | `string` | No | Category prefix for palette grouping |

#### `contributes.menus`

Object mapping menu IDs to arrays of menu item entries.

```json
"menus": {
  "std/application/main": [
    { "command": "myPlugin.doThing", "group": "tools" }
  ]
}
```

#### `contributes.settings`

Array of setting descriptors registered in the Settings editor.

| Field | Type | Required |
|-------|------|----------|
| `key` | `string` | Yes |
| `type` | `'boolean' \| 'string' \| 'number' \| 'string[]' \| 'object'` | Yes |
| `default` | `unknown` | No |
| `description` | `string` | No |
| `category` | `string` | No |
| `enum` | `unknown[]` | No |

#### `contributes.keybindings`

Array of keybinding declarations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | `string` | Yes | Command to trigger |
| `key` | `string` | Yes | Default keystroke (`ctrl+shift+m`) |
| `mac` | `string` | No | macOS override |
| `linux` | `string` | No | Linux override |
| `windows` | `string` | No | Windows override |
| `when` | `KeybindingWhenCondition` | No | Context condition |

**`when` vocabulary:**

| Value | CSS Selector | Description |
|-------|-------------|-------------|
| `"*"` (or omitted) | `body` | Global |
| `"editorFocused"` | `.kbm-editor` | Any editor focused |
| `"editorFocused:<docType>"` | `.kbm-editor[data-editor-document-type=<docType>]` | Specific editor type |

#### `contributes.icons`

Object mapping icon IDs to Phosphor class strings or file paths.

#### `contributes.panes`

Array of pane placeholder declarations.

| Field | Type | Required |
|-------|------|----------|
| `id` | `string` | Yes |
| `title` | `string` | Yes |
| `area` | `'left' \| 'right' \| 'bottom'` | Yes |
| `pages` | `string[]` (`<categoryId>/<name>`) | **Yes for `area: 'left'`**; optional otherwise (omitted = every page) |
| `groupId` | `string` | No |
| `icon` | `string` | No |
| `visibleWhen` | `{ documentType?: string; setting?: string }` | No |

#### `contributes.pages`

Pages added to **existing** workbench categories. Registered at discovery time by `registerPluginPage()` (`ContributionRegistrar.ts`), so a category that was empty (Measure) becomes visible while the plugin is still `pending`. Validated by `readPageContribution()` (`ManifestReader.ts`), which `api.workbench.registerPage` shares.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | `<categoryId>/<name>`, lowercase with digits and `-`. Not namespaced: the first plugin to claim an ID wins, and an ID of a built-in page is refused |
| `label` | `string` | Yes | Text in the page bar |
| `icon` | `string` | Yes | Icon ID or Phosphor class |
| `order` | `number` | No | Sort position inside the category, default `1000` (after built-in pages) |
| `defaultDocumentUri` | `string` | No | Opened when the page is activated without documents |
| `editorTabsVisible` | `boolean` | No | Default `true` |
| `paneAreas` | `('left'\|'right'\|'bottom')[]` | No | Default: all three |

Validation rejects non-array values, non-object entries, malformed IDs, blank `label`/`icon`, a non-finite `order`, wrongly typed optional fields, unknown `paneAreas` entries and duplicate IDs within a plugin. The registry then refuses an unknown category or a taken ID: the page is skipped, `console.error` logs it and an error notification reads `Plugin '<name>': page '<id>' was not added: <reason>`. The plugin itself still loads.

#### `contributes.editorDocumentTypes`

Array of editor document type declarations. Processed at discovery time by `ContributionRegistrar.registerEditorDocumentTypePlaceholder()`, before plugin activation — the URI pattern and the File Explorer file visibility are therefore effective while the plugin is still `pending`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Document type identifier (namespaced as `plugin.<name>.<id>`); must match the `id` passed to `registerWebviewDocumentType()` |
| `displayName` | `string` | Yes | Human-readable name of the document type |
| `icon` | `string` | Yes | Icon ID or Phosphor class |
| `uriPattern` | `string` | Yes | Regex source string matched against document URIs (e.g. `"\\.md$"`) |
| `page` | `string` | Yes | Workbench page the documents open on: `<categoryId>/<name>` (for example `design/workspace`) or `active` for whichever page is current. An unregistered page refuses the open with an error notification |
| `includedFilePatterns` | `string[]` | No | File globs registered as known (non-hidden) files in the File Explorer via `SolutionMediator.registerDefaultIncludedFiles()` |

Each entry registers a **placeholder** document type whose renderer (`PlaceholderEditorDocumentRenderer`) triggers activation of the owning plugin when a matching file is opened, then closes and reopens the tab so it re-resolves to the real editor the plugin registered. Declaring `editorDocumentTypes` therefore makes the plugin lazily activated even without any `activationEvents` entry. Validation rejects non-object entries, missing/blank required fields, `uriPattern` values that are not valid regular expressions, duplicate `id`s within a plugin, and `includedFilePatterns` that is not an array of strings.

Full state machine (replacement, permission denial, activation failure, missing registration): see [plugin-host.md](plugin-host.md) §Static editor document type contributions.

#### `contributes.paneToggles` (removed in 2.0.0)

Pane toggle buttons no longer exist; the header and page bar replace the left menu bar. A manifest that still declares `paneToggles` is rejected with an error naming `pages` as the replacement.

#### `contributes.serviceTaskTypes`

Array of Service Task implementation types for the BPMN editor dropdown.

| Field | Type | Required |
|-------|------|----------|
| `implementation` | `string` | Yes |
| `label` | `string` | Yes |

#### `contributes.themes`

Array of theme declarations. Themes registered via manifest are available immediately at discovery time (before activation).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Theme ID (auto-namespaced to `plugin.<name>.<id>`) |
| `label` | `string` | Yes | Human-readable name in Settings dropdown |
| `type` | `'dark' \| 'light'` | Yes | Determines fallback behaviour on removal |
| `tokens` | `Record<string, string>` | Yes | CSS custom property overrides (leading `--` auto-prepended if missing) |

#### `contributes.bpmnPalette`

Array of palette entry declarations. Requires `bpmn.modelling` permission.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Entry identifier |
| `icon` | `string` | Yes | Phosphor icon class (e.g. `ph-light ph-wrench`) |
| `title` | `string` | Yes | Tooltip/label |
| `command` | `string` | Yes | Command ID to execute on click |

#### `contributes.bpmnContextPad`

Array of context pad entry declarations. Requires `bpmn.modelling` permission.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Entry identifier |
| `icon` | `string` | Yes | Phosphor icon class |
| `title` | `string` | Yes | Tooltip/label |
| `command` | `string` | Yes | Command ID to execute (receives `{ elementId, elementType }`) |
| `elementTypes` | `string[]` | No | Restrict to specific BPMN types (e.g. `["bpmn:Task", "bpmn:ServiceTask"]`). If omitted, shown on all elements |

Context pad entries support a two-level filter: `elementTypes` (static, from manifest) + `elementIds` (dynamic, updated at runtime via `api.bpmn.updateContextPadEntry()`). Both must match for an entry to appear.

#### `contributes.bpmnModules`

Array of diagram-js module bundles injected into the renderer process. Requires `bpmn.renderer` permission.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entry` | `string` | Yes | Relative path to the CommonJS module file |
| `description` | `string` | No | Human-readable description of what the module does |

Modules are standard diagram-js modules exporting `__init__` and service factories. They receive `pluginChannel` via DI for bidirectional communication with the plugin host.

## API Versioning

The Studio exposes `STUDIO_PLUGIN_API_VERSION` (currently `2.0.0`, defined in `studio/src/bifrost/contracts/PluginApiVersion.ts`). Compatibility rules:

- Same major version required
- Plugin's minor ≤ Studio's minor (plugin can't require features the Studio doesn't have)
- Patch version is ignored for compatibility

**2.0.0 (additive after the breaking change):** `contributes.pages` and `api.workbench` add to 2.0.0 without a bump.

**2.0.0 (breaking):** `editorDocumentTypes[].page` is required, left `panes[].pages` is required, `paneToggles` is removed, and the menu bar API is header-only: `pages` accepts page ids and `<categoryId>/*` wildcards, and modifiers cannot touch other areas or insert `pane_content_toggle` (see [workbench-categories.md](workbench-categories.md)).

Incompatible plugins are rejected at discovery with a clear error notification.

## Registration Flow

```
discoverAndLoadPlugins()
  → for each enabled plugin:
    1. Read package.json
    2. ManifestReader.read(pkg) → manifest, errors, warnings
    3. If manifest errors → reject (status: 'error', show notification)
    4. If manifest present → checkApiVersionCompatibility()
       → If incompatible → reject (status: 'error', show notification)
    5. ContributionRegistrar.registerContributions(manifest)
       → Register stub commands, icons, keybindings, menus, settings, panes,
         editor document type placeholders, service task types, themes
    6. If activationEvents OR contributes.editorDocumentTypes present
       → ActivationManager.registerActivationEvents()
       → Plugin status: 'pending' (lazy)
    7. Else → PH_LOAD_PLUGIN immediately (eager, backward-compat)
       → Plugin status: 'loaded'
```

## Cleanup Lifecycle

| Contribution | On disable/uninstall |
|---|---|
| Commands | `CommandMediator.unregister()` |
| Keybindings | `KeybindingsMediator.unregisterKeyBindings()` |
| Icons | No cleanup (accepted limitation; icons are lightweight string mappings) |
| Menus | Menu modifier disposer (returns `{ dispose }`) |
| Settings | `SettingsMediator.unregisterSettings()`. Values preserved, schema removed. |
| Panes | `PaneMediator.unregisterPane()` + `unregisterPaneProvider()` |
| Editor Document Types | `SolutionMediator.unregisterDefaultIncludedFiles()`; the placeholder document type is unregistered via `EditorMediator.unregisterDocumentType()` only if it has not already been replaced by the plugin's real `registerWebviewDocumentType()` registration (which owns its own disposer in `PluginHostBridge`) |
| Service Task Types | `bpmn.serviceTasks.removeCustomType` command |
| Themes | `ThemeManager.unregisterTheme()` + injected `<style>` removal + type-aware fallback if active |
| bpmnPalette | `PluginBpmnContributionStore.removePaletteEntries(pluginName)` |
| bpmnContextPad | `PluginBpmnContributionStore.removeContextPadEntries(pluginName)` |
| bpmnModules | `PluginModuleLoader.unloadPluginModules(pluginName)` + force-reopen BPMN editors |

## Backward Compatibility

- Plugins without `bifrostStudio` → eager activation, no manifest contributions, no version check
- `PluginInfo.manifest` is `undefined` for legacy plugins
- Adding `bifrostStudio` is incremental: `apiVersion` alone enables version checking; adding `activationEvents` enables lazy loading; adding `contributes` enables declarative contributions

## File Map

| File | Role |
|------|------|
| `studio/src/bifrost/common/plugin-host/manifest/ManifestTypes.ts` | TypeScript interfaces |
| `studio/src/bifrost/common/plugin-host/manifest/ManifestReader.ts` | Parser + validator |
| `studio/src/bifrost/common/plugin-host/manifest/ManifestSchema.json` | JSON Schema reference |
| `studio/src/bifrost/common/plugin-host/manifest/ApiVersionCheck.ts` | Semver comparison |
| `studio/src/bifrost/contracts/PluginApiVersion.ts` | `STUDIO_PLUGIN_API_VERSION` constant |
| `studio/src/bifrost/electron-renderer/plugin-host/manifest/ContributionRegistrar.ts` | Registers manifest contributions |
| `studio/src/bifrost/electron-renderer/plugin-host/manifest/PlaceholderPaneProvider.tsx` | Placeholder pane UI shown while plugin is pending activation |
| `studio/src/bifrost/electron-renderer/plugin-host/manifest/PlaceholderEditorDocumentRenderer.tsx` | Placeholder editor UI for `contributes.editorDocumentTypes`; triggers activation and swaps in the real editor |
| `studio/src/bifrost/electron-renderer/plugin-host/ActivationManager.ts` | Event-driven lazy activation |
| `studio/src/bifrost/contracts/PluginHostTypes.ts` | `PluginInfo` with `manifest?`, `manifestErrors?`, `manifestWarnings?` |
